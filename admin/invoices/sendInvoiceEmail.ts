import { auth } from '@/lib/firebase/config';
import { formatInvoiceAmount } from '@/shared/types/invoice';
import type { Invoice } from '@/shared/types/invoice';
import { Timestamp } from 'firebase/firestore';

function fmtDate(ts?: Timestamp): string | undefined {
  if (!ts) return undefined;
  try {
    const d = typeof (ts as any).toDate === 'function' ? (ts as any).toDate() : new Date((ts as any).seconds * 1000);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return undefined;
  }
}

/**
 * Karşı tarafa (müşteriye) fatura bildirim maili gönderir.
 * /api/send-invoice-notification endpoint'ini çağırır (withAuth korumalı).
 */
export async function sendInvoiceEmail(invoice: Invoice, senderName?: string): Promise<{ messageId?: string }> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

  const res = await fetch('/api/send-invoice-notification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipientEmail: invoice.recipientEmail,
      recipientName: invoice.recipientName,
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      amountLabel: formatInvoiceAmount(invoice.amount, invoice.currency),
      issueDate: fmtDate(invoice.issueDate),
      dueDate: fmtDate(invoice.dueDate),
      description: invoice.description,
      shareToken: invoice.shareToken,
      senderName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'E-posta gönderilemedi');
  }
  return res.json();
}
