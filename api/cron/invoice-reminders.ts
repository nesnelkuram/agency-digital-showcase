import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { invoiceReminderEmail } from '../_lib/emailTemplates.js';

export const config = { maxDuration: 60 };

const resend = new Resend(process.env.RESEND_API_KEY);
// Doğrulanmış domain — müşteriye (kendi adresimiz dışına) gönderebilmek için.
const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <info@intiba.co.uk>';
const APP_URL = process.env.APP_URL || 'https://www.intiba.co.uk';

const CURRENCY_SYMBOLS: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

function formatAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || '';
  return `${sym}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/cron/invoice-reminders  — günlük
 *
 * 'Gönderildi'/'Vadesi geçti' durumundaki, son ödeme tarihi olan faturalar için
 * müşteriye vade hatırlatma maili gönderir. Her eşik (3 gün kala / vade günü /
 * vade geçti) yalnızca bir kez gönderilir (sentReminderLeadDays ile spam engellenir).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('invoices')
      .where('status', 'in', ['sent', 'overdue'])
      .limit(500)
      .get();

    const now = new Date();
    const nowMs = now.getTime();
    const DAY = 86_400_000;

    let processed = 0;
    let emailSent = 0;
    let emailFailed = 0;

    for (const docSnap of snap.docs) {
      const inv: any = docSnap.data();
      const due = toDate(inv.dueDate);
      if (!due || !inv.recipientEmail || !inv.shareToken) continue;
      processed++;

      const daysLeft = Math.ceil((due.getTime() - nowMs) / DAY);
      const sent: number[] = Array.isArray(inv.sentReminderLeadDays) ? inv.sentReminderLeadDays : [];

      // Hangi eşik? (en yakın, henüz gönderilmemiş)
      let milestone: number | null = null;
      if (daysLeft < 0 && !sent.includes(-1)) milestone = -1; // vade geçti
      else if (daysLeft <= 0 && !sent.includes(0)) milestone = 0; // vade günü
      else if (daysLeft <= 3 && !sent.includes(3)) milestone = 3; // 3 gün kala

      if (milestone === null) continue;

      const { subject, html } = invoiceReminderEmail({
        recipientName: inv.recipientName || inv.customerName || inv.recipientEmail,
        customerName: inv.customerName || inv.recipientEmail,
        invoiceNumber: inv.invoiceNumber || '-',
        amountLabel: formatAmount(Number(inv.amount) || 0, inv.currency || 'TRY'),
        dueDate: due.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }),
        daysLeft,
        viewUrl: `${APP_URL}/fatura/${inv.shareToken}`,
        senderName: inv.createdByName || 'intiba ekibi',
      });

      try {
        const { error } = await resend.emails.send({
          from: FROM_ADDRESS,
          to: inv.recipientEmail,
          replyTo: 'info@intiba.co.uk',
          subject,
          html,
        });
        if (error) {
          emailFailed++;
          console.error('[invoice-reminders] Resend error:', error);
          continue;
        }
        emailSent++;

        const update: any = {
          sentReminderLeadDays: [...sent, milestone],
          lastReminderAt: now,
        };
        // Vadesi geçtiyse durumu güncelle
        if (daysLeft < 0 && inv.status === 'sent') update.status = 'overdue';
        await docSnap.ref.update(update);
      } catch (err: any) {
        emailFailed++;
        console.error('[invoice-reminders] send failed:', err.message);
      }
    }

    return res.status(200).json({ success: true, processed, emailSent, emailFailed });
  } catch (err: any) {
    console.error('[invoice-reminders] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Cron failed' });
  }
}
