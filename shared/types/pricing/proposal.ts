import { Timestamp } from 'firebase/firestore';
import { QuoteStatus } from './quotes';

// ============================================
// PREPAYMENT DISCOUNT (Pesin Odeme Iskontosu)
// ============================================

export type PrepaymentPeriod = 1 | 3 | 6 | 12;

export interface EconomicParameters {
  annualDepositRate: number;      // Yillik mevduat faiz orani (0.355 = %35.5)
  expectedInflation: number;      // Beklenen enflasyon orani (0.23 = %23)
  tcmbPolicyRate: number;         // TCMB politika faizi (0.07 = %7)
  agencyRiskPremium: number;      // Ajans risk primi - tahsilat riski vb. (0.02 = %2)
  lastUpdated: string;            // Son guncelleme tarihi (ISO string)
}

export const DEFAULT_ECONOMIC_PARAMETERS: EconomicParameters = {
  annualDepositRate: 0.355,       // %35.5 (Subat 2026)
  expectedInflation: 0.23,        // %23 (2026 sonu beklentisi)
  tcmbPolicyRate: 0.07,           // %7 (Subat 2026)
  agencyRiskPremium: 0.025,       // %2.5 (tahsilat riski + yonetim maliyeti)
  lastUpdated: '2026-02-02',
};

export interface PrepaymentTier {
  period: PrepaymentPeriod;
  label: string;
  discountPercent: number;        // 0.05 = %5
  fairDiscount: number;           // NPV bazli adil iskonto
  incentiveExtra: number;         // Tesvik ek iskontosu
  monthlyAmount: number;          // Aylik odeme tutari
  totalWithoutDiscount: number;   // Iskontosuz toplam
  discountAmount: number;         // Iskonto tutari
  totalWithDiscount: number;      // Iskontolu toplam
  savingsDescription: string;     // Aciklama
}

export const PREPAYMENT_PERIOD_LABELS: Record<PrepaymentPeriod, string> = {
  1: 'Aylik Odeme',
  3: '3 Aylik Pesin',
  6: '6 Aylik Pesin',
  12: 'Yillik Pesin',
};

// ============================================
// PROPOSAL STATUS
// ============================================

export type ProposalDocStatus = 'draft' | 'ready' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

export const PROPOSAL_STATUS_LABELS: Record<ProposalDocStatus, string> = {
  draft: 'Taslak',
  ready: 'Hazir',
  sent: 'Gonderildi',
  viewed: 'Goruntulendi',
  accepted: 'Kabul Edildi',
  rejected: 'Reddedildi',
  expired: 'Suresi Doldu',
};

export const PROPOSAL_STATUS_COLORS: Record<ProposalDocStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  ready: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

// ============================================
// PROPOSAL SECTION (Teklif Bolumu)
// ============================================

export interface ProposalServiceLine {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface ProposalTerms {
  paymentTerms: string;           // Odeme kosullari
  deliveryTimeline: string;       // Teslim suresi
  revisionPolicy: string;         // Revizyon politikasi
  cancellationPolicy: string;     // Iptal politikasi
  additionalNotes?: string;       // Ek notlar
}

export const DEFAULT_PROPOSAL_TERMS: ProposalTerms = {
  paymentTerms: 'Odeme, fatura tarihinden itibaren 7 is gunu icerisinde yapilmalidir.',
  deliveryTimeline: 'Proje baslangic tarihi, odemenin alinmasindan itibaren 5 is gunu icerisinde belirlenir.',
  revisionPolicy: 'Teklif kapsaminda 2 (iki) adet revizyon hakki bulunmaktadir. Ek revizyonlar ayri ucretlendirilir.',
  cancellationPolicy: 'Projenin iptal edilmesi durumunda, tamamlanan is oraninda ucretlendirme yapilir.',
};

// ============================================
// PROPOSAL DOCUMENT (Teklif Dokumani)
// ============================================

export interface ProposalDocument {
  id: string;

  // Kaynak teklif
  quoteId: string;
  quoteVersion: number;

  // Lead baglantisi (opsiyonel)
  leadId?: string;

  // Teklif numarasi
  proposalNumber: string;         // TEK-2026-001 formatinda

  // Firma bilgileri (gonderen)
  companyName: string;
  companyTitle: string;           // Unvan
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTaxId?: string;          // Vergi No
  companyTaxOffice?: string;      // Vergi Dairesi
  companyLogo?: string;           // Logo URL

  // Musteri bilgileri (alan)
  clientName: string;
  clientCompany?: string;
  clientTitle?: string;           // Unvan
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientTaxId?: string;
  clientTaxOffice?: string;

  // Proje bilgileri
  projectTitle: string;
  projectDescription: string;
  projectScope?: string;          // Kapsam

  // Hizmet kalemleri
  serviceLines: ProposalServiceLine[];

  // Maliyet ozeti (dahili - musteriye gosterilmez)
  internalCost: number;
  internalMargin: number;

  // Fiyatlandirma (musteriye gosterilen)
  subtotal: number;               // Ara toplam
  discountPercent?: number;       // Genel iskonto
  discountAmount: number;         // Iskonto tutari
  netTotal: number;               // Net toplam (KDV haric)
  kdvRate: number;                // KDV orani (0.20 = %20)
  kdvAmount: number;              // KDV tutari
  grandTotal: number;             // Genel toplam (KDV dahil)

  // Odeme planlari
  paymentPlans: PrepaymentTier[];

  // Ekonomik parametreler (snapshot)
  economicParameters: EconomicParameters;

  // Kosullar
  terms: ProposalTerms;

  // Gecerlilik
  validityDays: number;
  validUntil: Timestamp;

  // Durum
  status: ProposalDocStatus;

  // Tarihler
  sentAt?: Timestamp;
  viewedAt?: Timestamp;
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
  acceptedPlan?: PrepaymentPeriod;  // Kabul edilen odeme plani

  // Public share
  shareToken?: string;            // Token for public share link

  // Meta
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  version: number;
}

// ============================================
// PROPOSAL GENERATION INPUT
// ============================================

export interface ProposalGenerationInput {
  quoteId: string;
  clientCompany?: string;
  clientTitle?: string;
  clientAddress?: string;
  clientTaxId?: string;
  clientTaxOffice?: string;
  projectDescription: string;
  projectScope?: string;
  validityDays: number;
  economicParameters?: EconomicParameters;
  terms?: Partial<ProposalTerms>;
}

// ============================================
// HELPER: Teklif numarasi formatla
// ============================================

export function generateProposalNumber(sequenceNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequenceNumber).padStart(3, '0');
  return `TEK-${year}-${padded}`;
}
