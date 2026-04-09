import { Timestamp } from 'firebase/firestore';
import { ServiceCategory } from './services';

// ============================================
// QUOTE STATUS
// ============================================

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Taslak',
  sent: 'Gonderildi',
  accepted: 'Kabul Edildi',
  rejected: 'Reddedildi',
  expired: 'Suresi Doldu',
  converted: 'Projeye Donusturuldu',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
};

// ============================================
// BILLING TYPE (Fatura Turu)
// ============================================

export type BillingType = 'one_time' | 'recurring';

export type BillingPeriod = 1 | 3 | 6 | 12; // ay

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  one_time: 'Tek Seferlik',
  recurring: 'Aylik Duzenli',
};

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  1: '1 Ay',
  3: '3 Ay',
  6: '6 Ay',
  12: '12 Ay',
};

// ============================================
// CONFIGURED SERVICE ITEM (Sepetteki Her Servis)
// ============================================

export interface ConfiguredServiceItem {
  id: string;                 // Unique ID for this cart item
  serviceId: string;          // Reference to ServiceDefinition
  serviceName: string;        // Denormalized for display
  serviceCategory: ServiceCategory;

  // Kullanici secimleri
  variableValues: Record<string, any>;  // variable.id -> selected value
  enabledComponents: string[];          // component.id[] that are enabled

  // Hesaplanan maliyetler
  laborCost: number;
  equipmentCost: number;
  fixedCostAllocation: number;
  subtotal: number;

  // Zaman tahminleri
  estimatedHours: number;
  estimatedDays: number;

  // Miktar ve notlar
  quantity: number;
  notes?: string;

  // Fiyat override (istege bagli)
  priceOverride?: number;
  useOverride: boolean;
}

// ============================================
// QUOTE DISCOUNT
// ============================================

export type DiscountType = 'percentage' | 'fixed';

export interface QuoteDiscount {
  type: DiscountType;
  value: number;              // Yuzde veya sabit tutar
  reason?: string;
  approvedBy?: string;
}

// ============================================
// QUOTE (Ana Teklif Dokumani)
// ============================================

export interface Quote {
  id: string;

  // Şablon referansı (yeniden hesaplama için)
  templateId?: string;        // Servis şablonu ID'si
  serviceName?: string;       // Servis adı (görüntüleme için)

  // Musteri bilgileri
  clientId?: string;          // Reference to client (eger varsa)
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;

  // Proje bilgileri
  projectTitle?: string;
  projectDescription?: string;

  // Sepet (servisler)
  items: ConfiguredServiceItem[];

  // Maliyet hesaplamalari
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalFixedCostAllocation: number;
  additionalExpenses: number;
  additionalExpensesNote?: string;

  // Ara toplam
  subtotal: number;

  // Indirim
  discount?: QuoteDiscount;
  discountAmount: number;

  // Marj ayarlari
  targetMarginPercent: number;
  safetyBufferPercent: number;

  // Final fiyat
  rawCost: number;            // Dış maliyetler (başkan payı hariç)
  sellPrice: number;          // Satis fiyati
  profit: number;             // Toplam kar (başkan payı + marj)
  actualMarginPercent: number;

  // Maliyet detayları (yeniden hesaplama için)
  ownerLaborCost?: number;    // Başkan payı
  employeeLaborCost?: number; // Çalışan işçilik
  freelancerCost?: number;    // Freelancer işçilik
  equipmentCost?: number;     // Ekipman maliyeti
  overheadCost?: number;      // Genel gider
  manualCost?: number;        // Manuel giderler
  nonDeductibleCost?: number; // Faturasız giderler (gider gösterilemeyen)

  // Zaman tahmini
  totalEstimatedHours: number;
  totalEstimatedDays: number;

  // Durum
  status: QuoteStatus;
  validUntil?: Timestamp;

  // Fatura turu
  billingType: BillingType;
  billingPeriodMonths?: BillingPeriod; // Sadece recurring icin

  // Tarihler
  sentAt?: Timestamp;
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Iliskiler
  leadId?: string;            // Iliskili lead
  projectId?: string;         // Donusturulen proje

  // Meta
  version: number;            // Teklif versiyonu (revizyonlar icin)
  parentQuoteId?: string;     // Revize edilen teklif

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
}

// ============================================
// QUOTE CALCULATION HELPERS
// ============================================

export interface QuoteCalculationInput {
  items: ConfiguredServiceItem[];
  additionalExpenses: number;
  discount?: QuoteDiscount;
  targetMarginPercent: number;
  safetyBufferPercent: number;
}

export interface QuoteCalculationResult {
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalFixedCostAllocation: number;
  subtotal: number;
  discountAmount: number;
  rawCost: number;
  sellPrice: number;
  profit: number;
  actualMarginPercent: number;
  totalEstimatedHours: number;
  totalEstimatedDays: number;
}

export function calculateQuoteTotals(input: QuoteCalculationInput): QuoteCalculationResult {
  const { items, additionalExpenses, discount, targetMarginPercent, safetyBufferPercent } = input;

  // Toplam maliyetler
  const totalLaborCost = items.reduce((sum, item) => sum + item.laborCost * item.quantity, 0);
  const totalEquipmentCost = items.reduce((sum, item) => sum + item.equipmentCost * item.quantity, 0);
  const totalFixedCostAllocation = items.reduce((sum, item) => sum + item.fixedCostAllocation * item.quantity, 0);

  // Ara toplam (override kontrolu)
  const subtotal = items.reduce((sum, item) => {
    if (item.useOverride && item.priceOverride !== undefined) {
      return sum + item.priceOverride * item.quantity;
    }
    return sum + item.subtotal * item.quantity;
  }, 0);

  // Indirim hesaplama
  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = subtotal * (discount.value / 100);
    } else {
      discountAmount = discount.value;
    }
  }

  // Ham maliyet
  const rawCost = subtotal - discountAmount + additionalExpenses;

  // Guvenlik tamponu
  const costWithBuffer = rawCost * (1 + safetyBufferPercent);

  // Satis fiyati (hedef marj ile)
  const sellPrice = targetMarginPercent >= 1
    ? rawCost // Marj %100 veya uzeriyse anlamsiz
    : costWithBuffer / (1 - targetMarginPercent);

  // Kar ve gercek marj
  const profit = sellPrice - rawCost;
  const actualMarginPercent = sellPrice > 0 ? profit / sellPrice : 0;

  // Zaman tahminleri
  const totalEstimatedHours = items.reduce((sum, item) => sum + item.estimatedHours * item.quantity, 0);
  const totalEstimatedDays = items.reduce((sum, item) => sum + item.estimatedDays * item.quantity, 0);

  return {
    totalLaborCost: Math.round(totalLaborCost),
    totalEquipmentCost: Math.round(totalEquipmentCost),
    totalFixedCostAllocation: Math.round(totalFixedCostAllocation),
    subtotal: Math.round(subtotal),
    discountAmount: Math.round(discountAmount),
    rawCost: Math.round(rawCost),
    sellPrice: Math.round(sellPrice),
    profit: Math.round(profit),
    actualMarginPercent,
    totalEstimatedHours,
    totalEstimatedDays,
  };
}

// ============================================
// QUOTE WIZARD TYPES
// ============================================

export type ValidityDays = 7 | 15 | 30;

export interface WizardClientData {
  clientName: string;
  projectName: string;
  projectDescription: string;
  validityDays: ValidityDays;
  billingType: BillingType;
  billingPeriodMonths: BillingPeriod;
}

export interface TeamMemberSelection {
  staffId: string;
  name: string;
  role: string;
  days: number;
  dailyRate: number;
  total: number;
}

export interface EquipmentSelection {
  equipmentId: string;
  name: string;
  category: string;
  days: number;
  dailyRate: number;
  total: number;
}

export interface ExtrasData {
  travel: number;
  accommodation: number;
  stock: number;
  other: number;
  otherDescription?: string;
}

// ============================================
// RENTAL CATALOG (Kiralacek.co)
// ============================================

export interface RentalCatalogItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  dailyPrice: number;
  imageUrl: string;
  sourceUrl: string;
  isActive: boolean;
}

export interface RentalLineItem {
  catalogItemId: string;
  name: string;
  category: string;
  categoryLabel: string;
  dailyPrice: number;
  days: number;
  total: number;
  imageUrl: string;
}

export const DEFAULT_EXTRAS: ExtrasData = {
  travel: 0,
  accommodation: 0,
  stock: 0,
  other: 0,
};

export interface WizardCosts {
  labor: number;
  equipment: number;
  fixedCostShare: number;
  extras: number;
  total: number;
  breakEven: number;
}

export interface QuoteWizardState {
  // Step 1: Client
  client: WizardClientData;

  // Step 2: Category
  category: string | null;

  // Step 3: Service Type
  serviceType: string | null;

  // Step 4: Variables
  variables: Record<string, any>;

  // Step 5: Team & Equipment
  team: TeamMemberSelection[];
  equipment: EquipmentSelection[];

  // Step 5: External crew & rental equipment (Kiralacek)
  externalCrew: RentalLineItem[];
  rentalItems: RentalLineItem[];

  // Step 6: Extras
  extras: ExtrasData;

  // Step 7: Margin
  margin: number; // 0.30 = 30%

  // Calculated
  costs: WizardCosts;
  sellPrice: number;
  profit: number;
}

export const INITIAL_WIZARD_STATE: QuoteWizardState = {
  client: {
    clientName: '',
    projectName: '',
    projectDescription: '',
    validityDays: 30,
    billingType: 'one_time',
    billingPeriodMonths: 12,
  },
  category: null,
  serviceType: null,
  variables: {},
  team: [],
  equipment: [],
  externalCrew: [],
  rentalItems: [],
  extras: { ...DEFAULT_EXTRAS },
  margin: 0.30,
  costs: {
    labor: 0,
    equipment: 0,
    fixedCostShare: 0,
    extras: 0,
    total: 0,
    breakEven: 0,
  },
  sellPrice: 0,
  profit: 0,
};

// ============================================
// QUOTE FILTERING
// ============================================

export interface QuoteFilters {
  status?: QuoteStatus[];
  clientName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minPrice?: number;
  maxPrice?: number;
  createdBy?: string;
}

export interface QuoteSortOptions {
  field: 'createdAt' | 'sellPrice' | 'clientName' | 'status';
  direction: 'asc' | 'desc';
}
