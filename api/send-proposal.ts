import type { VercelRequest, VercelResponse } from '@vercel/node';
import { proposalSentEmail } from './_lib/emailTemplates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      recipientEmail,
      recipientName,
      companyName,
      projectTitle,
      proposalNumber,
      proposalId,
      grandTotal,
      validityDays,
      shareUrl,
      senderName,
      servicesSummary,
    } = req.body;

    if (!recipientEmail || !recipientName || !shareUrl) {
      return res.status(400).json({ error: 'recipientEmail, recipientName, shareUrl zorunlu' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[send-proposal] RESEND_API_KEY is not set');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const emailContent = proposalSentEmail({
      recipientName,
      companyName: companyName || 'intiba.',
      projectTitle: projectTitle || 'Dijital Hizmet Teklifi',
      proposalNumber: proposalNumber || 'TASLAK',
      grandTotal: grandTotal || '0',
      validityDays: validityDays || 30,
      shareUrl,
      senderName: senderName || 'intiba Dijital Medya',
      servicesSummary,
    });

    const { data, error } = await resend.emails.send({
      from: 'intiba <info@intiba.co.uk>',
      to: [recipientEmail],
      replyTo: 'info@intiba.co.uk',
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (error) {
      console.error('[send-proposal] Resend error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Log activity to proposal subcollection
    if (proposalId) {
      try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');

        if (getApps().length === 0) {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
          });
        }

        const adminDb = getFirestore();
        await adminDb
          .collection('proposals')
          .doc(proposalId)
          .collection('activity')
          .add({
            type: 'email_sent',
            recipientEmail,
            recipientName,
            subject: emailContent.subject,
            messageId: data?.id || null,
            createdAt: new Date(),
          });
      } catch (logErr) {
        console.error('[send-proposal] Activity log error (non-fatal):', logErr);
      }
    }

    console.log('[send-proposal] Proposal email sent:', data?.id, 'to:', recipientEmail);
    return res.status(200).json({ success: true, messageId: data?.id });
  } catch (error: any) {
    console.error('[send-proposal] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
