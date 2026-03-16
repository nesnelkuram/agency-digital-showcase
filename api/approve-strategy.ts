import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from './_lib/withAuth.js';
import { resolveApproval, failRun, loadCheckpoint } from './_lib/checkpointManager.js';

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leadId, approved, note } = req.body;

  if (!leadId || typeof approved !== 'boolean') {
    return res.status(400).json({ error: 'Missing required fields: leadId, approved' });
  }

  try {
    const existingRun = await loadCheckpoint(leadId);
    if (!existingRun) {
      return res.status(404).json({ error: 'Pipeline run not found' });
    }

    if (existingRun.approvalStatus !== 'pending') {
      return res.status(409).json({ error: `Approval already resolved: ${existingRun.approvalStatus}` });
    }

    const userId = req.userUid || req.userId;
    const userName = req.userDisplayName || 'Unknown';

    await resolveApproval(leadId, existingRun.runId, approved, userId, userName, note);

    if (!approved) {
      await failRun(leadId, existingRun.runId, 'Strategy rejected by admin');
    }

    console.log(`[approve-strategy] leadId=${leadId}, approved=${approved}, by=${userName}, note=${note ? 'yes' : 'no'}`);

    return res.status(200).json({
      success: true,
      approved,
      runId: existingRun.runId,
    });
  } catch (error: any) {
    console.error('[approve-strategy] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
