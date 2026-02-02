/**
 * Pesin Odeme Iskonto Hesaplayicisi
 *
 * Turkiye ekonomik verileri baz alinarak NPV (Net Bugunki Deger) yontemiyle
 * 3, 6 ve 12 aylik pesin odemelerde mantikli iskonto oranlarini hesaplar.
 *
 * Parametreler:
 * - Mevduat faiz orani (musterinin firsat maliyeti)
 * - Beklenen enflasyon (paranin zaman degerini etkiler)
 * - Ajans risk primi (tahsilat riski + yonetim tasarrufu)
 *
 * Mantik:
 * Musteri aylik odeme yerine pesin odediginde, mevduatta kazanacagi faizi kaybeder.
 * Ajans ise nakit akis guvencesi, tahsilat riski azalmasi ve yonetim tasarrufu kazanir.
 * Iskonto orani, her iki tarafin da kazancli ciktigi bir denge noktasina ayarlanir.
 */

import {
  EconomicParameters,
  DEFAULT_ECONOMIC_PARAMETERS,
  PrepaymentPeriod,
  PrepaymentTier,
  PREPAYMENT_PERIOD_LABELS,
} from '@/shared/types/pricing/proposal';
import { formatCurrency } from '@/shared/types/pricing/serviceCatalog';

// ============================================
// CORE CALCULATION
// ============================================

/**
 * Aylik bilisik faiz oranini hesapla
 * Yillik oran -> aylik bilisik oran donusumu
 */
function getMonthlyCompoundRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * N aylik odeme serisinin bugunki degerini (PV) hesapla
 * Her ay 1 birim odeme yapildiginda, tum odemelerin bugunki toplam degeri
 *
 * PV = SUM(1 / (1 + r)^i) for i = 0 to N-1
 * i=0 su anki odeme (iskontosuz), i=1 gelecek ayin odemesi, vb.
 */
function calculatePresentValue(months: number, monthlyRate: number): number {
  let pv = 0;
  for (let i = 0; i < months; i++) {
    pv += 1 / Math.pow(1 + monthlyRate, i);
  }
  return pv;
}

/**
 * Adil (fair) iskonto oranini hesapla
 * Musterinin pesin odemesi ile aylik odemesinin NPV farki
 *
 * fairDiscount = 1 - (PV / N)
 * Ornek: 12 ay, PV=10.48 -> fairDiscount = 1 - (10.48/12) = %12.67
 */
function calculateFairDiscount(months: number, annualDepositRate: number): number {
  if (months <= 1) return 0;

  const monthlyRate = getMonthlyCompoundRate(annualDepositRate);
  const pv = calculatePresentValue(months, monthlyRate);
  return 1 - (pv / months);
}

/**
 * Tesvik ek iskontosu hesapla
 * Ajans risk primi + enflasyon korunmasi + yonetim tasarrufu
 * Donem uzadikca tesvik artar (6 ay icin %1.5-2, 12 ay icin %2-3)
 */
function calculateIncentiveExtra(
  months: number,
  params: EconomicParameters
): number {
  if (months <= 1) return 0;

  // Baz tesvik: ajans risk primi
  const baseIncentive = params.agencyRiskPremium;

  // Donem carpani: uzun vadeli taahhut icin ekstra tesvik
  // 3 ay: 0.5x, 6 ay: 0.75x, 12 ay: 1.0x
  const periodMultiplier = Math.min(months / 12, 1);

  return baseIncentive * periodMultiplier;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Tek bir donem icin iskonto hesapla
 */
export function calculatePrepaymentDiscount(
  monthlyPrice: number,
  period: PrepaymentPeriod,
  params: EconomicParameters = DEFAULT_ECONOMIC_PARAMETERS
): PrepaymentTier {
  if (period === 1) {
    return {
      period: 1,
      label: PREPAYMENT_PERIOD_LABELS[1],
      discountPercent: 0,
      fairDiscount: 0,
      incentiveExtra: 0,
      monthlyAmount: monthlyPrice,
      totalWithoutDiscount: monthlyPrice,
      discountAmount: 0,
      totalWithDiscount: monthlyPrice,
      savingsDescription: 'Standart aylik odeme',
    };
  }

  const fairDiscount = calculateFairDiscount(period, params.annualDepositRate);
  const incentiveExtra = calculateIncentiveExtra(period, params);
  const totalDiscount = fairDiscount + incentiveExtra;

  // Yuvarlama: en yakin %0.5'e yuvarla (ornegin %4.8 -> %5.0, %9.7 -> %10.0)
  const roundedDiscount = Math.round(totalDiscount * 200) / 200;

  const totalWithoutDiscount = monthlyPrice * period;
  const discountAmount = Math.round(totalWithoutDiscount * roundedDiscount);
  const totalWithDiscount = totalWithoutDiscount - discountAmount;

  // Aciklama olustur
  const monthlyRate = getMonthlyCompoundRate(params.annualDepositRate);
  const monthlyRatePercent = (monthlyRate * 100).toFixed(1);

  let savingsDescription = '';
  if (period === 3) {
    savingsDescription = `3 aylik pesin odemede %${(roundedDiscount * 100).toFixed(0)} iskonto.`;
  } else if (period === 6) {
    savingsDescription = `6 aylik pesin odemede %${(roundedDiscount * 100).toFixed(0)} iskonto. ${formatCurrency(discountAmount)} tasarruf.`;
  } else if (period === 12) {
    savingsDescription = `Yillik pesin odemede %${(roundedDiscount * 100).toFixed(0)} iskonto. ${formatCurrency(discountAmount)} tasarruf.`;
  }

  return {
    period,
    label: PREPAYMENT_PERIOD_LABELS[period],
    discountPercent: roundedDiscount,
    fairDiscount,
    incentiveExtra,
    monthlyAmount: monthlyPrice,
    totalWithoutDiscount,
    discountAmount,
    totalWithDiscount,
    savingsDescription,
  };
}

/**
 * Tum odeme planlari hesapla (1, 3, 6, 12 ay)
 */
export function calculateAllPaymentPlans(
  monthlyPrice: number,
  params: EconomicParameters = DEFAULT_ECONOMIC_PARAMETERS
): PrepaymentTier[] {
  const periods: PrepaymentPeriod[] = [1, 3, 6, 12];
  return periods.map(period => calculatePrepaymentDiscount(monthlyPrice, period, params));
}

/**
 * Ekonomik parametrelerin ozet raporunu olustur
 */
export function generateEconomicSummary(params: EconomicParameters): string {
  const monthlyRate = getMonthlyCompoundRate(params.annualDepositRate);

  return [
    `TCMB Politika Faizi: %${(params.tcmbPolicyRate * 100).toFixed(1)}`,
    `Yillik Mevduat Faizi: %${(params.annualDepositRate * 100).toFixed(1)}`,
    `Aylik Bilisik Oran: %${(monthlyRate * 100).toFixed(2)}`,
    `Beklenen Enflasyon: %${(params.expectedInflation * 100).toFixed(0)}`,
    `Son Guncelleme: ${params.lastUpdated}`,
  ].join('\n');
}

/**
 * Tek seferlik proje teklifinde de pesin odeme iskontolari sunulabilir
 * Toplu odeme (parcali degil) yapildiginda iskonto uygula
 *
 * Mantik: Proje bedelinin tamami pesin odendiginde,
 * ajans nakit akis guvencesi ve tahsilat riski azalmasi sebebiyle iskonto yapabilir.
 */
export function calculateLumpSumDiscount(
  totalPrice: number,
  params: EconomicParameters = DEFAULT_ECONOMIC_PARAMETERS
): {
  fullPrice: number;
  discountPercent: number;
  discountAmount: number;
  discountedPrice: number;
  description: string;
} {
  // Tek seferlik projelerde: %3 pesin odeme iskontosu
  // (tahsilat riski azalmasi + aninda nakit akis)
  const discountPercent = params.agencyRiskPremium;
  const discountAmount = Math.round(totalPrice * discountPercent);

  return {
    fullPrice: totalPrice,
    discountPercent,
    discountAmount,
    discountedPrice: totalPrice - discountAmount,
    description: `Pesin odemede %${(discountPercent * 100).toFixed(0)} iskonto uygulanir.`,
  };
}
