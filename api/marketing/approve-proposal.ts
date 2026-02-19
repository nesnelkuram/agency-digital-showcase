import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 60,
};

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { proposalId, action, reviewedBy, reviewedByName, notes } = req.body;

    if (!proposalId || !action || !reviewedBy) {
      return res.status(400).json({
        error: 'Missing required fields: proposalId, action, reviewedBy',
      });
    }

    if (!['approved', 'rejected', 'revision'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Must be: approved, rejected, or revision',
      });
    }

    if (action === 'rejected' && !notes) {
      return res.status(400).json({
        error: 'Notes are required when rejecting a proposal',
      });
    }

    console.log(`[approve-proposal] ${action} proposal=${proposalId} by=${reviewedBy}`);

    // Response with the action taken — actual Firestore update
    // happens on the client side via marketingService
    return res.status(200).json({
      success: true,
      proposalId,
      action,
      reviewedBy,
      reviewedByName,
      notes,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[approve-proposal] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Approval failed',
    });
  }
});
