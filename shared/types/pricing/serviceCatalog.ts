import { Timestamp } from 'firebase/firestore';
import { ServiceCategory, TimeUnit } from './services';
import { StaffRole, EquipmentCategory } from './fixedCosts';

// ============================================
// COST COMPONENT TYPES (Maliyet Bileseni Tipleri)
// ============================================

export type ComponentType = 'fixed' | 'per_unit' | 'tiered';
export type CostSource = 'staff' | 'equipment' | 'overhead' | 'manual';
export type OverheadAllocationType = 'per_month' | 'per_day' | 'per_hour' | 'fixed';

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  fixed: 'Sabit',
  per_unit: 'Birim Bazli',
  tiered: 'Kademe Bazli',
};

export const COST_SOURCE_LABELS: Record<CostSource, string> = {
  staff: 'Personel',
  equipment: 'Ekipman',
  overhead: 'Genel Gider',
  manual: 'Manuel',
};

// ============================================
// COST REFERENCES (Maliyet Kaynaklari)
// ============================================

// Personel maliyet referansi
export interface StaffCostRef {
  source: 'staff';
  roleType: StaffRole;           // junior, senior, owner, freelancer
  staffId?: string;              // Belirli bir kisi (opsiyonel)
  timeUnit: TimeUnit;            // hours, days, deliverable
  timeAmount: number;            // Gereken sure
}

// Ekipman maliyet referansi
export interface EquipmentCostRef {
  source: 'equipment';
  category: EquipmentCategory;   // camera, lens, lighting, etc.
  equipmentId?: string;          // Belirli ekipman (opsiyonel)
  days: number;                  // Kac gun kullanilacak
}

// Genel gider maliyet referansi
export interface OverheadCostRef {
  source: 'overhead';
  allocationType: OverheadAllocationType;
  amount?: number;               // fixed tipi icin sabit tutar
}

// Manuel maliyet referansi (ulasim, konaklama vb.)
export interface ManualCostRef {
  source: 'manual';
  amount: number;                // Sabit TL tutari
  description: string;           // Aciklama (Ulasim, Konaklama, vb.)
  isDeductible?: boolean;        // Gider gösterilebilir mi? (varsayilan: true)
}

// Tum maliyet referanslari
export type CostRef = StaffCostRef | EquipmentCostRef | OverheadCostRef | ManualCostRef;

// ============================================
// QUANTITY TIERS (Miktar Kademeleri)
// ============================================

export interface QuantityTier {
  minQuantity: number;
  maxQuantity: number | null;    // null = sinirsiz
  unitPriceModifier: number;     // 1.0 = tam fiyat, 0.9 = %10 indirim
  label: string;                 // "1-9 adet", "10-29 adet"
}

export const DEFAULT_QUANTITY_TIERS: QuantityTier[] = [
  { minQuantity: 1, maxQuantity: 9, unitPriceModifier: 1.0, label: '1-9 adet' },
  { minQuantity: 10, maxQuantity: 29, unitPriceModifier: 0.9, label: '10-29 adet' },
  { minQuantity: 30, maxQuantity: null, unitPriceModifier: 0.8, label: '30+ adet' },
];

// ============================================
// SERVICE COMPONENT (Servis Bileseni)
// ============================================

export interface ServiceComponent {
  id: string;
  name: string;                  // "Cekim Gunu", "Reels Kurgu"
  description?: string;

  type: ComponentType;           // fixed, per_unit, tiered

  // Maliyet kaynaklari - bu bilesenin maliyetini olusturan ogeler
  costRefs: CostRef[];

  // per_unit ve tiered tipler icin
  unitLabel?: string;            // "Reels", "Dakika", "Post"
  baseQuantity?: number;         // Varsayilan miktar

  // tiered tipi icin
  quantityTiers?: QuantityTier[];

  // UI ayarlari
  isOptional: boolean;           // Kullanici cikarabilir mi?
  isEditable: boolean;           // Kullanici miktari degistirebilir mi?
  sortOrder: number;
}

// ============================================
// SERVICE TEMPLATE (Servis Sablonu)
// ============================================

export interface ServiceTemplate {
  id: string;

  // Temel bilgiler
  name: string;                  // "Reels Paketi"
  description: string;           // Detayli aciklama
  shortDescription?: string;     // Katalog karti icin kisa aciklama

  // Siniflandirma
  category: ServiceCategory;
  subType?: string;              // VIDEO_SUBTYPES, PHOTOGRAPHY_SUBTYPES, vb.
  tags?: string[];               // Arama/filtreleme icin

  // Bu servisi olusturan bilesenler
  components: ServiceComponent[];

  // Fiyatlandirma kurallari
  minimumPrice?: number;         // Minimum satis fiyati
  defaultMargin: number;         // Varsayilan kar marji (0.30 = %30)
  complexityMultiplier: number;  // 1.0 = standart, 1.5 = karmasik

  // Hizli teklif ayarlari
  allowQuickQuote: boolean;      // Hizli teklif butonu goster
  quickQuoteDefaults?: {
    quantity: number;
    componentOverrides?: Record<string, number>; // componentId -> miktar
  };

  // UI/Gorsel
  icon?: string;                 // Lucide icon adi
  coverImage?: string;           // Kapak resmi URL
  color?: string;                // Vurgu rengi
  isPopular?: boolean;           // Katalogda one cikar
  isActive: boolean;
  sortOrder: number;

  // Meta
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  version: number;               // Sablon versiyonu
}

// ============================================
// LIVE RATES (Canli Oranlar)
// ============================================

export interface LiveRates {
  // Personel saatlik/gunluk oranlari
  staffRates: Record<string, {
    hourlyRate: number;
    dailyRate: number;
    name: string;
    role: StaffRole;
    hasInvoice: boolean;        // Fatura kesiyor mu? (gider dusebilir mi)
  }>;

  // Rol bazli varsayilan oranlar (staffId belirtilmediginde)
  roleRates: Record<StaffRole, {
    hourlyRate: number;
    dailyRate: number;
  }>;

  // Ekipman gunluk oranlari
  equipmentRates: Record<string, {
    dailyRate: number;
    name: string;
    category: EquipmentCategory;
  }>;

  // Kategori bazli varsayilan oranlar
  categoryRates: Record<EquipmentCategory, {
    dailyRate: number;
  }>;

  // Genel gider oranlari
  overhead: {
    monthlyShopCost: number;
    dailyShopCost: number;
    hourlyShopCost: number;
  };

  // Meta
  calculatedAt: Date;
}

// ============================================
// COST CALCULATION RESULT (Maliyet Hesaplama Sonucu)
// ============================================

export interface ComponentCostResult {
  componentId: string;
  componentName: string;
  type: ComponentType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  tierApplied?: string;          // Uygulanan tier etiketi

  // Maliyet dagilimi
  laborCost: number;
  ownerLaborCost: number;        // Ajans baskani iscilik maliyeti
  employeeLaborCost: number;     // Diger calisanlarin iscilik maliyeti
  freelancerCost: number;        // Freelancer iscilik maliyeti
  equipmentCost: number;
  overheadCost: number;
  manualCost: number;

  // Dusebilirlik (vergi hesabi icin)
  deductibleCost: number;        // Faturalanabilir maliyetler
  nonDeductibleCost: number;     // Faturasiz maliyetler

  // Detay
  details: {
    source: CostSource;
    description: string;
    amount: number;
    isDeductible: boolean;       // Bu maliyet dusebilir mi?
  }[];
}

export interface ServiceCostResult {
  templateId: string;
  templateName: string;

  // Bilesen bazli maliyetler
  components: ComponentCostResult[];

  // Toplam maliyet kategorileri
  laborCost: number;
  ownerLaborCost: number;        // Ajans baskani iscilik maliyeti (kar olarak degerlendirilebilir)
  employeeLaborCost: number;     // Diger calisanlarin iscilik maliyeti
  freelancerCost: number;        // Freelancer iscilik maliyeti
  equipmentCost: number;
  overheadCost: number;          // Manuel eklenen overhead
  autoOverheadCost: number;      // Otomatik hesaplanan overhead (sabit calisan saatleri × hourlyShopCost)
  manualCost: number;

  // Otomatik overhead detayi
  nonFreelancerHours: number;    // Sabit calisan toplam saatleri
  hourlyShopCostUsed: number;    // Kullanilan saatlik shop cost

  // Toplamlar
  totalCost: number;             // MALIYET (tum maliyetlerin toplami)
  suggestedPrice: number;        // TEKLIF FIYATI (maliyet + marj)
  margin: number;                // Kullanilan marj orani
  profit: number;                // Kar (suggestedPrice - totalCost)
  profitPercentage: number;      // Kar yuzdesi

  // Dusebilirlik ve vergi hesabi
  deductibleCost: number;        // Faturalanabilir toplam maliyet
  nonDeductibleCost: number;     // Faturasiz toplam maliyet (freelancer vb.)
  taxableIncome: number;         // Vergi matrahi (teklif fiyati - dusebilir giderler)
  estimatedTax: number;          // Tahmini gelir vergisi
  marginalTaxRate: number;       // Marjinal vergi orani (bu islem icin)
  netProfitAfterTax: number;     // Vergi sonrasi net kar

  // Zaman tahmini
  estimatedHours: number;
  estimatedDays: number;

  // Kullanilan oranlar (denetim izi icin)
  ratesSnapshot: LiveRates;

  // Meta
  calculatedAt: Date;
}

// ============================================
// QUICK QUOTE (Hizli Teklif)
// ============================================

export interface QuickQuoteInput {
  templateId: string;
  quantity: number;
  componentQuantities?: Record<string, number>;  // componentId -> miktar
  marginOverride?: number;       // Varsayilan marji degistir
  notes?: string;
}

export interface QuickQuoteResult {
  breakdown: ServiceCostResult;
  formattedCost: string;         // "45.000 TL"
  formattedPrice: string;        // "65.000 TL"
  pricePerUnit?: string;         // "6.500 TL/reels"
  unitLabel?: string;            // "reels"
}

// ============================================
// CATALOG FILTERS (Katalog Filtreleri)
// ============================================

export interface CatalogFilters {
  category?: ServiceCategory;
  subType?: string;
  tags?: string[];
  isPopular?: boolean;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Miktar icin uygulanacak tier'i bul
 */
export function getApplicableTier(
  quantity: number,
  tiers: QuantityTier[]
): QuantityTier | null {
  if (!tiers || tiers.length === 0) return null;

  // Siralama (kucukten buyuge)
  const sortedTiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  for (const tier of sortedTiers) {
    if (
      quantity >= tier.minQuantity &&
      (tier.maxQuantity === null || quantity <= tier.maxQuantity)
    ) {
      return tier;
    }
  }

  return null;
}

/**
 * Para formatla (Turk Lirasi)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Marj ile satis fiyati hesapla
 * Formul: satisPrice = cost / (1 - margin)
 * Ornek: 10000 TL maliyet, %30 marj = 10000 / 0.70 = 14285 TL
 */
export function calculateSellPrice(cost: number, margin: number): number {
  if (margin >= 1) return 0; // %100 veya ustu marj gecersiz
  return Math.round(cost / (1 - margin));
}

/**
 * Kar hesapla
 */
export function calculateProfit(sellPrice: number, cost: number): number {
  return sellPrice - cost;
}

/**
 * Kar yuzdesi hesapla
 */
export function calculateProfitPercentage(sellPrice: number, cost: number): number {
  if (sellPrice === 0) return 0;
  return ((sellPrice - cost) / sellPrice) * 100;
}

// ============================================
// SAMPLE TEMPLATES (Ornek Sablonlar)
// ============================================

export const SAMPLE_REELS_TEMPLATE: Omit<ServiceTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Reels Paketi',
  description: 'Instagram Reels ve TikTok icin kisa video icerigi. Cekim gunu + kurgu dahil.',
  shortDescription: '10-30 adet kisa video icerigi',
  category: 'video_production',
  subType: 'reels_tiktok',
  tags: ['reels', 'tiktok', 'kisa-video', 'sosyal-medya'],

  components: [
    {
      id: 'cekim_gunu',
      name: 'Cekim Gunu',
      description: 'Profesyonel video cekimi (1 tam gun)',
      type: 'fixed',
      costRefs: [
        { source: 'staff', roleType: 'owner', timeUnit: 'days', timeAmount: 1 },
        { source: 'equipment', category: 'camera', days: 1 },
        { source: 'equipment', category: 'lighting', days: 1 },
        { source: 'equipment', category: 'audio', days: 1 },
        { source: 'manual', amount: 500, description: 'Ulasim' },
      ],
      isOptional: false,
      isEditable: true,
      sortOrder: 1,
    },
    {
      id: 'reels_kurgu',
      name: 'Reels Kurgu',
      description: 'Profesyonel video kurgu (adet bazli)',
      type: 'tiered',
      costRefs: [
        { source: 'staff', roleType: 'junior', timeUnit: 'hours', timeAmount: 2 },
        { source: 'overhead', allocationType: 'per_hour' },
      ],
      unitLabel: 'Reels',
      baseQuantity: 10,
      quantityTiers: DEFAULT_QUANTITY_TIERS,
      isOptional: false,
      isEditable: true,
      sortOrder: 2,
    },
    {
      id: 'genel_gider',
      name: 'Genel Gider Payi',
      description: 'Proje surecindeki sabit gider payi',
      type: 'fixed',
      costRefs: [
        { source: 'overhead', allocationType: 'per_day' },
      ],
      isOptional: false,
      isEditable: false,
      sortOrder: 3,
    },
  ],

  minimumPrice: 25000,
  defaultMargin: 0.30,
  complexityMultiplier: 1.0,

  allowQuickQuote: true,
  quickQuoteDefaults: {
    quantity: 10,
  },

  icon: 'Video',
  color: '#8B5CF6',
  isPopular: true,
  isActive: true,
  sortOrder: 1,
  version: 1,
};

export const SAMPLE_CEKIM_GUNU_TEMPLATE: Omit<ServiceTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Cekim Gunu',
  description: 'Profesyonel video veya fotograf cekimi icin tek gunluk hizmet.',
  shortDescription: 'Tek gunluk profesyonel cekim',
  category: 'video_production',
  subType: 'corporate_film',
  tags: ['cekim', 'video', 'fotograf', 'gunluk'],

  components: [
    {
      id: 'cekim',
      name: 'Cekim',
      description: 'Profesyonel cekim (1 tam gun)',
      type: 'per_unit',
      costRefs: [
        { source: 'staff', roleType: 'owner', timeUnit: 'days', timeAmount: 1 },
        { source: 'equipment', category: 'camera', days: 1 },
        { source: 'equipment', category: 'lighting', days: 1 },
        { source: 'equipment', category: 'audio', days: 1 },
        { source: 'overhead', allocationType: 'per_day' },
      ],
      unitLabel: 'Gun',
      baseQuantity: 1,
      isOptional: false,
      isEditable: true,
      sortOrder: 1,
    },
    {
      id: 'ulasim',
      name: 'Ulasim',
      description: 'Lokasyona ulasim masrafi',
      type: 'fixed',
      costRefs: [
        { source: 'manual', amount: 500, description: 'Ulasim' },
      ],
      isOptional: true,
      isEditable: true,
      sortOrder: 2,
    },
  ],

  minimumPrice: 10000,
  defaultMargin: 0.35,
  complexityMultiplier: 1.0,

  allowQuickQuote: true,
  quickQuoteDefaults: {
    quantity: 1,
  },

  icon: 'Camera',
  color: '#EC4899',
  isPopular: true,
  isActive: true,
  sortOrder: 2,
  version: 1,
};
