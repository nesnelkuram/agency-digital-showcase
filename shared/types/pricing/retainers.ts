import { Timestamp } from 'firebase/firestore';

// ============================================
// RETAINER MODELS
// ============================================

export type RetainerModel = 'hours' | 'deliverables' | 'fixed_fee' | 'hybrid';

export const RETAINER_MODEL_LABELS: Record<RetainerModel, string> = {
  hours: 'Saat Paketi',
  deliverables: 'Teslimat Paketi',
  fixed_fee: 'Sabit Ucret',
  hybrid: 'Karma',
};

export const RETAINER_MODEL_DESCRIPTIONS: Record<RetainerModel, string> = {
  hours: 'Aylik belirli saat hizmet hakki',
  deliverables: 'Aylik belirli adet icerik/teslimat',
  fixed_fee: 'Ne yapilirsa yapilsin sabit aylik ucret',
  hybrid: 'Saat + teslimat kombinasyonu',
};

// ============================================
// HOUR PACKAGE
// ============================================

export interface HourPackage {
  includedHours: number;        // Dahil edilen saat
  hourlyRateOverage: number;    // Asim ucreti (saat basi)
  rolloverHours: boolean;       // Kullanilmayan saatler aktarilsin mi
  maxRolloverHours?: number;    // Maksimum aktarilabilir saat
}

// ============================================
// DELIVERABLE PACKAGE
// ============================================

export interface DeliverableItem {
  id: string;
  serviceId?: string;           // Iliskili servis (opsiyonel)
  name: string;                 // Ornek: "Instagram Post", "YouTube Video"
  quantity: number;             // Aylik adet
  unitPrice: number;            // Birim fiyat
}

export interface DeliverablePackage {
  deliverables: DeliverableItem[];
  additionalDeliverableRate?: number;  // Ekstra teslimat ucreti (yuzde artis)
}

// ============================================
// HYBRID PACKAGE
// ============================================

export interface HybridPackage {
  hours: HourPackage;
  deliverables: DeliverablePackage;
  hoursForDeliverables: boolean;  // Teslimatlar da saatten mi dusulsun
}

// ============================================
// BILLING
// ============================================

export type BillingCycle = 'monthly' | 'quarterly' | 'biannually' | 'annually';
export type RenewalType = 'manual' | 'auto';

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Aylik',
  quarterly: '3 Aylik',
  biannually: '6 Aylik',
  annually: 'Yillik',
};

// ============================================
// RETAINER CONTRACT
// ============================================

export interface RetainerContract {
  id: string;

  // Musteri
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;

  // Model secimi
  model: RetainerModel;

  // Paket detaylari (modele gore)
  hourPackage?: HourPackage;
  deliverablePackage?: DeliverablePackage;
  hybridPackage?: HybridPackage;
  fixedFee?: number;

  // Fiyatlandirma
  monthlyFee: number;
  setupFee?: number;            // Bir seferlik kurulum ucreti

  // Sozlesme donemi
  startDate: Timestamp;
  endDate?: Timestamp;          // null = suersiz
  minimumCommitmentMonths?: number;

  // Yenileme
  renewalType: RenewalType;
  billingCycle: BillingCycle;
  nextBillingDate?: Timestamp;

  // Ozel sartlar
  notes?: string;
  specialTerms?: string;

  // Durum
  isActive: boolean;
  pausedAt?: Timestamp;
  pauseReason?: string;
  cancelledAt?: Timestamp;
  cancellationReason?: string;

  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================
// RETAINER USAGE (Donem Bazli Kullanim)
// ============================================

export interface UsageEntry {
  id: string;
  date: Timestamp;
  description: string;

  // Saat bazli
  hours?: number;

  // Teslimat bazli
  deliverableId?: string;
  deliverableName?: string;
  quantity?: number;

  // Iliskiler
  projectId?: string;
  taskId?: string;

  // Meta
  loggedBy: string;
  loggedByName: string;
  createdAt: Timestamp;
}

export interface RetainerUsagePeriod {
  id: string;
  retainerId: string;

  // Donem
  periodStart: Timestamp;
  periodEnd: Timestamp;

  // Saat kullanimi
  usedHours: number;
  includedHours: number;
  overageHours: number;
  rolloverHoursUsed: number;
  rolloverHoursAvailable: number;

  // Teslimat kullanimi
  usedDeliverables: Record<string, number>;  // deliverableId -> count

  // Maliyet
  baseFee: number;
  overageFee: number;
  totalFee: number;

  // Durum
  isClosed: boolean;
  closedAt?: Timestamp;

  // Detayli kayitlar
  entries: UsageEntry[];

  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// RETAINER CALCULATION HELPERS
// ============================================

export interface UsageSummary {
  hoursUsed: number;
  hoursRemaining: number;
  hoursOverage: number;
  utilizationPercent: number;

  deliverablesUsed: Record<string, { used: number; included: number; remaining: number }>;

  estimatedOverageCost: number;
  daysUntilPeriodEnd: number;
}

export function calculateUsageSummary(
  contract: RetainerContract,
  currentPeriod: RetainerUsagePeriod
): UsageSummary {
  const now = new Date();
  const periodEnd = currentPeriod.periodEnd.toDate();
  const daysUntilPeriodEnd = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let hoursUsed = 0;
  let hoursRemaining = 0;
  let hoursOverage = 0;
  let utilizationPercent = 0;
  let estimatedOverageCost = 0;

  // Saat hesaplamalari
  if (contract.hourPackage || contract.hybridPackage?.hours) {
    const hourPackage = contract.hourPackage || contract.hybridPackage?.hours;
    if (hourPackage) {
      hoursUsed = currentPeriod.usedHours;
      const totalIncluded = hourPackage.includedHours + currentPeriod.rolloverHoursAvailable;
      hoursRemaining = Math.max(0, totalIncluded - hoursUsed);
      hoursOverage = Math.max(0, hoursUsed - totalIncluded);
      utilizationPercent = totalIncluded > 0 ? (hoursUsed / totalIncluded) * 100 : 0;
      estimatedOverageCost = hoursOverage * hourPackage.hourlyRateOverage;
    }
  }

  // Teslimat hesaplamalari
  const deliverablesUsed: Record<string, { used: number; included: number; remaining: number }> = {};

  if (contract.deliverablePackage || contract.hybridPackage?.deliverables) {
    const deliverablePackage = contract.deliverablePackage || contract.hybridPackage?.deliverables;
    if (deliverablePackage) {
      for (const item of deliverablePackage.deliverables) {
        const used = currentPeriod.usedDeliverables[item.id] || 0;
        deliverablesUsed[item.id] = {
          used,
          included: item.quantity,
          remaining: Math.max(0, item.quantity - used),
        };
      }
    }
  }

  return {
    hoursUsed,
    hoursRemaining,
    hoursOverage,
    utilizationPercent,
    deliverablesUsed,
    estimatedOverageCost,
    daysUntilPeriodEnd,
  };
}

// ============================================
// RETAINER FILTERING
// ============================================

export interface RetainerFilters {
  model?: RetainerModel[];
  isActive?: boolean;
  clientName?: string;
  minMonthlyFee?: number;
  maxMonthlyFee?: number;
}
