/**
 * Sabit Gider Hesaplama Servisi
 *
 * Tüm sabit giderleri (ofis, yazılım, pazarlama, ekipman) toplar
 * ve günlük/saatlik shop cost hesaplar.
 */

import { Firestore, collection, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import type {
  OverheadCost,
  SoftwareSubscription,
  MarketingCost,
  Equipment,
} from '@/shared/types/pricing';
import { DEFAULT_PRICING_CONFIG } from '@/shared/types/pricing';

// ============================================
// TYPES
// ============================================

export interface FixedCostsSummary {
  // Aylık toplamlar
  monthlyOffice: number;
  monthlySoftware: number;
  monthlyMarketing: number;
  monthlyEquipment: number;
  monthlyTotal: number;

  // Gider gösterilebilir ayrımı (vergi matrahı için)
  deductibleMonthlyTotal: number;    // Faturalı, gider gösterilebilir
  nonDeductibleMonthlyTotal: number; // Faturasız, gider gösterilemeyen

  // Günlük/saatlik
  dailyShopCost: number;
  hourlyShopCost: number;

  // Detay sayıları
  officeItemCount: number;
  softwareItemCount: number;
  marketingItemCount: number;
  equipmentItemCount: number;

  // Meta
  calculatedAt: Date;
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ekipman için aylık maliyet hesapla
 * - Amortisman: purchasePrice / usefulLifeMonths
 * - Kiralama değeri: rentalValueDaily * workingDays
 */
function calculateEquipmentMonthlyCost(
  equipment: Equipment,
  workingDays: number
): number {
  if (equipment.costMethod === 'rental_value' && equipment.rentalValueDaily) {
    return equipment.rentalValueDaily * workingDays;
  }
  if (equipment.costMethod === 'depreciation' && equipment.usefulLifeMonths && equipment.usefulLifeMonths > 0) {
    return equipment.purchasePrice / equipment.usefulLifeMonths;
  }
  return 0;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Firestore'dan tüm sabit giderleri çek ve topla
 */
export async function calculateFixedCostsSummary(
  db: Firestore
): Promise<FixedCostsSummary> {
  const workingDays = DEFAULT_PRICING_CONFIG.workingDaysPerMonth;
  const workingHours = DEFAULT_PRICING_CONFIG.hoursPerDay;

  // Parallel olarak tüm collection'ları çek
  const [officeSnapshot, softwareSnapshot, marketingSnapshot, equipmentSnapshot] = await Promise.all([
    getDocs(collection(db, 'pricing', 'data', 'overhead')),
    getDocs(collection(db, 'pricing', 'data', 'software')),
    getDocs(collection(db, 'pricing', 'data', 'marketing')),
    getDocs(collection(db, 'pricing', 'data', 'equipment')),
  ]);

  // Ofis giderleri - sadece aktif ve reel olanları al
  const officeItems = officeSnapshot.docs
    .map((d) => d.data() as OverheadCost)
    .filter((item) => item.isActive && item.status === 'real');
  const monthlyOffice = officeItems.reduce((sum, item) => sum + (item.monthlyCost || 0), 0);
  const deductibleOffice = officeItems
    .filter((item) => item.isDeductible !== false)
    .reduce((sum, item) => sum + (item.monthlyCost || 0), 0);

  // Yazılım giderleri
  const softwareItems = softwareSnapshot.docs
    .map((d) => d.data() as SoftwareSubscription)
    .filter((item) => item.isActive && item.status === 'real');
  const monthlySoftware = softwareItems.reduce((sum, item) => sum + (item.monthlyCost || 0), 0);
  const deductibleSoftware = softwareItems
    .filter((item) => item.isDeductible !== false)
    .reduce((sum, item) => sum + (item.monthlyCost || 0), 0);

  // Pazarlama giderleri
  const marketingItems = marketingSnapshot.docs
    .map((d) => d.data() as MarketingCost)
    .filter((item) => item.isActive && item.status === 'real');
  const monthlyMarketing = marketingItems.reduce((sum, item) => sum + (item.monthlyCost || 0), 0);
  const deductibleMarketing = marketingItems
    .filter((item) => item.isDeductible !== false)
    .reduce((sum, item) => sum + (item.monthlyCost || 0), 0);

  // Ekipman amortismanı/kiralama değeri
  const equipmentItems = equipmentSnapshot.docs
    .map((d) => d.data() as Equipment)
    .filter((item) => item.isActive && item.status === 'real');
  const monthlyEquipment = equipmentItems.reduce(
    (sum, item) => sum + calculateEquipmentMonthlyCost(item, workingDays),
    0
  );
  // Ekipman için fatura her zaman var (amortisman gider gösterilebilir)
  const deductibleEquipment = monthlyEquipment;

  // Toplam
  const monthlyTotal = monthlyOffice + monthlySoftware + monthlyMarketing + monthlyEquipment;
  const deductibleMonthlyTotal = deductibleOffice + deductibleSoftware + deductibleMarketing + deductibleEquipment;
  const nonDeductibleMonthlyTotal = monthlyTotal - deductibleMonthlyTotal;

  // Günlük ve saatlik maliyetler
  const dailyShopCost = workingDays > 0 ? monthlyTotal / workingDays : 0;
  const hourlyShopCost = workingHours > 0 ? dailyShopCost / workingHours : 0;

  const summary: FixedCostsSummary = {
    monthlyOffice,
    monthlySoftware,
    monthlyMarketing,
    monthlyEquipment,
    monthlyTotal,
    deductibleMonthlyTotal,
    nonDeductibleMonthlyTotal,
    dailyShopCost,
    hourlyShopCost,
    officeItemCount: officeItems.length,
    softwareItemCount: softwareItems.length,
    marketingItemCount: marketingItems.length,
    equipmentItemCount: equipmentItems.length,
    calculatedAt: new Date(),
    workingDaysPerMonth: workingDays,
    workingHoursPerDay: workingHours,
  };

  return summary;
}

/**
 * Summary'yi Firestore'a kaydet (cache amaçlı)
 */
export async function saveFixedCostsSummary(
  db: Firestore,
  summary: FixedCostsSummary
): Promise<void> {
  await setDoc(doc(db, 'pricing', 'config', 'cache', 'fixedCostsSummary'), {
    ...summary,
    calculatedAt: Timestamp.fromDate(summary.calculatedAt),
  });
}

/**
 * Firestore'dan cached summary'yi oku
 * Yoksa veya eski ise null döner
 */
export async function getCachedFixedCostsSummary(
  db: Firestore,
  maxAgeMinutes: number = 60
): Promise<FixedCostsSummary | null> {
  try {
    const docSnap = await getDoc(doc(db, 'pricing', 'config', 'cache', 'fixedCostsSummary'));

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const calculatedAt = data.calculatedAt?.toDate?.() || new Date(0);
    const ageMinutes = (Date.now() - calculatedAt.getTime()) / (1000 * 60);

    // Cache çok eski ise null döner
    if (ageMinutes > maxAgeMinutes) {
      return null;
    }

    return {
      ...data,
      calculatedAt,
    } as FixedCostsSummary;
  } catch {
    return null;
  }
}

/**
 * Ana fonksiyon: Cache'den oku veya hesapla
 * Her zaman güncel veri döner
 */
export async function getOrCalculateFixedCostsSummary(
  db: Firestore,
  forceRecalculate: boolean = false
): Promise<FixedCostsSummary> {
  // Force recalculate değilse, cache'i kontrol et
  if (!forceRecalculate) {
    const cached = await getCachedFixedCostsSummary(db);
    if (cached) {
      return cached;
    }
  }

  // Hesapla
  const summary = await calculateFixedCostsSummary(db);

  // Cache'e kaydet (arka planda, bekleme)
  saveFixedCostsSummary(db, summary).catch((err) => {
    console.error('Error saving fixed costs summary to cache:', err);
  });

  return summary;
}

/**
 * Summary'yi invalidate et (gider değiştiğinde çağır)
 */
export async function invalidateFixedCostsSummary(db: Firestore): Promise<void> {
  // Yeni hesaplama yap ve kaydet
  const summary = await calculateFixedCostsSummary(db);
  await saveFixedCostsSummary(db, summary);
}
