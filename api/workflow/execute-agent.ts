import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';
import { runWorkflowAgent } from '../../src/pipeline/workflow/orchestrator';
import type { WorkflowAgentInput } from '../../src/pipeline/workflow/types';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit';

export const config = { maxDuration: 300 };

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_WORKFLOW)) return;

  const {
    instanceId,
    nodeId,
    agentType,
    context,
    promptTemplate,
    inputMapping,
    outputMapping,
    model,
    maxRetries,
    timeoutMs,
    requiresHumanReview,
    confidenceThreshold,
  } = req.body;

  // Validate required fields
  if (!instanceId || !nodeId || !agentType) {
    return res.status(400).json({ error: 'Missing required fields: instanceId, nodeId, agentType' });
  }

  const input: WorkflowAgentInput = {
    agentType,
    instanceId,
    nodeId,
    context: context || {},
    promptTemplate: promptTemplate || '',
    inputMapping: inputMapping || {},
    outputMapping: outputMapping || {},
    model: model || 'flash',
    maxRetries: maxRetries || 2,
    timeoutMs: timeoutMs || 60000,
    requiresHumanReview: requiresHumanReview ?? true,
    confidenceThreshold: confidenceThreshold ?? 0.8,
  };

  try {
    const result = await runWorkflowAgent(input);

    return res.status(200).json({
      executionId: `exec-${Date.now()}`,
      ...result,
      requiresReview:
        requiresHumanReview || result.confidenceScore < (confidenceThreshold || 0.8),
    });
  } catch (error: any) {
    console.error('[execute-agent] Unexpected error:', error.message);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
