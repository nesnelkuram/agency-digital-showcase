/**
 * Pricing Calculation Engine
 * Central service for all pricing calculations
 */

import {
  // Fixed Costs
  StaffMember,
  Equipment,
  SoftwareSubscription,
  OverheadCost,
  PricingConfig,
  FixedCostsSummary,
  DEFAULT_PRICING_CONFIG,
  calculateStaffRates,
  calculateEquipmentDailyRate,
  calculateFixedCostsSummary,

  // Services
  ServiceDefinition,
  ServiceVariable,
  ServiceComponent,
  TimeUnit,
  applyVariableModifiers,

  // Quotes
  ConfiguredServiceItem,
  QuoteCalculationInput,
  QuoteCalculationResult,
  calculateQuoteTotals,

  // Retainers
  RetainerContract,
  RetainerUsagePeriod,
  UsageSummary,
  calculateUsageSummary,
} from '@/shared/types/pricing';

// ============================================
// PRICING ENGINE CLASS
// ============================================

export class PricingEngine {
  private config: PricingConfig;
  private fixedCostsSummary: FixedCostsSummary | null = null;

  constructor(config: Partial<PricingConfig> = {}) {
    this.config = { ...DEFAULT_PRICING_CONFIG, ...config };
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setConfig(config: Partial<PricingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PricingConfig {
    return { ...this.config };
  }

  // ============================================
  // FIXED COSTS CALCULATIONS
  // ============================================

  /**
   * Calculate and cache fixed costs summary
   */
  calculateFixedCosts(
    staff: StaffMember[],
    equipment: Equipment[],
    software: SoftwareSubscription[],
    overhead: OverheadCost[],
    ownerTargetMonthly: number
  ): FixedCostsSummary {
    this.fixedCostsSummary = calculateFixedCostsSummary(
      staff,
      equipment,
      software,
      overhead,
      ownerTargetMonthly,
      this.config
    );
    return this.fixedCostsSummary;
  }

  /**
   * Get cached fixed costs summary
   */
  getFixedCostsSummary(): FixedCostsSummary | null {
    return this.fixedCostsSummary;
  }

  /**
   * Get daily shop cost (for overhead allocation)
   */
  getDailyShopCost(): number {
    return this.fixedCostsSummary?.dailyShopCost ?? 0;
  }

  /**
   * Get hourly shop cost
   */
  getHourlyShopCost(): number {
    return this.fixedCostsSummary?.hourlyShopCost ?? 0;
  }

  /**
   * Calculate staff rates for a single member
   */
  calculateStaffMemberRates(staff: StaffMember) {
    return calculateStaffRates(staff, this.config);
  }

  /**
   * Calculate equipment daily rate
   */
  calculateEquipmentRate(equipment: Equipment): number {
    return calculateEquipmentDailyRate(equipment, this.config);
  }

  // ============================================
  // SERVICE CALCULATIONS
  // ============================================

  /**
   * Calculate cost for a single service component
   */
  calculateComponentCost(
    component: ServiceComponent,
    staffMembers: StaffMember[],
    equipment: Equipment[],
    variableModifier: number = 1
  ): { laborCost: number; equipmentCost: number; totalHours: number; totalDays: number } {
    let laborCost = 0;
    let totalHours = 0;

    // Calculate labor costs from staff requirements
    for (const req of component.staffRequirements) {
      // Find staff member by role if not specified
      const staff = req.staffId
        ? staffMembers.find((s) => s.id === req.staffId)
        : staffMembers.find((s) => s.role === req.roleType && s.isActive);

      if (staff) {
        const rates = calculateStaffRates(staff, this.config);
        const timeAmount = req.timeAmount * variableModifier;

        if (req.timeUnit === 'hours') {
          laborCost += rates.hourlyRate * timeAmount * req.quantity;
          totalHours += timeAmount * req.quantity;
        } else if (req.timeUnit === 'days') {
          laborCost += rates.dailyRate * timeAmount * req.quantity;
          totalHours += timeAmount * req.quantity * this.config.hoursPerDay;
        }
      }
    }

    // Calculate equipment costs
    let equipmentCost = 0;
    for (const req of component.equipmentRequirements) {
      if (!req.isRequired) continue;

      // Find equipment by ID or category
      const equip = req.equipmentId
        ? equipment.find((e) => e.id === req.equipmentId)
        : equipment.find((e) => e.category === req.equipmentCategory && e.isActive);

      if (equip) {
        const dailyRate = calculateEquipmentDailyRate(equip, this.config);
        equipmentCost += dailyRate * req.days * variableModifier;
      }
    }

    const totalDays = totalHours / this.config.hoursPerDay;

    return { laborCost, equipmentCost, totalHours, totalDays };
  }

  /**
   * Calculate full service cost with all components and variables
   */
  calculateServiceCost(
    service: ServiceDefinition,
    variableValues: Record<string, any>,
    enabledComponents: string[],
    staffMembers: StaffMember[],
    equipment: Equipment[]
  ): ConfiguredServiceItem {
    // Apply variable modifiers to get time multiplier
    const variableModifier = applyVariableModifiers(
      1, // base of 1, modifiers will multiply
      service.variables,
      variableValues
    );

    let totalLaborCost = 0;
    let totalEquipmentCost = 0;
    let totalHours = 0;

    // Calculate costs for each enabled component
    for (const component of service.components) {
      // Skip optional components that aren't enabled
      if (component.isOptional && !enabledComponents.includes(component.id)) {
        continue;
      }

      // Check for price override
      if (component.priceOverride !== undefined) {
        totalLaborCost += component.priceOverride;
        // Estimate hours for price override components
        totalHours += component.baseTime * (component.timeUnit === 'days' ? this.config.hoursPerDay : 1);
        continue;
      }

      const componentCost = this.calculateComponentCost(
        component,
        staffMembers,
        equipment,
        variableModifier
      );

      totalLaborCost += componentCost.laborCost;
      totalEquipmentCost += componentCost.equipmentCost;
      totalHours += componentCost.totalHours;
    }

    // Apply complexity multiplier
    totalLaborCost *= service.complexityMultiplier;
    totalEquipmentCost *= service.complexityMultiplier;

    // Calculate fixed cost allocation
    const totalDays = Math.ceil(totalHours / this.config.hoursPerDay);
    const fixedCostAllocation = this.getDailyShopCost() * totalDays;

    // Calculate subtotal
    const subtotal = totalLaborCost + totalEquipmentCost + fixedCostAllocation;

    // Apply minimum price if set
    const finalSubtotal = service.minimumPrice
      ? Math.max(subtotal, service.minimumPrice)
      : subtotal;

    return {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      serviceId: service.id,
      serviceName: service.name,
      serviceCategory: service.category,
      variableValues,
      enabledComponents,
      laborCost: Math.round(totalLaborCost),
      equipmentCost: Math.round(totalEquipmentCost),
      fixedCostAllocation: Math.round(fixedCostAllocation),
      subtotal: Math.round(finalSubtotal),
      estimatedHours: Math.round(totalHours * 10) / 10,
      estimatedDays: Math.round(totalDays * 10) / 10,
      quantity: 1,
      useOverride: false,
    };
  }

  // ============================================
  // QUOTE CALCULATIONS
  // ============================================

  /**
   * Calculate quote totals from items
   */
  calculateQuote(input: QuoteCalculationInput): QuoteCalculationResult {
    return calculateQuoteTotals(input);
  }

  /**
   * Calculate final sell price from raw cost
   */
  calculateSellPrice(
    rawCost: number,
    targetMarginPercent: number,
    safetyBufferPercent: number = this.config.defaultSafetyBuffer
  ): { sellPrice: number; profit: number; actualMargin: number } {
    // Add safety buffer
    const costWithBuffer = rawCost * (1 + safetyBufferPercent);

    // Calculate sell price
    const sellPrice = targetMarginPercent >= 1
      ? rawCost // Margin 100% or above is meaningless
      : costWithBuffer / (1 - targetMarginPercent);

    const profit = sellPrice - rawCost;
    const actualMargin = sellPrice > 0 ? profit / sellPrice : 0;

    return {
      sellPrice: Math.round(sellPrice),
      profit: Math.round(profit),
      actualMargin,
    };
  }

  /**
   * Reverse calculate: what raw cost allows target profit?
   */
  calculateMaxCostForProfit(
    sellPrice: number,
    targetProfitPercent: number,
    safetyBufferPercent: number = this.config.defaultSafetyBuffer
  ): number {
    const profit = sellPrice * targetProfitPercent;
    const rawCost = sellPrice - profit;
    const costWithoutBuffer = rawCost / (1 + safetyBufferPercent);
    return Math.round(costWithoutBuffer);
  }

  // ============================================
  // RETAINER CALCULATIONS
  // ============================================

  /**
   * Calculate retainer usage summary
   */
  calculateRetainerUsage(
    contract: RetainerContract,
    currentPeriod: RetainerUsagePeriod
  ): UsageSummary {
    return calculateUsageSummary(contract, currentPeriod);
  }

  /**
   * Calculate retainer hourly cost (for Şeyma-style retainers)
   */
  calculateRetainerHourlyCost(
    staffMember: StaffMember,
    hours: number
  ): { laborCost: number; overheadCost: number; totalCost: number } {
    const rates = calculateStaffRates(staffMember, this.config);
    const laborCost = rates.hourlyRate * hours;

    // Overhead based on hours (convert to days)
    const workDays = Math.ceil(hours / this.config.hoursPerDay);
    const overheadCost = this.getDailyShopCost() * workDays;

    return {
      laborCost: Math.round(laborCost),
      overheadCost: Math.round(overheadCost),
      totalCost: Math.round(laborCost + overheadCost),
    };
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Format currency (TRY)
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: this.config.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Convert hours to days
   */
  hoursToDays(hours: number): number {
    return hours / this.config.hoursPerDay;
  }

  /**
   * Convert days to hours
   */
  daysToHours(days: number): number {
    return days * this.config.hoursPerDay;
  }

  /**
   * Get profit color class based on margin
   */
  getProfitColorClass(marginPercent: number): string {
    if (marginPercent < 0.2) return 'text-red-600';
    if (marginPercent >= 0.4) return 'text-green-600';
    return 'text-[#171717]';
  }

  /**
   * Check if margin is healthy
   */
  isMarginHealthy(marginPercent: number): boolean {
    return marginPercent >= 0.25;
  }

  /**
   * Get margin status
   */
  getMarginStatus(marginPercent: number): 'low' | 'medium' | 'good' | 'excellent' {
    if (marginPercent < 0.2) return 'low';
    if (marginPercent < 0.3) return 'medium';
    if (marginPercent < 0.4) return 'good';
    return 'excellent';
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let engineInstance: PricingEngine | null = null;

/**
 * Get or create pricing engine instance
 */
export function getPricingEngine(config?: Partial<PricingConfig>): PricingEngine {
  if (!engineInstance) {
    engineInstance = new PricingEngine(config);
  } else if (config) {
    engineInstance.setConfig(config);
  }
  return engineInstance;
}

/**
 * Reset pricing engine (useful for testing)
 */
export function resetPricingEngine(): void {
  engineInstance = null;
}

// ============================================
// STANDALONE HELPER FUNCTIONS
// ============================================

/**
 * Quick calculation for simple quotes (production mode)
 */
export function calculateSimpleProductionQuote(params: {
  juniorDays: number;
  ownerDays: number;
  cameraDays: number;
  lightDays: number;
  workstationDays: number;
  additionalExpenses: number;
  marginPercent: number;
  dailyShopCost: number;
  unitRates: {
    juniorDaily: number;
    ownerDaily: number;
    cameraDaily: number;
    lightDaily: number;
    workstationDaily: number;
  };
}): {
  laborCost: number;
  gearCost: number;
  overheadCost: number;
  rawCost: number;
  sellPrice: number;
  profit: number;
  actualMargin: number;
} {
  const {
    juniorDays, ownerDays, cameraDays, lightDays, workstationDays,
    additionalExpenses, marginPercent, dailyShopCost, unitRates
  } = params;

  // Labor
  const juniorTotal = juniorDays * unitRates.juniorDaily;
  const ownerTotal = ownerDays * unitRates.ownerDaily;
  const laborCost = juniorTotal + ownerTotal;

  // Gear
  const cameraTotal = cameraDays * unitRates.cameraDaily;
  const lightTotal = lightDays * unitRates.lightDaily;
  const workstationTotal = workstationDays * unitRates.workstationDaily;
  const gearCost = cameraTotal + lightTotal + workstationTotal;

  // Overhead
  const totalDays = Math.max(juniorDays, ownerDays, cameraDays, lightDays, workstationDays, 1);
  const overheadCost = dailyShopCost * totalDays;

  // Total
  const rawCost = laborCost + gearCost + overheadCost + additionalExpenses;

  // Safety buffer (10%)
  const costWithBuffer = rawCost * 1.1;

  // Sell price
  const sellPrice = marginPercent >= 1 ? rawCost : costWithBuffer / (1 - marginPercent);

  // Profit
  const profit = sellPrice - rawCost;
  const actualMargin = sellPrice > 0 ? profit / sellPrice : 0;

  return {
    laborCost: Math.round(laborCost),
    gearCost: Math.round(gearCost),
    overheadCost: Math.round(overheadCost),
    rawCost: Math.round(rawCost),
    sellPrice: Math.round(sellPrice),
    profit: Math.round(profit),
    actualMargin,
  };
}

/**
 * Quick calculation for retainer quotes (hourly mode)
 */
export function calculateSimpleRetainerQuote(params: {
  hours: number;
  hourlyRate: number;
  dailyShopCost: number;
  hoursPerDay?: number;
  additionalExpenses?: number;
  marginPercent?: number;
}): {
  laborCost: number;
  overheadCost: number;
  rawCost: number;
  sellPrice: number;
  profit: number;
  actualMargin: number;
} {
  const {
    hours,
    hourlyRate,
    dailyShopCost,
    hoursPerDay = 8,
    additionalExpenses = 0,
    marginPercent = 0.3
  } = params;

  // Labor
  const laborCost = hours * hourlyRate;

  // Overhead (convert hours to days)
  const workDays = Math.ceil(hours / hoursPerDay);
  const overheadCost = dailyShopCost * workDays;

  // Total
  const rawCost = laborCost + overheadCost + additionalExpenses;

  // Safety buffer (10%)
  const costWithBuffer = rawCost * 1.1;

  // Sell price
  const sellPrice = marginPercent >= 1 ? rawCost : costWithBuffer / (1 - marginPercent);

  // Profit
  const profit = sellPrice - rawCost;
  const actualMargin = sellPrice > 0 ? profit / sellPrice : 0;

  return {
    laborCost: Math.round(laborCost),
    overheadCost: Math.round(overheadCost),
    rawCost: Math.round(rawCost),
    sellPrice: Math.round(sellPrice),
    profit: Math.round(profit),
    actualMargin,
  };
}
