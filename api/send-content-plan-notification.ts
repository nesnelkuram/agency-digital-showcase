import type { VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth';
import {
  contentPlanSubmittedEmail,
  contentPlanApprovedEmail,
  contentPlanRevisionEmail,
} from './_lib/emailTemplates';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <onboarding@resend.dev>';

/**
 * POST /api/send-content-plan-notification
 *
 * type: 'submitted'         → client email (admin submits plan for approval)
 * type: 'approved'          → team email (client approved the plan)
 * type: 'revision_requested'→ team email (client wants revision)
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      type,
      recipientEmail,
      recipientName,
      senderName,
      planTitle,
      shareUrl,
      adminUrl,
      weekRange,
      comment,
    } = req.body || {};

    if (!type || !recipientEmail || !planTitle) {
      return res.status(400).json({
        error: 'Zorunlu alanlar eksik: type, recipientEmail, planTitle',
      });
    }

    let emailContent: { subject: string; html: string };

    switch (type) {
      case 'submitted': {
        if (!shareUrl) {
          return res.status(400).json({ error: "'submitted' tipi için shareUrl zorunlu" });
        }
        emailContent = contentPlanSubmittedEmail({
          recipientName: recipientName || recipientEmail,
          senderName: senderName || req.userDisplayName || 'intiba ekibi',
          planTitle,
          shareUrl,
          weekRange,
        });
        break;
      }

      case 'approved': {
        emailContent = contentPlanApprovedEmail({
          recipientName: recipientName || recipientEmail,
          approvedByName: senderName || 'Müşteri',
          planTitle,
          adminUrl: adminUrl || (process.env.APP_URL ? `${process.env.APP_URL}/admin/social-media` : '/admin/social-media'),
        });
        break;
      }

      case 'revision_requested': {
        emailContent = contentPlanRevisionEmail({
          recipientName: recipientName || recipientEmail,
          requestedByName: senderName || 'Müşteri',
          planTitle,
          comment,
          adminUrl: adminUrl || (process.env.APP_URL ? `${process.env.APP_URL}/admin/social-media` : '/admin/social-media'),
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Geçersiz bildirim tipi: ${type}` });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (error) {
      console.error('[send-content-plan-notification] Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (err: any) {
    console.error('[send-content-plan-notification] Error:', err.message);
    return res.status(500).json({ error: err.message || 'E-posta gönderilemedi' });
  }
});
