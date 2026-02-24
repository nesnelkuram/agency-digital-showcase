import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('task_intake_sessions').doc();

    const sessionData = {
      id: sessionRef.id,
      tenantId: req.tenantId,
      createdBy: req.userId,
      status: 'in_progress',
      messages: [],
      taskDraft: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await sessionRef.set(sessionData);

    return res.status(200).json({ sessionId: sessionRef.id });
  } catch (error: any) {
    console.error('tasks/create-intake-session error:', error);
    return res.status(500).json({ error: String(error?.message || 'Failed to create session') });
  }
});
