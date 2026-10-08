import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { transitionWorkflow, WorkflowError } from '../_lib/workflowRuntime.js';

export const config = { maxDuration: 300 };

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!applyRateLimit(res, req.userUid, LIMITS.AI_WORKFLOW)) return;
  try {
    const result = await transitionWorkflow(req, req.body || {}, 'review');
    return res.status(200).json(result);
  } catch (error) {
    const status = error instanceof WorkflowError ? error.status : 500;
    const message = error instanceof WorkflowError ? error.message : 'İş akışı işlemi tamamlanamadı.';
    return res.status(status).json({ error: message });
  }
});
