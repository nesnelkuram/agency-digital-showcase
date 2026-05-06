// ============================================
// PRICING TYPES - BARREL EXPORT
// ============================================

// Fixed Costs (Sabit Giderler)
export {
  // Types
  type CostStatus,
  type StaffRole,
  type EquipmentCategory,
  type EquipmentCostMethod,
  type SoftwareCategory,
  type OverheadCategory,
  type MarketingCategory,
  type RentTaxType,
  type PriceEntryType,

  // Interfaces
  type StaffMember,
  type StaffBenefits,
  type StaffRatesResult,
  type Equipment,
  type SoftwareSubscription,
  type OverheadCost,
  type MarketingCost,
  type PricingConfig,
  type FixedCostsSummary,
  type TaxBracket,
  type TaxCalculationResult,
  type TaxBracketBreakdown,

  // Constants
  COST_STATUS_LABELS,
  STAFF_ROLE_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_COST_METHOD_LABELS,
  SOFTWARE_CATEGORY_LABELS,
  OVERHEAD_CATEGORY_LABELS,
  MARKETING_CATEGORY_LABELS,
  RENT_TAX_TYPE_LABELS,
  PRICE_ENTRY_TYPE_LABELS,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_STAFF_BENEFITS,
  DEFAULT_UTILIZATION_RATE,
  DEFAULT_STOPAJ_RATE,
  DEFAULT_KDV_RATE,
  TAX_BRACKETS_2024,
  TAX_BRACKETS_2026,
  TAX_BRACKETS,

  // Functions
  calculateStaffRates,
  calculateEquipmentDailyRate,
  calculateFixedCostsSummary,
  getApplicableTaxBracket,
  calculateProgressiveTax,
  calculateProgressiveTaxDetailed,
  calculateEffectiveTaxRate,
  getMarginalTaxRate,
} from './fixedCosts';

// Services (Servis Katalogu)
export {
  // Types
  type ServiceCategory,
  type TimeUnit,
  type VariableType,
  type VariableAffects,

  // Interfaces
  type VariableOption,
  type ServiceVariable,
  type StaffRequirement,
  type EquipmentRequirement,
  type ServiceComponent,
  type ServiceDefinition,

  // Constants
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_ICONS,
  VIDEO_SUBTYPES,
  PHOTOGRAPHY_SUBTYPES,
  SOCIAL_MEDIA_SUBTYPES,
  GRAPHIC_DESIGN_SUBTYPES,
  DRONE_SUBTYPES,
  SCRIPTWRITING_SUBTYPES,
  ECOMMERCE_SUBTYPES,
  TIME_UNIT_LABELS,
  DEFAULT_VIDEO_VARIABLES,
  DEFAULT_VIDEO_COMPONENTS,

  // Functions
  applyVariableModifiers,
} from './services';

// Quotes (Teklifler)
export {
  // Types
  type QuoteStatus,
  type DiscountType,
  type ValidityDays,
  type BillingType,
  type BillingPeriod,

  // Interfaces
  type ConfiguredServiceItem,
  type QuoteDiscount,
  type Quote,
  type QuoteCalculationInput,
  type QuoteCalculationResult,
  type QuoteFilters,
  type QuoteSortOptions,

  // Wizard Types
  type WizardClientData,
  type TeamMemberSelection,
  type EquipmentSelection,
  type ExtrasData,
  type WizardCosts,
  type QuoteWizardState,
  type QuoteKdvRate,
  type QuoteCurrency,
  type RentalCatalogItem,
  type RentalLineItem,

  // Constants
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  BILLING_TYPE_LABELS,
  BILLING_PERIOD_LABELS,
  DEFAULT_EXTRAS,
  INITIAL_WIZARD_STATE,
  KDV_RATE_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_EXCHANGE_RATES,

  // Functions
  calculateQuoteTotals,
} from './quotes';

// Retainers (Retainer Sozlesmeleri)
export {
  // Types
  type RetainerModel,
  type BillingCycle,
  type RenewalType,

  // Interfaces
  type HourPackage,
  type DeliverableItem,
  type DeliverablePackage,
  type HybridPackage,
  type RetainerContract,
  type UsageEntry,
  type RetainerUsagePeriod,
  type UsageSummary,
  type RetainerFilters,

  // Constants
  RETAINER_MODEL_LABELS,
  RETAINER_MODEL_DESCRIPTIONS,
  BILLING_CYCLE_LABELS,

  // Functions
  calculateUsageSummary,
} from './retainers';

// Customers (Musteriler)
export {
  // Types
  type CustomerStatus,
  type ServiceItemUnit,

  // Interfaces
  type CustomerServiceItem,
  type Customer,

  // Constants
  CUSTOMER_STATUS_LABELS,
  SERVICE_ITEM_UNIT_LABELS,

  // Functions
  calculateServiceItemTotal,
  calculateCustomerMonthlyFee,
  createServiceItem,
} from './customers';

// Service Catalog (Hizmet Katalogu)
export {
  // Types
  type ComponentType,
  type CostSource,
  type OverheadAllocationType,

  // Interfaces - Cost References
  type StaffCostRef,
  type EquipmentCostRef,
  type OverheadCostRef,
  type ManualCostRef,
  type CostRef,

  // Interfaces - Components & Templates
  type QuantityTier,
  type ServiceComponent as CatalogServiceComponent,
  type ServiceTemplate,
  type LiveRates,

  // Interfaces - Calculation Results
  type ComponentCostResult,
  type ServiceCostResult,

  // Interfaces - Quick Quote
  type QuickQuoteInput,
  type QuickQuoteResult,

  // Interfaces - Filters
  type CatalogFilters,

  // Constants
  COMPONENT_TYPE_LABELS,
  COST_SOURCE_LABELS,
  DEFAULT_QUANTITY_TIERS,
  SAMPLE_REELS_TEMPLATE,
  SAMPLE_CEKIM_GUNU_TEMPLATE,
  SAMPLE_DRONE_TEMPLATE,
  SAMPLE_SENARYO_TEMPLATE,
  SAMPLE_ETICARET_TEMPLATE,
  SAMPLE_SOSYAL_MEDYA_TEMPLATE,

  // Functions
  getApplicableTier,
  formatCurrency,
  formatProposalAmount,
  CURRENCY_SYMBOLS,
  calculateSellPrice,
  calculateProfit,
  calculateProfitPercentage,
} from './serviceCatalog';

// Proposals (Teklif Dokumanlari)
export {
  // Types
  type PrepaymentPeriod,
  type ProposalDocStatus,

  // Interfaces
  type EconomicParameters,
  type PrepaymentTier,
  type ProposalServiceLine,
  type ProposalTerms,
  type ProposalDocument,
  type ProposalGenerationInput,

  // Constants
  DEFAULT_ECONOMIC_PARAMETERS,
  PREPAYMENT_PERIOD_LABELS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  DEFAULT_PROPOSAL_TERMS,

  // Functions
  generateProposalNumber,
} from './proposal';
