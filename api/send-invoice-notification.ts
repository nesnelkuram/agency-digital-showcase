import type { VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth.js';
import { invoiceNotificationEmail } from './_lib/emailTemplates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Doğrulanmış domain (diğer çalışan mailler de bunu kullanıyor); test domaini herkese gönderemiyor.
const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <info@intiba.co.uk>';

/**
 * POST /api/send-invoice-notification
 *
 * Admin bir fatura yükleyip gönderdiğinde karşı tarafa (müşteriye)
 * bilgilendirme maili gönderir. Mail, faturanın güvenli görüntüleme/indirme
 * sayfasına (/fatura/:shareToken) yönlendirir.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      recipientEmail,
      recipientName,
      customerName,
      invoiceNumber,
      amountLabel,
      issueDate,
      dueDate,
      description,
      shareToken,
      senderName,
    } = req.body || {};

    if (!recipientEmail || !invoiceNumber || !amountLabel || !shareToken) {
      return res.status(400).json({
        error: 'Zorunlu alanlar eksik: recipientEmail, invoiceNumber, amountLabel, shareToken',
      });
    }

    const appUrl = process.env.APP_URL || 'https://www.intiba.co.uk';
    const viewUrl = `${appUrl}/fatura/${shareToken}`;

    const emailContent = invoiceNotificationEmail({
      recipientName: recipientName || customerName || recipientEmail,
      customerName: customerName || recipientName || recipientEmail,
      invoiceNumber,
      amountLabel,
      issueDate,
      dueDate,
      description,
      viewUrl,
      senderName: senderName || req.userDisplayName || 'intiba ekibi',
    });

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail],
      replyTo: 'info@intiba.co.uk',
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (error) {
      console.error('[send-invoice-notification] Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (err: any) {
    console.error('[send-invoice-notification] Error:', err.message);
    return res.status(500).json({ error: err.message || 'E-posta gönderilemedi' });
  }
});
