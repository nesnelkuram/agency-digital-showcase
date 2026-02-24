/**
 * POST /api/workflow/complete-step
 *
 * Server-side routing hub for step completion:
 * 1. Marks the step as completed (with formData / deliverables / outputData)
 * 2. Runs advanceWorkflow (DAG engine) — promotes pending → ready
 * 3. For newly-ready ai_task nodes: auto-triggers execute-agent (ai_processing)
 * 4. For newly-ready human task nodes: creates in-app notifications
 *
 * Body params:
 *   instanceId, nodeId, tenantId
 *   formData?      — form field values submitted by the user
 *   deliverables?  — uploaded file references
 *   outputData?    — key-value context outputs
 *
 * This endpoint replaces the client-side completeStep() call so that AI
 * auto-triggering can happen server-side without CORS or auth issues.
 */
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';

export const config = { maxDuration: 120 };

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.AI_WORKFLOW)) return;

  const { instanceId, nodeId, formData, deliverables, outputData } = req.body || {};

  if (!instanceId || !nodeId) {
    return res.status(400).json({ error: 'instanceId ve nodeId zorunludur.' });
  }

  const db = getAdminDb();
  const FieldValue = getFieldValue();

  try {
    // ─── 1. Fetch instance ────────────────────────────────────────────────
    const instanceRef = db.collection('workflow_instances').doc(instanceId);
    const instanceSnap = await instanceRef.get();

    if (!instanceSnap.exists) {
      return res.status(404).json({ error: 'Workflow instance bulunamadı.' });
    }

    const instance = { id: instanceSnap.id, ...instanceSnap.data() } as any;

    if (instance.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Erişim reddedildi.' });
    }

    const step = instance.steps?.[nodeId];
    if (!step) {
      return res.status(404).json({ error: `Adım '${nodeId}' bulunamadı.` });
    }

    if (step.status !== 'in_progress' && step.status !== 'ai_review') {
      return res.status(400).json({
        error: `Adım tamamlanamaz. Mevcut durum: ${step.status}`,
      });
    }

    // ─── 2. Fetch template ────────────────────────────────────────────────
    const templateSnap = await db.collection('workflow_templates').doc(instance.templateId).get();
    if (!templateSnap.exists) {
      return res.status(404).json({ error: 'Workflow şablonu bulunamadı.' });
    }
    const template = templateSnap.data() as any;

    // ─── 3. Mark step as completed ────────────────────────────────────────
    const now = new Date();
    const stepUpdate: Record<string, any> = {
      [`steps.${nodeId}.status`]: 'completed',
      [`steps.${nodeId}.completedAt`]: now,
      updatedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
    };

    if (formData) stepUpdate[`steps.${nodeId}.formData`] = formData;
    if (deliverables) stepUpdate[`steps.${nodeId}.deliverables`] = deliverables;
    if (outputData) stepUpdate[`steps.${nodeId}.outputData`] = outputData;

    // Merge outputData into workflow context
    if (outputData) {
      for (const [k, v] of Object.entries(outputData)) {
        stepUpdate[`context.${k}`] = v;
      }
    }

    await instanceRef.update(stepUpdate);

    // Write audit log to subcollection
    const auditEntry = {
      id: `audit-${Date.now()}`,
      action: 'step_completed',
      description: `"${nodeId}" adımı ${req.userDisplayName || req.userUid} tarafından tamamlandı`,
      userId: req.userUid,
      timestamp: now,
    };
    await instanceRef.collection('audit_log').add(auditEntry);

    // ─── 4. DAG advance — find next ready steps ───────────────────────────
    // Reload updated instance
    const updatedSnap = await instanceRef.get();
    const updatedInstance = { id: updatedSnap.id, ...updatedSnap.data() } as any;
    const updatedSteps: Record<string, any> = { ...updatedInstance.steps };

    const newlyReadyNodeIds: string[] = [];

    for (const node of template.nodes) {
      const s = updatedSteps[node.id];
      if (!s) continue;
      if (s.status === 'completed' || s.status === 'skipped') continue;

      const incomingEdges = template.edges.filter((e: any) => e.target === node.id);
      let prereqMet = true;

      if (incomingEdges.length > 0) {
        for (const edge of incomingEdges) {
          const src = updatedSteps[edge.source];
          if (!src || (src.status !== 'completed' && src.status !== 'skipped')) {
            prereqMet = false;
            break;
          }
        }
      }

      if (prereqMet && s.status === 'pending') {
        updatedSteps[node.id] = { ...s, status: 'ready' };
        newlyReadyNodeIds.push(node.id);
      }

      // Auto-complete parallel_join
      if (prereqMet && node.type === 'parallel_join' && s.status === 'pending') {
        updatedSteps[node.id] = { ...s, status: 'completed', completedAt: now };
      }

      // Auto-complete subprocess when all sub-steps done
      if (node.type === 'subprocess' && (s.status === 'ready' || s.status === 'in_progress')) {
        const childSteps = Object.values(updatedSteps).filter(
          (cs: any) => cs.isSubStep && cs.parentStepId === node.id
        );
        if (childSteps.length > 0 && childSteps.every((cs: any) => cs.status === 'completed' || cs.status === 'skipped')) {
          updatedSteps[node.id] = { ...s, status: 'completed', completedAt: now };
        }
      }
    }

    // Recalculate progress
    const nonStartEndSteps = Object.entries(updatedSteps).filter(([nId, s]: any) => {
      if (s.isSubStep) return false;
      const n = template.nodes.find((nd: any) => nd.id === nId);
      return n && n.type !== 'start' && n.type !== 'end';
    });
    const completedCount = nonStartEndSteps.filter(([, s]: any) =>
      s.status === 'completed' || s.status === 'skipped'
    ).length;
    const progress = nonStartEndSteps.length > 0
      ? Math.round((completedCount / nonStartEndSteps.length) * 100)
      : 0;

    const activeNodeIds = Object.entries(updatedSteps)
      .filter(([, s]: any) => s.status === 'ready' || s.status === 'in_progress' || s.status === 'ai_review')
      .map(([nId]) => nId);

    const activeAssigneeIds = Array.from(new Set(
      Object.values(updatedSteps)
        .filter((s: any) => (s.status === 'ready' || s.status === 'in_progress') && s.assignment?.userId)
        .map((s: any) => s.assignment.userId)
    ));

    const activeStepLabels = activeNodeIds.map((nId: string) => {
      const n = template.nodes.find((nd: any) => nd.id === nId);
      return n?.label || nId;
    });

    const allDone = Object.values(updatedSteps).every(
      (s: any) => s.status === 'completed' || s.status === 'skipped'
    );
    const newStatus = allDone ? 'completed' : updatedInstance.status;

    await instanceRef.update({
      steps: updatedSteps,
      progress,
      activeNodeIds,
      activeAssigneeIds,
      activeStepLabels,
      status: newStatus,
      ...(allDone ? { completedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ─── 5. Route newly-ready steps ───────────────────────────────────────
    const aiTriggered: string[] = [];
    const humanNotified: string[] = [];

    for (const readyNodeId of newlyReadyNodeIds) {
      const node = template.nodes.find((n: any) => n.id === readyNodeId);
      if (!node) continue;

      if (node.type === 'ai_task') {
        // ── AI routing: set ai_processing and enqueue execution ────────────
        await instanceRef.update({
          [`steps.${readyNodeId}.status`]: 'ai_processing',
          [`steps.${readyNodeId}.startedAt`]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Trigger AI execution in a non-blocking fire-and-forget pattern.
        // We call the execute-agent endpoint internally via fetch.
        // We use the base URL from the request host to avoid hardcoding.
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000';

        const agentConfig = node.aiAgentConfig || {};
        const currentContext = { ...updatedInstance.context, ...(outputData || {}) };

        // Fire and forget — we don't await so we don't block the response
        fetch(`${baseUrl}/api/workflow/execute-step-internal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
          body: JSON.stringify({
            tenantId: req.tenantId,
            instanceId,
            nodeId: readyNodeId,
            agentId: node.agentId,
            agentType: agentConfig.agentType || 'gemini_task',
            context: currentContext,
            promptTemplate: agentConfig.promptTemplate || '',
            inputMapping: agentConfig.inputMapping || {},
            outputMapping: agentConfig.outputMapping || {},
            model: agentConfig.model || 'flash',
            maxRetries: agentConfig.maxRetries ?? 2,
            timeoutMs: agentConfig.timeoutMs ?? 60000,
            requiresHumanReview: agentConfig.requiresHumanReview ?? true,
            confidenceThreshold: agentConfig.confidenceThreshold ?? 0.8,
            systemPrompt: agentConfig.systemPrompt,
            triggeredBy: req.userUid,
          }),
        }).catch((err: any) => {
          console.error(`[complete-step] Failed to trigger AI for node ${readyNodeId}:`, err.message);
        });

        aiTriggered.push(readyNodeId);
      } else if (node.type === 'task' || node.type === 'review' || node.type === 'approval') {
        // ── Human routing: create in-app notification ──────────────────────
        const assigneeRole = node.assigneeRole;

        if (assigneeRole) {
          // Create a notification document — real-time listeners will pick this up
          await db.collection('notifications').add({
            tenantId: req.tenantId,
            type: 'task_ready',
            title: 'Yeni Görev Hazır',
            message: `"${node.label || readyNodeId}" adımı sizin için hazır.`,
            relatedId: instanceId,
            relatedType: 'workflow_instance',
            metadata: {
              instanceId,
              nodeId: readyNodeId,
              nodeLabel: node.label || readyNodeId,
              projectName: updatedInstance.projectName,
              templateName: updatedInstance.templateName,
              assigneeRole,
            },
            targetRole: assigneeRole,
            isRead: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        humanNotified.push(readyNodeId);
      }
    }

    return res.status(200).json({
      success: true,
      progress,
      status: newStatus,
      newlyReadyNodes: newlyReadyNodeIds,
      aiTriggered,
      humanNotified,
    });
  } catch (error: any) {
    console.error('[complete-step] Error:', error.message);
    return res.status(500).json({ error: 'Sunucu hatası', details: error.message });
  }
});
