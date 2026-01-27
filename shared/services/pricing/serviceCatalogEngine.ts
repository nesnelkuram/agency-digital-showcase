/**
 * Service Catalog Calculation Engine
 * Hizmet katalogu maliyet ve fiyat hesaplamalari
 */

import {
  // Fixed Costs
  StaffMember,
  Equipment,
  PricingConfig,
  DEFAULT_PRICING_CONFIG,
  calculateStaffRates,
  calculateEquipmentDailyRate,
  StaffRole,
  EquipmentCategory,
  getMarginalTaxRate,

  // Service Catalog
  ServiceTemplate,
  CostRef,
  StaffCostRef,
  LiveRates,
  ComponentCostResult,
  ServiceCostResult,
  QuickQuoteInput,
  QuickQuoteResult,
  QuantityTier,
  getApplicableTier,
  formatCurrency,
  calculateSellPrice,
  calculateProfit,
  calculateProfitPercentage,
} from '@/shared/types/pricing';

// ============================================
// SERVICE CATALOG ENGINE CLASS
// ============================================

export class ServiceCatalogEngine {
  private config: PricingConfig;
  private liveRates: LiveRates | null = null;

  constructor(config: Partial<PricingConfig> = {}) {
    this.config = { ...DEFAULT_PRICING_CONFIG, ...config };
  }

  // ============================================
  // RATE CALCULATIONS
  // ============================================

  /**
   * Build live rates from staff and equipment data
   */
  buildLiveRates(
    staff: StaffMember[],
    equipment: Equipment[],
    dailyShopCost: number,
    hourlyShopCost: number,
    monthlyShopCost?: number
  ): LiveRates {
    const activeStaff = staff.filter(s => s.isActive);
    const activeEquipment = equipment.filter(e => e.isActive);

    // Staff rates by ID (including invoice status for deductibility)
    const staffRates: LiveRates['staffRates'] = {};
    activeStaff.forEach(s => {
      const rates = calculateStaffRates(s, this.config);
      // Employees default to having invoice (deductible), freelancers default to no invoice
      const hasInvoice = s.hasInvoice ?? (s.role !== 'freelancer');
      staffRates[s.id] = {
        hourlyRate: rates.hourlyRate,
        dailyRate: rates.dailyRate,
        name: s.name,
        role: s.role,
        hasInvoice,
      };
    });

    // Role-based default rates (average of each role)
    const roleRates: LiveRates['roleRates'] = {
      junior: { hourlyRate: 0, dailyRate: 0 },
      senior: { hourlyRate: 0, dailyRate: 0 },
      owner: { hourlyRate: 0, dailyRate: 0 },
      freelancer: { hourlyRate: 0, dailyRate: 0 },
    };

    const roleCounts: Record<StaffRole, number> = {
      junior: 0,
      senior: 0,
      owner: 0,
      freelancer: 0,
    };

    activeStaff.forEach(s => {
      const rates = calculateStaffRates(s, this.config);
      roleRates[s.role].hourlyRate += rates.hourlyRate;
      roleRates[s.role].dailyRate += rates.dailyRate;
      roleCounts[s.role]++;
    });

    // Calculate averages
    (Object.keys(roleRates) as StaffRole[]).forEach(role => {
      if (roleCounts[role] > 0) {
        roleRates[role].hourlyRate = Math.round(roleRates[role].hourlyRate / roleCounts[role]);
        roleRates[role].dailyRate = Math.round(roleRates[role].dailyRate / roleCounts[role]);
      }
    });

    // Equipment rates by ID
    const equipmentRates: LiveRates['equipmentRates'] = {};
    activeEquipment.forEach(e => {
      const dailyRate = calculateEquipmentDailyRate(e, this.config);
      equipmentRates[e.id] = {
        dailyRate,
        name: e.name,
        category: e.category,
      };
    });

    // Category-based default rates (average of each category)
    const categoryRates: LiveRates['categoryRates'] = {
      camera: { dailyRate: 0 },
      lens: { dailyRate: 0 },
      lighting: { dailyRate: 0 },
      audio: { dailyRate: 0 },
      computer: { dailyRate: 0 },
      accessory: { dailyRate: 0 },
      other: { dailyRate: 0 },
    };

    const categoryCounts: Record<EquipmentCategory, number> = {
      camera: 0,
      lens: 0,
      lighting: 0,
      audio: 0,
      computer: 0,
      accessory: 0,
      other: 0,
    };

    activeEquipment.forEach(e => {
      const dailyRate = calculateEquipmentDailyRate(e, this.config);
      categoryRates[e.category].dailyRate += dailyRate;
      categoryCounts[e.category]++;
    });

    // Calculate averages
    (Object.keys(categoryRates) as EquipmentCategory[]).forEach(cat => {
      if (categoryCounts[cat] > 0) {
        categoryRates[cat].dailyRate = Math.round(categoryRates[cat].dailyRate / categoryCounts[cat]);
      }
    });

    this.liveRates = {
      staffRates,
      roleRates,
      equipmentRates,
      categoryRates,
      overhead: {
        monthlyShopCost: monthlyShopCost ?? dailyShopCost * this.config.workingDaysPerMonth,
        dailyShopCost,
        hourlyShopCost,
      },
      calculatedAt: new Date(),
    };

    return this.liveRates;
  }

  /**
   * Get cached live rates
   */
  getLiveRates(): LiveRates | null {
    return this.liveRates;
  }

  // ============================================
  // COST CALCULATIONS
  // ============================================

  /**
   * Calculate cost for a single cost reference
   * Returns amount, description, whether the cost is deductible (has invoice), and staff role if applicable
   */
  private calculateCostRefAmount(costRef: CostRef): { amount: number; description: string; isDeductible: boolean; staffRole?: StaffRole } {
    if (!this.liveRates) {
      return { amount: 0, description: 'Oranlar yuklenemedi', isDeductible: false };
    }

    switch (costRef.source) {
      case 'staff': {
        // Try specific staff first, then fall back to role average
        let rate = 0;
        let name = '';
        let hasInvoice = true; // Default to deductible for role-based
        let staffRole: StaffRole = costRef.roleType;

        if (costRef.staffId && this.liveRates.staffRates[costRef.staffId]) {
          const staffRate = this.liveRates.staffRates[costRef.staffId];
          rate = costRef.timeUnit === 'hours' ? staffRate.hourlyRate : staffRate.dailyRate;
          name = staffRate.name;
          hasInvoice = staffRate.hasInvoice;
          staffRole = staffRate.role;
        } else {
          const roleRate = this.liveRates.roleRates[costRef.roleType];
          rate = costRef.timeUnit === 'hours' ? roleRate.hourlyRate : roleRate.dailyRate;
          name = costRef.roleType.charAt(0).toUpperCase() + costRef.roleType.slice(1);
          // For role-based rates, freelancers default to no invoice
          hasInvoice = costRef.roleType !== 'freelancer';
        }

        const amount = rate * costRef.timeAmount;
        const unitLabel = costRef.timeUnit === 'hours' ? 'saat' : 'gun';
        return {
          amount,
          description: `${name} (${costRef.timeAmount} ${unitLabel} x ${formatCurrency(rate)} TL)`,
          isDeductible: hasInvoice,
          staffRole,
        };
      }

      case 'equipment': {
        // Try specific equipment first, then fall back to category average
        let rate = 0;
        let name = '';

        if (costRef.equipmentId && this.liveRates.equipmentRates[costRef.equipmentId]) {
          const eqRate = this.liveRates.equipmentRates[costRef.equipmentId];
          rate = eqRate.dailyRate;
          name = eqRate.name;
        } else {
          rate = this.liveRates.categoryRates[costRef.category].dailyRate;
          name = costRef.category.charAt(0).toUpperCase() + costRef.category.slice(1);
        }

        const amount = rate * costRef.days;
        return {
          amount,
          description: `${name} (${costRef.days} gun x ${formatCurrency(rate)} TL)`,
          isDeductible: true, // Equipment is always deductible (depreciation or rental)
        };
      }

      case 'overhead': {
        // Overhead (shop cost) is always deductible - represents real expenses
        switch (costRef.allocationType) {
          case 'per_month':
            return {
              amount: this.liveRates.overhead.monthlyShopCost,
              description: `Aylik genel gider (${formatCurrency(this.liveRates.overhead.monthlyShopCost)} TL)`,
              isDeductible: true,
            };
          case 'per_day':
            return {
              amount: this.liveRates.overhead.dailyShopCost,
              description: `Gunluk genel gider (${formatCurrency(this.liveRates.overhead.dailyShopCost)} TL)`,
              isDeductible: true,
            };
          case 'per_hour':
            return {
              amount: this.liveRates.overhead.hourlyShopCost,
              description: `Saatlik genel gider (${formatCurrency(this.liveRates.overhead.hourlyShopCost)} TL)`,
              isDeductible: true,
            };
          case 'fixed':
            return {
              amount: costRef.amount || 0,
              description: `Sabit genel gider (${formatCurrency(costRef.amount || 0)} TL)`,
              isDeductible: true,
            };
        }
        return { amount: 0, description: '', isDeductible: true };
      }

      case 'manual': {
        // Manual costs - check isDeductible flag from the costRef (default true)
        const manualIsDeductible = costRef.isDeductible !== false;
        return {
          amount: costRef.amount,
          description: `${costRef.description} (${formatCurrency(costRef.amount)} TL)`,
          isDeductible: manualIsDeductible,
        };
      }

      default:
        return { amount: 0, description: '', isDeductible: false };
    }
  }

  /**
   * Calculate cost for a service component
   */
  calculateComponentCost(
    component: ServiceTemplate['components'][0],
    quantity: number = 1
  ): ComponentCostResult {
    let laborCost = 0;
    let ownerLaborCost = 0;
    let employeeLaborCost = 0;
    let freelancerCost = 0;
    let equipmentCost = 0;
    let overheadCost = 0;
    let manualCost = 0;
    let deductibleCost = 0;
    let nonDeductibleCost = 0;
    const details: ComponentCostResult['details'] = [];

    // Calculate each cost reference
    component.costRefs.forEach(ref => {
      const { amount, description, isDeductible, staffRole } = this.calculateCostRefAmount(ref);

      details.push({
        source: ref.source,
        description,
        amount,
        isDeductible,
      });

      switch (ref.source) {
        case 'staff':
          laborCost += amount;
          // Track owner vs employee vs freelancer labor separately
          if (staffRole === 'owner') {
            ownerLaborCost += amount;
            // Owner labor is NEVER deductible - it's profit, not expense
            nonDeductibleCost += amount;
          } else if (staffRole === 'freelancer') {
            freelancerCost += amount;
            // Track deductibility for freelancers
            if (isDeductible) {
              deductibleCost += amount;
            } else {
              nonDeductibleCost += amount;
            }
          } else {
            employeeLaborCost += amount;
            // Track deductibility for non-owner staff
            if (isDeductible) {
              deductibleCost += amount;
            } else {
              nonDeductibleCost += amount;
            }
          }
          break;
        case 'equipment':
          equipmentCost += amount;
          // Equipment is always deductible (depreciation or rental)
          if (isDeductible) {
            deductibleCost += amount;
          } else {
            nonDeductibleCost += amount;
          }
          break;
        case 'overhead':
          overheadCost += amount;
          // Overhead is always deductible
          deductibleCost += amount;
          break;
        case 'manual':
          manualCost += amount;
          // Manual costs - respect the isDeductible flag
          if (isDeductible) {
            deductibleCost += amount;
          } else {
            nonDeductibleCost += amount;
          }
          break;
      }
    });

    // Calculate unit cost and total
    const unitCost = laborCost + equipmentCost + overheadCost + manualCost;

    // Apply quantity and tier if applicable
    let tierApplied: string | undefined;
    let effectiveQuantity = quantity;
    let priceModifier = 1;

    if (component.type === 'tiered' && component.quantityTiers) {
      const tier = getApplicableTier(quantity, component.quantityTiers);
      if (tier) {
        tierApplied = tier.label;
        priceModifier = tier.unitPriceModifier;
      }
    }

    // For fixed type, quantity is always 1
    if (component.type === 'fixed') {
      effectiveQuantity = 1;
    }

    const totalCost = Math.round(unitCost * effectiveQuantity * priceModifier);

    return {
      componentId: component.id,
      componentName: component.name,
      type: component.type,
      quantity: effectiveQuantity,
      unitCost: Math.round(unitCost),
      totalCost,
      tierApplied,
      laborCost: Math.round(laborCost * effectiveQuantity * priceModifier),
      ownerLaborCost: Math.round(ownerLaborCost * effectiveQuantity * priceModifier),
      employeeLaborCost: Math.round(employeeLaborCost * effectiveQuantity * priceModifier),
      freelancerCost: Math.round(freelancerCost * effectiveQuantity * priceModifier),
      equipmentCost: Math.round(equipmentCost * effectiveQuantity * priceModifier),
      overheadCost: Math.round(overheadCost * effectiveQuantity * priceModifier),
      manualCost: Math.round(manualCost * effectiveQuantity * priceModifier),
      deductibleCost: Math.round(deductibleCost * effectiveQuantity * priceModifier),
      nonDeductibleCost: Math.round(nonDeductibleCost * effectiveQuantity * priceModifier),
      details,
    };
  }

  /**
   * Calculate full service cost
   */
  calculateServiceCost(
    template: ServiceTemplate,
    componentQuantities: Record<string, number> = {},
    marginOverride?: number
  ): ServiceCostResult {
    if (!this.liveRates) {
      throw new Error('Live rates not loaded. Call buildLiveRates first.');
    }

    const components: ComponentCostResult[] = [];
    let totalLaborCost = 0;
    let totalOwnerLaborCost = 0;
    let totalEmployeeLaborCost = 0;
    let totalFreelancerCost = 0;
    let totalEquipmentCost = 0;
    let totalOverheadCost = 0;
    let totalManualCost = 0;
    let totalDeductibleCost = 0;
    let totalNonDeductibleCost = 0;
    let estimatedHours = 0;
    let estimatedDays = 0;

    // Track non-freelancer hours for auto overhead calculation
    let nonFreelancerHours = 0;

    // Calculate each component
    template.components.forEach(component => {
      const quantity = componentQuantities[component.id] ?? component.baseQuantity ?? 1;
      const result = this.calculateComponentCost(component, quantity);

      components.push(result);
      totalLaborCost += result.laborCost;
      totalOwnerLaborCost += result.ownerLaborCost;
      totalEmployeeLaborCost += result.employeeLaborCost;
      totalFreelancerCost += result.freelancerCost;
      totalEquipmentCost += result.equipmentCost;
      totalOverheadCost += result.overheadCost;
      totalManualCost += result.manualCost;
      totalDeductibleCost += result.deductibleCost;
      totalNonDeductibleCost += result.nonDeductibleCost;

      // Estimate time from staff refs and track non-freelancer hours
      component.costRefs.forEach(ref => {
        if (ref.source === 'staff') {
          const staffRef = ref as StaffCostRef;
          let hours = 0;

          if (staffRef.timeUnit === 'hours') {
            hours = staffRef.timeAmount * quantity;
            estimatedHours += hours;
          } else if (staffRef.timeUnit === 'days') {
            const days = staffRef.timeAmount * quantity;
            hours = days * this.config.hoursPerDay;
            estimatedDays += days;
          }

          // Only count non-freelancer hours for auto overhead
          // Check if specific staff is freelancer, or if role is not freelancer
          if (staffRef.staffId && this.liveRates.staffRates[staffRef.staffId]) {
            const staffRole = this.liveRates.staffRates[staffRef.staffId].role;
            if (staffRole !== 'freelancer') {
              nonFreelancerHours += hours;
            }
          } else if (staffRef.roleType !== 'freelancer') {
            nonFreelancerHours += hours;
          }
        }
      });
    });

    // Calculate auto overhead: non-freelancer hours × hourlyShopCost
    const hourlyShopCostUsed = this.liveRates.overhead.hourlyShopCost;
    const autoOverheadCost = Math.round(nonFreelancerHours * hourlyShopCostUsed);

    // Auto overhead is always deductible (represents real fixed costs)
    totalDeductibleCost += autoOverheadCost;

    // Total cost includes auto overhead
    const baseCost = totalLaborCost + totalEquipmentCost + totalOverheadCost + totalManualCost + autoOverheadCost;

    // Apply complexity multiplier
    const adjustedCost = Math.round(baseCost * template.complexityMultiplier);

    // Apply minimum price
    const effectiveCost = Math.max(adjustedCost, template.minimumPrice || 0);

    // Calculate sell price
    const margin = marginOverride ?? template.defaultMargin;
    const suggestedPrice = calculateSellPrice(effectiveCost, margin);
    const profit = calculateProfit(suggestedPrice, effectiveCost);
    const profitPercentage = calculateProfitPercentage(suggestedPrice, effectiveCost);

    // Calculate tax-related fields
    // Owner labor is already excluded from deductibleCost at component level
    // Taxable income = Revenue - Deductible Costs
    const taxableIncome = Math.max(0, suggestedPrice - totalDeductibleCost);

    // Get marginal tax rate based on estimated annual income
    const estimatedAnnualIncome = this.config.estimatedAnnualIncome || 400000;
    const marginalTaxRate = getMarginalTaxRate(estimatedAnnualIncome);

    // Estimated tax for this service (using marginal rate)
    const estimatedTax = Math.round(taxableIncome * marginalTaxRate);

    // Total owner profit = Owner Labor + Margin Profit
    const totalOwnerProfit = totalOwnerLaborCost + profit;

    // Net profit after tax = Total Owner Profit - Estimated Tax
    const netProfitAfterTax = totalOwnerProfit - estimatedTax;

    // Convert hours to days for total estimate
    const totalEstimatedDays = estimatedDays + estimatedHours / this.config.hoursPerDay;

    return {
      templateId: template.id,
      templateName: template.name,
      components,
      laborCost: totalLaborCost,
      ownerLaborCost: totalOwnerLaborCost,
      employeeLaborCost: totalEmployeeLaborCost,
      freelancerCost: totalFreelancerCost,
      equipmentCost: totalEquipmentCost,
      overheadCost: totalOverheadCost,
      autoOverheadCost,
      manualCost: totalManualCost,
      nonFreelancerHours: Math.round(nonFreelancerHours * 10) / 10,
      hourlyShopCostUsed,
      totalCost: effectiveCost,
      suggestedPrice,
      margin,
      profit,
      profitPercentage,
      deductibleCost: totalDeductibleCost,
      nonDeductibleCost: totalNonDeductibleCost,
      taxableIncome,
      estimatedTax,
      marginalTaxRate,
      netProfitAfterTax,
      estimatedHours: Math.round(estimatedHours),
      estimatedDays: Math.round(totalEstimatedDays * 10) / 10,
      ratesSnapshot: this.liveRates,
      calculatedAt: new Date(),
    };
  }

  /**
   * Quick quote calculation
   */
  calculateQuickQuote(
    template: ServiceTemplate,
    input: QuickQuoteInput
  ): QuickQuoteResult {
    // Build component quantities from input
    const componentQuantities: Record<string, number> = {};

    // Apply default quantities from template
    template.components.forEach(component => {
      if (component.type !== 'fixed') {
        componentQuantities[component.id] = component.baseQuantity ?? 1;
      }
    });

    // Apply quick quote defaults
    if (template.quickQuoteDefaults?.componentOverrides) {
      Object.assign(componentQuantities, template.quickQuoteDefaults.componentOverrides);
    }

    // Apply input quantities
    if (input.componentQuantities) {
      Object.assign(componentQuantities, input.componentQuantities);
    }

    // For simple quantity input, apply to first non-fixed component
    if (input.quantity) {
      const targetComponent = template.components.find(c => c.type !== 'fixed');
      if (targetComponent) {
        componentQuantities[targetComponent.id] = input.quantity;
      }
    }

    const breakdown = this.calculateServiceCost(
      template,
      componentQuantities,
      input.marginOverride
    );

    // Find unit label from first tiered/per_unit component
    const unitComponent = template.components.find(c => c.type !== 'fixed');
    const unitLabel = unitComponent?.unitLabel;
    const unitQuantity = unitComponent ? componentQuantities[unitComponent.id] : 1;

    const pricePerUnit = unitQuantity > 0
      ? `${formatCurrency(Math.round(breakdown.suggestedPrice / unitQuantity))} TL`
      : undefined;

    return {
      breakdown,
      formattedCost: `${formatCurrency(breakdown.totalCost)} TL`,
      formattedPrice: `${formatCurrency(breakdown.suggestedPrice)} TL`,
      pricePerUnit,
      unitLabel,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let engineInstance: ServiceCatalogEngine | null = null;

export function getServiceCatalogEngine(config?: Partial<PricingConfig>): ServiceCatalogEngine {
  if (!engineInstance) {
    engineInstance = new ServiceCatalogEngine(config);
  }
  return engineInstance;
}

export function resetServiceCatalogEngine(): void {
  engineInstance = null;
}
