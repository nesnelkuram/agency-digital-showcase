import { Timestamp } from 'firebase/firestore';

// ============================================
// COST STATUS (Maliyet Durumu)
// ============================================

export type CostStatus = 'real' | 'potential';

export const COST_STATUS_LABELS: Record<CostStatus, string> = {
  real: 'Reel',
  potential: 'Potansiyel',
};

// ============================================
// STAFF (Personel)
// ============================================

export type StaffRole = 'junior' | 'senior' | 'owner' | 'freelancer';

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  junior: 'Junior',
  senior: 'Senior',
  owner: 'Ajans Sahibi',
  freelancer: 'Freelancer',
};

// ============================================
// STAFF BENEFITS (Yan Haklar)
// ============================================

export interface StaffBenefits {
  mealCard: number;           // Yemek karti
  transportation: number;     // Yol masrafi
  healthInsurance: number;    // Ozel saglik sigortasi
  other: number;              // Diger yan haklar
}

export const DEFAULT_STAFF_BENEFITS: StaffBenefits = {
  mealCard: 6600,
  transportation: 2000,
  healthInsurance: 1500,
  other: 0,
};

export const DEFAULT_UTILIZATION_RATE = 0.75; // %75 verimlilik

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  monthlySalary: number;        // Brut maas
  netSalary?: number;           // Net maas (UI icin)
  socialSecurityCost: number;   // SGK isci + isveren payi
  benefits?: StaffBenefits;     // Yan haklar
  utilizationRate?: number;     // Verimlilik orani (0.50-1.00, varsayilan 0.75)
  sgkIncentive?: boolean;       // 5 puan SGK tesviki var mi (varsayilan: true)
  taxMonth?: number;            // Vergi hesabi icin ay (1-12, varsayilan: 1)
  status: CostStatus;           // 'real' = Reel, 'potential' = Potansiyel
  isActive: boolean;
  notes?: string;

  // Freelancer icin dogrudan saatlik ucret
  freelancerHourlyRate?: number;  // Freelancer'in saat ucreti (maas yerine)

  // Elden odeme (kayit disi)
  cashPayment?: number;           // Elden odenen tutar (SGK haric, FBLR'ye eklenir)

  // Fatura durumu (vergi hesabi icin)
  hasInvoice?: boolean;           // Fatura kesiyor mu? (varsayilan: calisan=true, freelancer=false)

  // Calculated (frontend'de hesaplanir)
  totalMonthlyCost?: number;    // maas + SGK
  totalBurdenedCost?: number;   // maas + SGK + yan haklar (FBLR)
  hourlyRate?: number;          // totalBurdenedCost / billableHours
  dailyRate?: number;           // totalBurdenedCost / workingDays
  breakEvenHourly?: number;     // Basabas saatlik ucret

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// EQUIPMENT (Ekipman)
// ============================================

export type EquipmentCategory = 'camera' | 'lens' | 'lighting' | 'audio' | 'computer' | 'drone' | 'accessory' | 'other';
export type EquipmentCostMethod = 'depreciation' | 'rental_value';

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  camera: 'Kamera',
  lens: 'Lens',
  lighting: 'Isik',
  audio: 'Ses',
  computer: 'Bilgisayar',
  drone: 'Drone',
  accessory: 'Aksesuar',
  other: 'Diger',
};

export const EQUIPMENT_COST_METHOD_LABELS: Record<EquipmentCostMethod, string> = {
  depreciation: 'Amortisman',
  rental_value: 'Kiralama Degeri',
};

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;

  // Deger bilgileri
  purchasePrice: number;
  purchaseDate?: Timestamp;

  // Maliyet hesaplama yontemi
  costMethod: EquipmentCostMethod;

  // Amortisman icin
  usefulLifeMonths?: number;    // Faydali omur (ay)

  // Kiralama degeri icin
  rentalValueDaily?: number;    // Gunluk kiralama degeri

  status: CostStatus;           // 'real' = Reel, 'potential' = Potansiyel
  isActive: boolean;
  notes?: string;

  // Calculated
  monthlyDepreciation?: number;
  dailyRate?: number;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// SOFTWARE (Yazilim Abonelikleri)
// ============================================

export type SoftwareCategory = 'design' | 'video' | 'productivity' | 'hosting' | 'marketing' | 'other';

export const SOFTWARE_CATEGORY_LABELS: Record<SoftwareCategory, string> = {
  design: 'Tasarim',
  video: 'Video',
  productivity: 'Uretkenlik',
  hosting: 'Hosting',
  marketing: 'Pazarlama',
  other: 'Diger',
};

export interface SoftwareSubscription {
  id: string;
  name: string;
  category: SoftwareCategory;
  description?: string;
  monthlyCost: number;
  billingCycle?: 'monthly' | 'yearly';
  status: CostStatus;           // 'real' = Reel, 'potential' = Potansiyel
  isActive: boolean;
  notes?: string;

  // Gider gösterme durumu (vergi hesabı için)
  isDeductible?: boolean;       // Fatura var mı / gider gösterilebilir mi? (varsayılan: true)

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// OVERHEAD (Genel Giderler)
// ============================================

export type OverheadCategory = 'office' | 'utilities' | 'insurance' | 'accounting' | 'legal' | 'misc';

export const OVERHEAD_CATEGORY_LABELS: Record<OverheadCategory, string> = {
  office: 'Ofis',
  utilities: 'Faturalar',
  insurance: 'Sigorta',
  accounting: 'Muhasebe',
  legal: 'Hukuki',
  misc: 'Diger',
};

// Kira Vergi Tipi
export type RentTaxType = 'none' | 'stopaj' | 'kdv' | 'both';

export const RENT_TAX_TYPE_LABELS: Record<RentTaxType, string> = {
  none: 'Yok',
  stopaj: 'Stopaj',
  kdv: 'KDV',
  both: 'Stopaj + KDV',
};

// Fiyat Giris Tipi (vergi dahil/haric)
export type PriceEntryType = 'net' | 'kdv_included' | 'gross' | 'total';

export const PRICE_ENTRY_TYPE_LABELS: Record<PriceEntryType, string> = {
  net: 'Net (Vergi Haric)',
  kdv_included: 'KDV Dahil',
  gross: 'Brut (Stopaj Dahil)',
  total: 'Toplam (Tum Vergiler Dahil)',
};

// Varsayilan vergi oranlari
export const DEFAULT_STOPAJ_RATE = 0.20;  // %20
export const DEFAULT_KDV_RATE = 0.20;     // %20

export interface OverheadCost {
  id: string;
  name: string;
  category: OverheadCategory;
  description?: string;         // Aciklama
  enteredAmount: number;        // Kullanicinin girdigi tutar
  baseCost: number;             // Hesaplanmis net tutar
  monthlyCost: number;          // Hesaplanmis toplam maliyet
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';

  // Vergi secenekleri
  taxType?: RentTaxType;        // Vergi tipi: yok, stopaj, kdv, ikisi de
  priceEntryType?: PriceEntryType; // Fiyat giris tipi: net, kdv dahil, brut, toplam
  stopajRate?: number;          // Stopaj orani (varsayilan %20)
  kdvRate?: number;             // KDV orani (varsayilan %20)

  // Hesaplanan vergi tutarlari (UI icin)
  calculatedStopaj?: number;    // Hesaplanan stopaj tutari
  calculatedKdv?: number;       // Hesaplanan KDV tutari

  taxIncluded?: boolean;        // Eski alan (geriye uyumluluk)
  status: CostStatus;           // 'real' = Reel, 'potential' = Potansiyel
  isActive: boolean;
  notes?: string;

  // Gider gösterme durumu (vergi hesabı için)
  isDeductible?: boolean;       // Fatura var mı / gider gösterilebilir mi? (varsayılan: true)

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// MARKETING (Pazarlama Giderleri)
// ============================================

export type MarketingCategory = 'advertising' | 'social_media' | 'content' | 'events' | 'other';

export const MARKETING_CATEGORY_LABELS: Record<MarketingCategory, string> = {
  advertising: 'Reklam',
  social_media: 'Sosyal Medya',
  content: 'Icerik',
  events: 'Etkinlik',
  other: 'Diger',
};

export interface MarketingCost {
  id: string;
  name: string;
  category: MarketingCategory;
  description?: string;
  monthlyCost: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  taxIncluded?: boolean;
  status: CostStatus;
  isActive: boolean;
  notes?: string;

  // Gider gösterme durumu (vergi hesabı için)
  isDeductible?: boolean;       // Fatura var mı / gider gösterilebilir mi? (varsayılan: true)

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// FIXED COSTS CONFIG (Ana Yapilandirma)
// ============================================

export interface PricingConfig {
  workingDaysPerMonth: number;  // Default: 20
  hoursPerDay: number;          // Default: 8
  defaultSafetyBuffer: number;  // Default: 0.10 (%10)
  defaultTargetMargin: number;  // Default: 0.30 (%30)
  currency: string;             // Default: 'TRY'
  quoteValidityDays: number;    // Default: 30

  // Vergi hesabi icin
  estimatedAnnualIncome?: number;  // Tahmini yillik gelir (vergi dilimi icin)

  updatedAt?: Timestamp;
  updatedBy?: string;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  workingDaysPerMonth: 20,
  hoursPerDay: 8,
  defaultSafetyBuffer: 0.10,
  defaultTargetMargin: 0.30,
  currency: 'TRY',
  quoteValidityDays: 30,
  estimatedAnnualIncome: 400000,   // 400K TL varsayilan (%27 vergi dilimi)
};

// ============================================
// GELIR VERGISI DILIMLERI
// ============================================

export interface TaxBracket {
  minIncome: number;
  maxIncome: number | null;  // null = sinirsiz
  rate: number;              // 0.15 = %15
  label: string;
}

// 2024 Gelir Vergisi Dilimleri (eski - geriye uyumluluk icin)
export const TAX_BRACKETS_2024: TaxBracket[] = [
  { minIncome: 0,        maxIncome: 110000,   rate: 0.15, label: '%15 (0 - 110.000 TL)' },
  { minIncome: 110000,   maxIncome: 230000,   rate: 0.20, label: '%20 (110.000 - 230.000 TL)' },
  { minIncome: 230000,   maxIncome: 580000,   rate: 0.27, label: '%27 (230.000 - 580.000 TL)' },
  { minIncome: 580000,   maxIncome: 3000000,  rate: 0.35, label: '%35 (580.000 - 3.000.000 TL)' },
  { minIncome: 3000000,  maxIncome: null,     rate: 0.40, label: '%40 (3.000.000 TL ustu)' },
];

// 2025 Gelir Vergisi Dilimleri (guncel)
export const TAX_BRACKETS_2026: TaxBracket[] = [
  { minIncome: 0,         maxIncome: 190000,   rate: 0.15, label: '%15 (0 - 190.000 TL)' },
  { minIncome: 190000,    maxIncome: 400000,   rate: 0.20, label: '%20 (190.000 - 400.000 TL)' },
  { minIncome: 400000,    maxIncome: 1000000,  rate: 0.27, label: '%27 (400.000 - 1.000.000 TL)' },
  { minIncome: 1000000,   maxIncome: 5300000,  rate: 0.35, label: '%35 (1.000.000 - 5.300.000 TL)' },
  { minIncome: 5300000,   maxIncome: null,     rate: 0.40, label: '%40 (5.300.000 TL ustu)' },
];

// Aktif vergi dilimleri (2026 kullan)
export const TAX_BRACKETS = TAX_BRACKETS_2026;

// Detayli vergi sonucu
export interface TaxCalculationResult {
  totalTax: number;               // Toplam vergi
  effectiveRate: number;          // Efektif oran (toplam vergi / gelir)
  marginalRate: number;           // Marjinal oran (son dilim)
  breakdown: TaxBracketBreakdown[];  // Dilim bazli detay
}

export interface TaxBracketBreakdown {
  bracket: TaxBracket;
  incomeInBracket: number;        // Bu dilimdeki gelir
  taxInBracket: number;           // Bu dilimden odenen vergi
}

/**
 * Yillik gelire gore uygulanacak marjinal vergi dilimini bul
 */
export function getApplicableTaxBracket(annualIncome: number, brackets: TaxBracket[] = TAX_BRACKETS): TaxBracket {
  for (const bracket of brackets) {
    if (bracket.maxIncome === null || annualIncome <= bracket.maxIncome) {
      return bracket;
    }
  }
  // En yuksek dilimi don (guvenlik icin)
  return brackets[brackets.length - 1];
}

/**
 * Dilimli gelir vergisi hesapla (kumulatif)
 * Her dilim icin o dilimdeki miktar * dilim orani
 */
export function calculateProgressiveTax(taxableIncome: number, brackets: TaxBracket[] = TAX_BRACKETS): number {
  if (taxableIncome <= 0) return 0;

  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize = bracket.maxIncome !== null
      ? bracket.maxIncome - bracket.minIncome
      : Infinity;

    const incomeInBracket = Math.min(remainingIncome, bracketSize);
    const taxInBracket = incomeInBracket * bracket.rate;

    totalTax += taxInBracket;
    remainingIncome -= incomeInBracket;
  }

  return Math.round(totalTax);
}

/**
 * Detayli dilimli vergi hesabi - projeksiyon icin
 */
export function calculateProgressiveTaxDetailed(taxableIncome: number, brackets: TaxBracket[] = TAX_BRACKETS): TaxCalculationResult {
  if (taxableIncome <= 0) {
    return {
      totalTax: 0,
      effectiveRate: 0,
      marginalRate: 0.15,
      breakdown: [],
    };
  }

  const breakdown: TaxBracketBreakdown[] = [];
  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize = bracket.maxIncome !== null
      ? bracket.maxIncome - bracket.minIncome
      : Infinity;

    const incomeInBracket = Math.min(remainingIncome, bracketSize);
    const taxInBracket = incomeInBracket * bracket.rate;

    if (incomeInBracket > 0) {
      breakdown.push({
        bracket,
        incomeInBracket: Math.round(incomeInBracket),
        taxInBracket: Math.round(taxInBracket),
      });
    }

    totalTax += taxInBracket;
    remainingIncome -= incomeInBracket;
  }

  const marginalBracket = getApplicableTaxBracket(taxableIncome, brackets);

  return {
    totalTax: Math.round(totalTax),
    effectiveRate: totalTax / taxableIncome,
    marginalRate: marginalBracket.rate,
    breakdown,
  };
}

/**
 * Ortalama vergi oranini hesapla (toplam vergi / gelir)
 */
export function calculateEffectiveTaxRate(annualIncome: number): number {
  if (annualIncome <= 0) return 0;
  const totalTax = calculateProgressiveTax(annualIncome);
  return totalTax / annualIncome;
}

/**
 * Marjinal vergi oranini getir (son TL icin odenen oran)
 */
export function getMarginalTaxRate(annualIncome: number): number {
  const bracket = getApplicableTaxBracket(annualIncome);
  return bracket.rate;
}

// ============================================
// AGGREGATED FIXED COSTS (Hesaplanmis Toplamlar)
// ============================================

export interface FixedCostsSummary {
  // Personel
  totalStaffCost: number;
  staffCount: number;

  // Ekipman
  totalEquipmentCost: number;
  equipmentCount: number;

  // Yazilim
  totalSoftwareCost: number;
  softwareCount: number;

  // Genel giderler
  totalOverheadCost: number;
  overheadCount: number;

  // Hedef gelir (ajans sahibi)
  ownerTargetMonthly: number;

  // Toplamlar
  totalMonthlyBurnRate: number;       // Tum giderler (hedef haric)
  totalMonthlyWithTarget: number;     // Tum giderler + hedef

  // Birim maliyetler
  dailyShopCost: number;              // totalMonthlyWithTarget / workingDaysPerMonth
  hourlyShopCost: number;             // dailyShopCost / hoursPerDay

  // Meta
  calculatedAt: Date;
}

// ============================================
// CALCULATION HELPERS
// ============================================

export interface StaffRatesResult {
  // Eski alanlar (geriye uyumluluk)
  totalMonthlyCost: number;     // maas + SGK
  hourlyRate: number;           // FBLR bazli saatlik (verimlilik dahil)
  dailyRate: number;            // FBLR bazli gunluk

  // Yeni detayli alanlar
  totalBenefits: number;        // Yan haklar toplami
  cashPayment: number;          // Elden odeme (kayit disi)
  totalBurdenedCost: number;    // Tam yuklu maliyet (FBLR)
  billableHours: number;        // Faturalanabilir saat (varsayilan 120)
  breakEvenHourly: number;      // Basabas saatlik ucret
  utilizationRate: number;      // Kullanilan verimlilik orani
}

export function calculateStaffRates(
  staff: StaffMember,
  config: PricingConfig
): StaffRatesResult {
  // Freelancer icin dogrudan saatlik ucret kullan
  if (staff.role === 'freelancer' && staff.freelancerHourlyRate) {
    const hourlyRate = staff.freelancerHourlyRate;
    const dailyRate = hourlyRate * config.hoursPerDay;

    return {
      totalMonthlyCost: 0,
      totalBenefits: 0,
      cashPayment: 0,
      totalBurdenedCost: 0,
      billableHours: 0,
      utilizationRate: 1, // Freelancer icin %100 verimlilik
      hourlyRate: Math.round(hourlyRate),
      dailyRate: Math.round(dailyRate),
      breakEvenHourly: Math.round(hourlyRate),
    };
  }

  // Temel maliyetler (resmi)
  const totalMonthlyCost = staff.monthlySalary + staff.socialSecurityCost;

  // Yan haklar toplami
  const benefits = staff.benefits || DEFAULT_STAFF_BENEFITS;
  const totalBenefits = benefits.mealCard + benefits.transportation + benefits.healthInsurance + benefits.other;

  // Elden odeme (kayit disi - SGK yok)
  const cashPayment = staff.cashPayment || 0;

  // Tam yuklu maliyet (FBLR - Fully Burdened Labor Rate)
  // Resmi maliyet + yan haklar + elden odeme
  const totalBurdenedCost = totalMonthlyCost + totalBenefits + cashPayment;

  // Verimlilik orani
  const utilizationRate = staff.utilizationRate ?? DEFAULT_UTILIZATION_RATE;

  // Faturalanabilir saatler (160 * verimlilik orani)
  const totalMonthlyHours = config.hoursPerDay * config.workingDaysPerMonth; // 160
  const billableHours = totalMonthlyHours * utilizationRate; // varsayilan 120

  // Saatlik ve gunluk oranlar (FBLR uzerinden)
  const hourlyRate = totalBurdenedCost / billableHours;
  const dailyRate = totalBurdenedCost / config.workingDaysPerMonth;

  // Basabas noktasi = tam maliyet / faturalanabilir saatler
  const breakEvenHourly = hourlyRate; // Kar marji 0 oldugunda

  return {
    totalMonthlyCost: Math.round(totalMonthlyCost),
    totalBenefits: Math.round(totalBenefits),
    cashPayment: Math.round(cashPayment),
    totalBurdenedCost: Math.round(totalBurdenedCost),
    billableHours: Math.round(billableHours),
    utilizationRate,
    hourlyRate: Math.round(hourlyRate),
    dailyRate: Math.round(dailyRate),
    breakEvenHourly: Math.round(breakEvenHourly),
  };
}

export function calculateEquipmentDailyRate(
  equipment: Equipment,
  config: PricingConfig
): number {
  if (equipment.costMethod === 'rental_value') {
    return equipment.rentalValueDaily || 0;
  }

  // Amortisman yontemi
  if (!equipment.usefulLifeMonths || equipment.usefulLifeMonths <= 0) {
    return 0;
  }

  // Gunluk amortisman = Satin alma fiyati / (Faydali omur * calisma gunu)
  const usefulLifeDays = equipment.usefulLifeMonths * config.workingDaysPerMonth;
  const dailyDepreciation = equipment.purchasePrice / usefulLifeDays;

  // Kiralama carpani (amortisman + kar + yipranma payi)
  const rentalMultiplier = 2.5;

  return Math.round(dailyDepreciation * rentalMultiplier);
}

export function calculateFixedCostsSummary(
  staff: StaffMember[],
  equipment: Equipment[],
  software: SoftwareSubscription[],
  overhead: OverheadCost[],
  ownerTargetMonthly: number,
  config: PricingConfig
): FixedCostsSummary {
  // Aktif kayitlari filtrele
  const activeStaff = staff.filter(s => s.isActive);
  const activeEquipment = equipment.filter(e => e.isActive);
  const activeSoftware = software.filter(s => s.isActive);
  const activeOverhead = overhead.filter(o => o.isActive);

  // Personel maliyeti (FBLR - tam yuklu maliyet kullan)
  const totalStaffCost = activeStaff.reduce((sum, s) => {
    const rates = calculateStaffRates(s, config);
    return sum + rates.totalBurdenedCost; // FBLR kullan
  }, 0);

  // Ekipman maliyeti (aylik)
  const totalEquipmentCost = activeEquipment.reduce((sum, e) => {
    const dailyRate = calculateEquipmentDailyRate(e, config);
    return sum + (dailyRate * config.workingDaysPerMonth);
  }, 0);

  // Yazilim maliyeti
  const totalSoftwareCost = activeSoftware.reduce((sum, s) => sum + s.monthlyCost, 0);

  // Genel giderler
  const totalOverheadCost = activeOverhead.reduce((sum, o) => sum + o.monthlyCost, 0);

  // Toplamlar
  const totalMonthlyBurnRate = totalStaffCost + totalEquipmentCost + totalSoftwareCost + totalOverheadCost;
  const totalMonthlyWithTarget = totalMonthlyBurnRate + ownerTargetMonthly;

  // Birim maliyetler
  const dailyShopCost = totalMonthlyWithTarget / config.workingDaysPerMonth;
  const hourlyShopCost = dailyShopCost / config.hoursPerDay;

  return {
    totalStaffCost,
    staffCount: activeStaff.length,
    totalEquipmentCost,
    equipmentCount: activeEquipment.length,
    totalSoftwareCost,
    softwareCount: activeSoftware.length,
    totalOverheadCost,
    overheadCount: activeOverhead.length,
    ownerTargetMonthly,
    totalMonthlyBurnRate,
    totalMonthlyWithTarget,
    dailyShopCost: Math.round(dailyShopCost),
    hourlyShopCost: Math.round(hourlyShopCost),
    calculatedAt: new Date(),
  };
}
