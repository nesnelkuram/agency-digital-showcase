import '../_lib/env.js';
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';

export const config = { maxDuration: 10 };

/**
 * GET /api/drive/connection-status
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('platform_accounts')
      .where('tenantId', '==', req.tenantId)
      .where('platform', '==', 'google_drive')
      .where('status', '==', 'connected')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(200).json({ connected: false });
    }

    const data = snap.docs[0].data();
    return res.status(200).json({
      connected: true,
      email: data.email || data.metadata?.email || null,
      lastSyncAt: data.lastSyncAt || null,
      connectedAt: data.createdAt || null,
    });
  } catch (error: any) {
    console.error('[drive/connection-status] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});
