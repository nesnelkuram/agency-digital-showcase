import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 5,
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, messageIndex, feedback, correction, assistantMessage, articlesUsed } =
      req.body || {};

    if (!sessionId || messageIndex === undefined || !feedback) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, messageIndex, feedback',
      });
    }

    if (feedback !== 'positive' && feedback !== 'negative') {
      return res.status(400).json({ error: 'feedback must be "positive" or "negative"' });
    }

    const db = getAdminDb();

    // Save feedback document
    await db.collection('persona_feedback').add({
      sessionId,
      messageIndex,
      feedback,
      correction: correction || null,
      assistantMessage: assistantMessage || '',
      articlesUsed: articlesUsed || [],
      timestamp: Date.now(),
    });

    // Update session feedback counters
    const counterField = feedback === 'positive' ? 'feedbackCount.positive' : 'feedbackCount.negative';
    await db.collection('persona_sessions').doc(sessionId).update({
      [counterField]: FieldValue.increment(1),
      lastFeedbackAt: Date.now(),
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('persona/feedback error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Feedback save failed'),
    });
  }
});
