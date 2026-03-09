import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth.js';
import { wizardInvitationEmail } from './_lib/emailTemplates.js';

const SECTOR_LABELS: Record<string, string> = {
  gastronomi: 'Gastronomi',
  retail: 'Perakende',
  corporate: 'Kurumsal',
  tech: 'Teknoloji',
  health: 'Sağlık & Wellness',
  education: 'Eğitim',
  fmcg: 'Gıda & FMCG',
  showroom: 'Yapı & Dekorasyon',
  other: 'Diğer',
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipientName, recipientEmail, businessName, sector } = req.body;

    if (!recipientName || !recipientEmail || !businessName || !sector) {
      return res.status(400).json({
        error: 'Eksik alanlar: recipientName, recipientEmail, businessName, sector zorunlu',
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[send-wizard-invitation] RESEND_API_KEY is not set');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const appUrl = process.env.APP_URL
      ? process.env.APP_URL
      : process.env.VERCEL_URL
        ? (process.env.VERCEL_URL.includes('localhost') ? `http://${process.env.VERCEL_URL}` : `https://${process.env.VERCEL_URL}`)
        : 'http://localhost:5173';

    const wizardUrl = `${appUrl}/brand-strategy?sector=${sector}&ref=email_invite`;
    const sectorLabel = SECTOR_LABELS[sector] || sector;

    const emailContent = wizardInvitationEmail({
      recipientName,
      businessName,
      sectorLabel,
      wizardUrl,
      senderName: 'intiba',
    });

    const { data, error } = await resend.emails.send({
      from: 'intiba <info@intiba.co.uk>',
      to: [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (error) {
      console.error('[send-wizard-invitation] Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    console.log('[send-wizard-invitation] Email sent:', data?.id, 'to:', recipientEmail);
    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (err: any) {
    console.error('[send-wizard-invitation] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
