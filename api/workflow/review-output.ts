import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { instanceId, nodeId, executionId, decision, modifiedOutput } = req.body;
  // decision: 'approved' | 'rejected' | 'modified'

  if (!instanceId || !nodeId || !executionId || !decision) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const validDecisions = ['approved', 'rejected', 'modified'];
  if (!validDecisions.includes(decision)) {
    return res.status(400).json({
      error: `Invalid decision. Must be one of: ${validDecisions.join(', ')}`,
    });
  }

  if (decision === 'modified' && !modifiedOutput) {
    return res.status(400).json({ error: 'modifiedOutput is required when decision is "modified"' });
  }

  // Return success - the actual step update will be done client-side via workflowEngineService
  return res.status(200).json({
    success: true,
    decision,
    reviewedBy: req.userId,
    reviewedAt: new Date().toISOString(),
    ...(modifiedOutput ? { modifiedOutput } : {}),
  });
});
