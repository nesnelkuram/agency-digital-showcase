import type { VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 10,
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { templateId } = req.body || {};
    const sessionId = randomUUID();
    const db = getAdminDb();

    await db.collection('workflow_builder_chat_sessions').doc(sessionId).set({
      id: sessionId,
      tenantId: req.tenantId || '',
      userId: req.userId || '',
      templateId: templateId || null,
      title: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      lastCanvasSnapshot: null,
    });

    return res.status(200).json({ sessionId });
  } catch (error: any) {
    console.error('workflow/builder-chat-start error:', error?.message);
    return res.status(500).json({
      error: String(error?.message || 'Failed to start builder chat session'),
    });
  }
});
