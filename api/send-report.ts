import type { VercelRequest, VercelResponse } from '@vercel/node';
import { newLeadNotificationEmail } from './_lib/emailTemplates.js';

// Public endpoint — no auth required (wizard form is filled by anonymous users)
// Only sends to hardcoded info@intiba.co.uk, no abuse risk
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      submissionId,
      submissionTime,
      name,
      businessName,
      email,
      phone,
      requestedServices,
      serviceCount,
      sector,
      stage0, stage0Score,
      stage1, stage1Score,
      stage2, stage2Score,
      stage3, stage3Score,
      stage4, stage4Score,
    } = req.body;

    if (!name || !businessName || !email) {
      return res.status(400).json({ error: 'name, businessName, email zorunlu' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[send-report] RESEND_API_KEY is not set');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const emailContent = newLeadNotificationEmail({
      submissionId: submissionId || 'N/A',
      submissionTime: submissionTime || new Date().toLocaleString('tr-TR'),
      name,
      businessName,
      email,
      phone: phone || 'Belirtilmedi',
      sector: sector || 'Belirtilmedi',
      requestedServices: requestedServices || 'Belirtilmedi',
      serviceCount: serviceCount || 0,
      stages: [
        { label: 'Operasyonel Gerçeklik', result: stage0, score: stage0Score },
        { label: 'Marka Ruhu', result: stage1, score: stage1Score },
        { label: 'Marka Karakteri', result: stage2, score: stage2Score },
        { label: 'Kim Değiliz', result: stage3, score: stage3Score },
        { label: 'Hedef ve Başarı', result: stage4, score: stage4Score },
      ],
    });

    const { data, error } = await resend.emails.send({
      from: 'intiba <info@intiba.co.uk>',
      to: ['info@intiba.co.uk'],
      replyTo: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (error) {
      console.error('[send-report] Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('[send-report] New lead notification sent:', data?.id, 'for:', businessName);
    return res.status(200).json({ success: true, messageId: data?.id });

  } catch (error: any) {
    console.error('[send-report] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
