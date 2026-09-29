import type { VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth.js';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { checkProjectAccess } from './_lib/projectAccess.js';
import { PERMISSIONS } from '../lib/rbac/permissions.js';
import {
  contentPlanSubmittedEmail,
  contentPlanApprovedEmail,
  contentPlanRevisionEmail,
  internalReviewNeededEmail,
  internalApprovedEmail,
  internalRevisionEmail,
  partialApprovalEmail,
} from './_lib/emailTemplates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM || 'intiba <onboarding@resend.dev>';

/**
 * POST /api/send-content-plan-notification
 *
 * type: 'submitted'              → client email (admin submits plan for approval)
 * type: 'approved'               → team email (client approved the plan)
 * type: 'revision_requested'     → team email (client wants revision)
 * type: 'internal_review_needed' → AM email (editor submits for internal review)
 * type: 'internal_approved'      → editor email (AM approved internal review)
 * type: 'internal_revision'      → editor email (AM wants internal revision)
 * type: 'partial_approval'       → team email (client partially approved)
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      type,
      planId,
      recipientEmail: rawRecipientEmail,
      recipientName,
      senderName,
      weekRange,
      comment,
      approvedCount,
      totalCount,
      brandName,
      postCount,
    } = req.body || {};

    if (!type || typeof planId !== 'string' || !planId || typeof rawRecipientEmail !== 'string') {
      return res.status(400).json({ error: 'Zorunlu alanlar eksik: type, planId, recipientEmail' });
    }

    // Plan erişimi: gönderen planın projesine yetkili olmalı (müşteri rolü e-posta gönderemez)
    const db = getAdminDb();
    const planDoc = await db.collection('content_plans').doc(planId).get();
    if (!planDoc.exists) return res.status(404).json({ error: 'İçerik planı bulunamadı' });
    const plan = planDoc.data() || {};
    const access = await checkProjectAccess(req, plan.projectId, PERMISSIONS.APPROVALS_SUBMIT);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });

    // Alıcı serbest değil: müşteri e-postası plana atanmış adres, ekip e-postası tenant kullanıcısı olmalı
    const recipientEmail = rawRecipientEmail.trim().toLowerCase();
    if (type === 'submitted') {
      if (!plan.assignedClientEmail || plan.assignedClientEmail !== recipientEmail) {
        return res.status(400).json({ error: 'Alıcı, plana atanmış müşteri e-postası olmalı' });
      }
    } else {
      const userSnap = await db
        .collection('users')
        .where('tenantId', '==', req.tenantId)
        .where('email', '==', recipientEmail)
        .limit(1)
        .get();
      if (userSnap.empty) return res.status(400).json({ error: 'Alıcı bu ekibin bir üyesi olmalı' });
    }

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const planTitle: string = plan.title || 'İçerik planı';
    const shareUrl = `${appUrl}/icerik-plani/${plan.shareToken}`;
    const adminUrl = `${appUrl}/admin/social-media`;

    let emailContent: { subject: string; html: string };

    switch (type) {
      case 'submitted': {
        emailContent = contentPlanSubmittedEmail({
          recipientName: recipientName || recipientEmail,
          senderName: senderName || req.userDisplayName || 'intiba ekibi',
          planTitle,
          shareUrl,
          weekRange,
          brandName,
          postCount,
        });
        break;
      }

      case 'approved': {
        emailContent = contentPlanApprovedEmail({
          recipientName: recipientName || recipientEmail,
          approvedByName: senderName || 'Müşteri',
          planTitle,
          adminUrl,
        });
        break;
      }

      case 'revision_requested': {
        emailContent = contentPlanRevisionEmail({
          recipientName: recipientName || recipientEmail,
          requestedByName: senderName || 'Müşteri',
          planTitle,
          comment,
          adminUrl,
        });
        break;
      }

      case 'internal_review_needed': {
        emailContent = internalReviewNeededEmail({
          recipientName: recipientName || recipientEmail,
          submittedByName: senderName || req.userDisplayName || 'Editor',
          planTitle,
          adminUrl,
        });
        break;
      }

      case 'internal_approved': {
        emailContent = internalApprovedEmail({
          recipientName: recipientName || recipientEmail,
          approvedByName: senderName || req.userDisplayName || 'Account Manager',
          planTitle,
          adminUrl,
        });
        break;
      }

      case 'internal_revision': {
        emailContent = internalRevisionEmail({
          recipientName: recipientName || recipientEmail,
          requestedByName: senderName || req.userDisplayName || 'Account Manager',
          planTitle,
          comment,
          adminUrl,
        });
        break;
      }

      case 'partial_approval': {
        emailContent = partialApprovalEmail({
          recipientName: recipientName || recipientEmail,
          approvedByName: senderName || 'Musteri',
          planTitle,
          approvedCount: approvedCount || 0,
          totalCount: totalCount || 0,
          adminUrl,
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Geçersiz bildirim tipi: ${type}` });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [recipientEmail],
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
