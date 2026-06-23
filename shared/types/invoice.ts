import { Timestamp } from 'firebase/firestore';

// ============================================
// INVOICE STATUS (Fatura Durumu)
// ============================================

export type InvoiceStatus =
  | 'draft' // Taslak — henüz gönderilmedi
  | 'sent' // Gönderildi — müşteriye bildirim maili atıldı
  | 'paid' // Ödendi
  | 'overdue' // Vadesi geçti
  | 'cancelled'; // İptal edildi

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  paid: 'Ödendi',
  overdue: 'Vadesi Geçti',
  cancelled: 'İptal',
};

export const INVOICE_STATUS_COLORS: Record<
  InvoiceStatus,
  { dot: string; bg: string; text: string; border: string }
> = {
  draft: { dot: 'bg-neutral-400', bg: 'bg-neutral-50', text: 'text-neutral-600', border: 'border-neutral-200' },
  sent: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  paid: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  overdue: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  cancelled: { dot: 'bg-neutral-400', bg: 'bg-neutral-100', text: 'text-neutral-500', border: 'border-neutral-200' },
};

// ============================================
// CURRENCY (Para Birimi)
// ============================================

export type InvoiceCurrency = 'TRY' | 'USD' | 'EUR' | 'GBP';

export const INVOICE_CURRENCY_LABELS: Record<InvoiceCurrency, string> = {
  TRY: '₺ Türk Lirası',
  USD: '$ Dolar',
  EUR: '€ Euro',
  GBP: '£ Sterlin',
};

export const INVOICE_CURRENCY_SYMBOLS: Record<InvoiceCurrency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// ============================================
// INVOICE (Fatura)
// ============================================

export interface Invoice {
  id: string;
  tenantId: string;

  // Tanımlayıcılar
  invoiceNumber: string; // Fatura no (ör: "2026-0042")
  description?: string; // Açıklama / hizmet özeti

  // Alıcı (karşı taraf)
  customerId?: string; // pricing/data/customers referansı (seçildiyse)
  customerName: string; // Müşteri/Şirket adı
  recipientEmail: string; // Bildirim maili gönderilecek adres
  recipientName?: string; // İletişim kişisi

  // Tutar
  amount: number;
  currency: InvoiceCurrency;

  // Tarihler
  issueDate: Timestamp; // Düzenlenme tarihi
  dueDate?: Timestamp; // Son ödeme tarihi

  // Dosya (Storage'a yüklenen PDF)
  pdfUrl: string;
  pdfFileName: string;
  pdfSize?: number;

  // Durum & paylaşım
  status: InvoiceStatus;
  shareToken: string; // Public görüntüleme/indirme sayfası için

  // E-posta & görüntüleme takibi
  sentAt?: Timestamp;
  lastEmailMessageId?: string;
  viewedAt?: Timestamp; // Müşteri faturayı ilk açtığında
  paidAt?: Timestamp;

  // Meta
  createdBy: string;
  createdByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// HELPERS
// ============================================

/**
 * Tutarı para birimi sembolü ile formatlar (tr-TR formatı).
 */
export function formatInvoiceAmount(amount: number, currency: InvoiceCurrency): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${INVOICE_CURRENCY_SYMBOLS[currency]}${formatted}`;
}

/**
 * Public görüntüleme sayfası için benzersiz, tahmin edilemez token üretir.
 * (Proje genelinde share token standardı.)
 */
export function generateInvoiceShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
