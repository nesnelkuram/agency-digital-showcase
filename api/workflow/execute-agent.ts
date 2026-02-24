import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { runWorkflowAgent } from '../../src/pipeline/workflow/orchestrator.js';
import type { WorkflowAgentInput } from '../../src/pipeline/workflow/types.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';

export const config = { maxDuration: 300 };

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_WORKFLOW)) return;

  const {
    instanceId,
    nodeId,
    agentId,
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
    systemPrompt,
  } = req.body;

  // Validate required fields
  if (!instanceId || !nodeId) {
    return res.status(400).json({ error: 'Missing required fields: instanceId, nodeId' });
  }

  // Resolve agent config from registry if agentId is provided
  let resolvedConfig: {
    agentType: string;
    model: string;
    promptTemplate: string;
    inputMapping: Record<string, string>;
    outputMapping: Record<string, string>;
    maxRetries: number;
    timeoutMs: number;
    requiresHumanReview: boolean;
    confidenceThreshold: number;
    systemPrompt?: string;
  } = {
    agentType: agentType || 'custom',
    model: model || 'flash',
    promptTemplate: promptTemplate || '',
    inputMapping: inputMapping || {},
    outputMapping: outputMapping || {},
    maxRetries: maxRetries ?? 2,
    timeoutMs: timeoutMs ?? 60000,
    requiresHumanReview: requiresHumanReview ?? true,
    confidenceThreshold: confidenceThreshold ?? 0.8,
    systemPrompt: systemPrompt,
  };

  if (agentId) {
    try {
      const db = getAdminDb();
      const agentDoc = await db.collection('ai_agents').doc(agentId).get();

      if (!agentDoc.exists) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const agentData = agentDoc.data();

      // Tenant isolation check
      if (agentData.tenantId !== req.tenantId) {
        return res.status(403).json({ error: 'Agent belongs to a different tenant' });
      }

      if (agentData.status !== 'active') {
        return res.status(400).json({ error: 'Agent is not active' });
      }

      // canva_autofill is not yet supported
      if (agentData.agentType === 'canva_autofill') {
        return res.status(501).json({
          error: 'Canva autofill agent is not yet supported. Faz 2b gerekli.',
        });
      }

      // Merge agent config — agent definition overrides inline values
      resolvedConfig = {
        agentType: agentData.agentType || resolvedConfig.agentType,
        model: agentData.model || resolvedConfig.model,
        promptTemplate: agentData.promptTemplate || resolvedConfig.promptTemplate,
        inputMapping: agentData.inputMapping || resolvedConfig.inputMapping,
        outputMapping: agentData.outputMapping || resolvedConfig.outputMapping,
        maxRetries: agentData.maxRetries ?? resolvedConfig.maxRetries,
        timeoutMs: agentData.timeoutMs ?? resolvedConfig.timeoutMs,
        requiresHumanReview: agentData.requiresHumanReview ?? resolvedConfig.requiresHumanReview,
        confidenceThreshold: agentData.confidenceThreshold ?? resolvedConfig.confidenceThreshold,
        systemPrompt: agentData.systemPrompt || resolvedConfig.systemPrompt,
      };
    } catch (error: any) {
      console.error('[execute-agent] Error fetching agent:', error.message);
      return res.status(500).json({ error: 'Failed to fetch agent configuration' });
    }
  } else if (!agentType) {
    return res.status(400).json({ error: 'Missing required field: agentType (or agentId)' });
  }

  const input: WorkflowAgentInput = {
    agentType: resolvedConfig.agentType as any,
    instanceId,
    nodeId,
    context: context || {},
    promptTemplate: resolvedConfig.promptTemplate,
    inputMapping: resolvedConfig.inputMapping,
    outputMapping: resolvedConfig.outputMapping,
    model: resolvedConfig.model,
    maxRetries: resolvedConfig.maxRetries,
    timeoutMs: resolvedConfig.timeoutMs,
    requiresHumanReview: resolvedConfig.requiresHumanReview,
    confidenceThreshold: resolvedConfig.confidenceThreshold,
    agentId: agentId || undefined,
    systemPrompt: resolvedConfig.systemPrompt,
  };

  const executionId = `exec-${Date.now()}`;
  const startedAt = new Date();

  try {
    const result = await runWorkflowAgent(input);
    const completedAt = new Date();

    const needsReview =
      resolvedConfig.requiresHumanReview ||
      result.confidenceScore < (resolvedConfig.confidenceThreshold || 0.8);

    // Persist result back to Firestore when instanceId+nodeId are provided
    if (instanceId && nodeId) {
      const db = getAdminDb();
      const FieldValue = getFieldValue();
      const instanceRef = db.collection('workflow_instances').doc(instanceId);

      // Write full output to ai_outputs subcollection
      await instanceRef.collection('ai_outputs').doc(`${nodeId}_${executionId}`).set({
        nodeId,
        executionId,
        tenantId: req.tenantId,
        agentType: resolvedConfig.agentType,
        output: result.output || {},
        confidenceScore: result.confidenceScore,
        status: result.success ? (needsReview ? 'review_pending' : 'completed') : 'failed',
        startedAt,
        completedAt,
        tokensUsed: result.tokensUsed,
        error: result.error,
      });

      const nextStatus = !result.success ? 'blocked' : needsReview ? 'ai_review' : 'completed';

      const stepFields: Record<string, any> = {
        [`steps.${nodeId}.status`]: nextStatus,
        [`steps.${nodeId}.aiExecutions`]: FieldValue.arrayUnion({
          executionId,
          agentType: resolvedConfig.agentType,
          startedAt,
          completedAt,
          status: result.success ? (needsReview ? 'review_pending' : 'completed') : 'failed',
          confidenceScore: result.confidenceScore,
          error: result.error,
          tokensUsed: result.tokensUsed,
        }),
        lastActivityAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (nextStatus === 'completed' && result.output) {
        stepFields[`steps.${nodeId}.completedAt`] = completedAt;
        // Namespaced context — prevents key collisions between steps
        const ctxKey = `step_${nodeId.replace(/[.:]/g, '_')}`;
        stepFields[`context.${ctxKey}`] = result.output;
        stepFields[`steps.${nodeId}.outputData`] = result.output;
      }

      await instanceRef.update(stepFields);

      // Audit log
      await instanceRef.collection('audit_log').add({
        action: result.success ? 'ai_step_completed' : 'ai_step_failed',
        description: result.success
          ? `"${nodeId}" AI adımı ${needsReview ? 'insan onayına gönderildi' : 'otomatik tamamlandı'} (güven: ${(result.confidenceScore * 100).toFixed(0)}%)`
          : `"${nodeId}" AI adımı başarısız: ${result.error}`,
        userId: req.userUid,
        timestamp: completedAt,
      });
    }

    return res.status(200).json({
      executionId,
      ...result,
      requiresReview: needsReview,
    });
  } catch (error: any) {
    console.error('[execute-agent] Unexpected error:', error.message);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
