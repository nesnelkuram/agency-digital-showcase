/**
 * POST /api/workflow/execute-step-internal
 *
 * Internal-only endpoint (not user-facing). Called by complete-step.ts
 * to run an AI agent for a workflow step, then write the result back
 * to Firestore and set the step to ai_review (or completed if no review needed).
 *
 * Protected by x-internal-secret header — NOT exposed to end users.
 */
import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runWorkflowAgent } from '../../src/pipeline/workflow/orchestrator.js';
import type { WorkflowAgentInput } from '../../src/pipeline/workflow/types.js';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';

export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Guard: only allow calls from within Vercel (internal secret)
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_API_SECRET || '';
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const {
    tenantId,
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
    triggeredBy,
  } = req.body || {};

  if (!instanceId || !nodeId || !tenantId) {
    return res.status(400).json({ error: 'instanceId, nodeId, tenantId zorunludur.' });
  }

  const db = getAdminDb();
  const FieldValue = getFieldValue();

  const executionId = `exec-${Date.now()}`;
  const startedAt = new Date();

  try {
    // ─── 1. Resolve agent config from registry if agentId provided ─────────
    let resolvedConfig = {
      agentType: agentType || 'custom',
      model: model || 'flash',
      promptTemplate: promptTemplate || '',
      inputMapping: inputMapping || {},
      outputMapping: outputMapping || {},
      maxRetries: maxRetries ?? 2,
      timeoutMs: timeoutMs ?? 60000,
      requiresHumanReview: requiresHumanReview ?? true,
      confidenceThreshold: confidenceThreshold ?? 0.8,
      systemPrompt,
    };

    if (agentId) {
      const agentDoc = await db.collection('ai_agents').doc(agentId).get();
      if (agentDoc.exists) {
        const a = agentDoc.data();
        if (a.tenantId === tenantId && a.status === 'active') {
          resolvedConfig = {
            agentType: a.agentType || resolvedConfig.agentType,
            model: a.model || resolvedConfig.model,
            promptTemplate: a.promptTemplate || resolvedConfig.promptTemplate,
            inputMapping: a.inputMapping || resolvedConfig.inputMapping,
            outputMapping: a.outputMapping || resolvedConfig.outputMapping,
            maxRetries: a.maxRetries ?? resolvedConfig.maxRetries,
            timeoutMs: a.timeoutMs ?? resolvedConfig.timeoutMs,
            requiresHumanReview: a.requiresHumanReview ?? resolvedConfig.requiresHumanReview,
            confidenceThreshold: a.confidenceThreshold ?? resolvedConfig.confidenceThreshold,
            systemPrompt: a.systemPrompt || resolvedConfig.systemPrompt,
          };
        }
      }
    }

    // ─── 2. Run the AI agent ───────────────────────────────────────────────
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

    const result = await runWorkflowAgent(input);
    const completedAt = new Date();

    const instanceRef = db.collection('workflow_instances').doc(instanceId);

    // ─── 3. Determine next step status ────────────────────────────────────
    const needsReview =
      resolvedConfig.requiresHumanReview ||
      result.confidenceScore < (resolvedConfig.confidenceThreshold || 0.8);

    const nextStatus = needsReview ? 'ai_review' : 'completed';

    // Build AIExecutionRecord
    const execRecord = {
      executionId,
      agentType: resolvedConfig.agentType,
      startedAt,
      completedAt,
      status: result.success ? (needsReview ? 'review_pending' : 'completed') : 'failed',
      input: { promptTemplate: resolvedConfig.promptTemplate, inputMapping: resolvedConfig.inputMapping },
      output: result.output || {},
      confidenceScore: result.confidenceScore,
      error: result.error,
      tokensUsed: result.tokensUsed,
    };

    // ─── 4. Write AI output to subcollection (avoids 1MB limit) ───────────
    await instanceRef.collection('ai_outputs').doc(`${nodeId}_${executionId}`).set({
      nodeId,
      executionId,
      tenantId,
      agentType: resolvedConfig.agentType,
      input: input.context,
      output: result.output || {},
      confidenceScore: result.confidenceScore,
      status: execRecord.status,
      startedAt,
      completedAt,
      tokensUsed: result.tokensUsed,
    });

    // ─── 5. Update step on main document ──────────────────────────────────
    const stepUpdateFields: Record<string, any> = {
      [`steps.${nodeId}.status`]: nextStatus,
      [`steps.${nodeId}.completedAt`]: nextStatus === 'completed' ? completedAt : undefined,
      // Store a trimmed execution record on the step (full data in subcollection)
      [`steps.${nodeId}.aiExecutions`]: FieldValue.arrayUnion({
        executionId,
        agentType: resolvedConfig.agentType,
        startedAt,
        completedAt,
        status: execRecord.status,
        confidenceScore: result.confidenceScore,
        error: result.error,
        tokensUsed: result.tokensUsed,
        // omit large output — fetch from ai_outputs subcollection when needed
      }),
      updatedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
    };

    // Merge output into context if AI completed successfully without review
    if (!needsReview && result.success && result.output) {
      for (const [k, v] of Object.entries(result.output)) {
        stepUpdateFields[`context.${k}`] = v;
      }
    }

    await instanceRef.update(stepUpdateFields);

    // ─── 6. Audit log ─────────────────────────────────────────────────────
    const auditMsg = result.success
      ? `"${nodeId}" AI adımı ${needsReview ? 'tamamlandı, insan onayı bekleniyor' : 'otomatik onaylandı'} (güven: ${(result.confidenceScore * 100).toFixed(0)}%)`
      : `"${nodeId}" AI adımı başarısız oldu: ${result.error}`;

    await instanceRef.collection('audit_log').add({
      action: result.success ? 'ai_step_completed' : 'ai_step_failed',
      description: auditMsg,
      userId: triggeredBy || 'system',
      timestamp: completedAt,
    });

    // ─── 7. If needsReview: notify assignee role ───────────────────────────
    if (needsReview) {
      // Fetch template node to get reviewerRole
      const templateSnap = await db.collection('workflow_templates').doc(
        (await instanceRef.get()).data()?.templateId
      ).get();
      const templateData = templateSnap.data();
      const node = templateData?.nodes?.find((n: any) => n.id === nodeId);
      const reviewerRole = node?.reviewConfig?.reviewerRole || node?.assigneeRole || 'admin';

      await db.collection('notifications').add({
        tenantId,
        type: 'ai_review_needed',
        title: 'AI Çıktısı İnceleme Bekliyor',
        message: `"${node?.label || nodeId}" adımının AI çıktısı incelemenizi bekliyor.`,
        relatedId: instanceId,
        relatedType: 'workflow_instance',
        metadata: { instanceId, nodeId, confidenceScore: result.confidenceScore },
        targetRole: reviewerRole,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // ─── 8. If fully auto-completed (no review), advance DAG ──────────────
    if (!needsReview && result.success) {
      // Re-run DAG advance by importing and calling the engine
      // (Dynamic import to avoid circular deps at module level)
      const { advanceWorkflow } = await import('../../shared/services/workflowEngineService.js');
      await advanceWorkflow(tenantId, instanceId);
    }

    return res.status(200).json({
      executionId,
      success: result.success,
      confidenceScore: result.confidenceScore,
      nextStatus,
      requiresReview: needsReview,
    });
  } catch (error: any) {
    console.error('[execute-step-internal] Error:', error.message);

    // Mark step as failed
    try {
      const instanceRef = db.collection('workflow_instances').doc(instanceId);
      await instanceRef.update({
        [`steps.${nodeId}.status`]: 'blocked',
        [`steps.${nodeId}.aiExecutions`]: FieldValue.arrayUnion({
          executionId,
          agentType: agentType || 'unknown',
          startedAt,
          completedAt: new Date(),
          status: 'failed',
          error: error.message,
          confidenceScore: 0,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (updateErr: any) {
      console.error('[execute-step-internal] Failed to update step status:', updateErr.message);
    }

    return res.status(500).json({ error: 'AI yürütme hatası', details: error.message });
  }
}
