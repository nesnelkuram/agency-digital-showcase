import { createHash, randomUUID } from 'node:crypto';
import { getAdminDb } from './firebaseAdmin.js';
import { checkProjectAccess } from './projectAccess.js';
import { buildBrandCharacterPure } from '../../shared/services/brandAICharacterBuilder.js';
import { runWorkflowAgent } from '../../src/pipeline/workflow/orchestrator.js';

type Data = Record<string, any>;
type Actor = { userId: string; tenantId: string; userRole: string };
export class WorkflowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new WorkflowError(status, message); }
const done = (s: Data) => ['completed', 'skipped'].includes(s?.status);
const plain = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]+$/.test(v) && !['__proto__', 'prototype', 'constructor'].includes(v);
const valueAt = (context: Data, path: string): unknown => path.split('.').reduce<any>((v, k) => v?.[k], context);
const clean = (v: any): any => {
  if (v?.toMillis) return v.toMillis();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(clean);
  if (plain(v)) return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, clean(v[k])]));
  return v;
};

function authorizeStep(actor: Actor, step: Data, node: Data, review = false) {
  if (['admin', 'super_admin'].includes(actor.userRole)) return;
  const role = review ? (node.reviewConfig?.reviewerRole || node.assigneeRole) : node.assigneeRole;
  if (review && role) {
    if (actor.userRole !== role) fail(403, 'Bu çıktıyı inceleme yetkiniz yok.');
  } else if (step.assignment?.userId) {
    if (step.assignment.userId !== actor.userId) fail(403, 'Adım başka bir kullanıcıya atanmış.');
  } else if (!role || actor.userRole !== role) fail(403, 'Bu adımı tamamlama yetkiniz yok.');
}

/** Server-owned snapshot, limited to production context. No contacts, access notes or share tokens. */
async function captureBrief(db: any, actor: Actor, project: Data) {
  let brand: Data | null = null;
  let brief: Data | null = null;
  let briefSource: Data | null = null;
  let brandSource: Data | null = null;
  if (safeId(project.leadId)) {
    const leadDoc = await db.collection('brand_leads').doc(project.leadId).get();
    const lead = leadDoc.exists ? leadDoc.data() : null;
    if (lead && lead.tenantId === actor.tenantId) {
      const character = buildBrandCharacterPure(lead, leadDoc.id, project.id);
      brand = { brandName: character.brandName, voiceSummary: character.voiceSummary, systemPrompt: character.systemPrompt };
      brandSource = { id: leadDoc.id, updatedAt: clean(lead.updatedAt) ?? null };
      const matches = await db.collection('operational_briefs')
        .where('tenantId', '==', actor.tenantId).where('leadId', '==', project.leadId).limit(2).get();
      if (matches.docs.length > 1) fail(409, 'Bu marka için birden fazla brief var; önce doğru brief seçilmeli.');
      if (matches.docs.length === 1) {
        const source = matches.docs[0];
        const data = source.data();
        brief = clean({ businessName: data.businessName, status: data.status,
          production: data.production && {
            existingVisualAssets: data.production.existingVisualAssets,
            monthlyContentCapacityNeeded: data.production.monthlyContentCapacityNeeded,
            brandAssetFiles: data.production.brandAssetFiles,
          },
          catalog: data.catalog, seasonality: data.seasonality,
          constraints: data.constraints && {
            legalOrComplianceLimits: data.constraints.legalOrComplianceLimits,
            toneOrContentNoGo: data.constraints.toneOrContentNoGo,
            competitorsOffLimits: data.constraints.competitorsOffLimits,
          },
        });
        briefSource = { id: source.id, updatedAt: clean(data.updatedAt) ?? null };
      }
    }
  }
  const snapshot = clean({ schemaVersion: 1, projectId: project.id, tenantId: actor.tenantId,
    operationalBrief: brief, brand, briefSource, brandSource });
  return { ...snapshot, revision: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), capturedAt: new Date().toISOString() };
}

function validateForm(node: Data, form: unknown): Data {
  if (!plain(form)) fail(400, 'Form verisi geçersiz.');
  const result: Data = {};
  for (const field of node.formSchema?.fields || []) {
    if (!safeId(field.id)) fail(400, 'Form alan kimliği geçersiz.');
    const value = form[field.id];
    if (field.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) {
      fail(400, `Zorunlu alan eksik: ${field.label}`);
    }
    if (value === undefined || value === null) continue;
    const expected = field.type === 'checkbox' ? 'boolean' : ['number', 'rating'].includes(field.type) ? 'number' : 'string';
    if (typeof value !== expected || (typeof value === 'number' && !Number.isFinite(value))) fail(400, `Geçersiz alan: ${field.label}`);
    if (field.type === 'select' && value !== '' && !field.options?.some((o: Data) => o.value === value)) fail(400, `Geçersiz seçim: ${field.label}`);
    result[field.id] = value;
  }
  return result;
}

/** Progress only the supported linear/parallel slice. Never silently run a conditional/subprocess branch. */
function advance(instance: Data, template: Data) {
  const jobs: Array<{ nodeId: string; executionId: string }> = [];
  for (let pass = 0; pass < template.nodes.length; pass++) {
    let changed = false;
    for (const node of template.nodes) {
      const step = instance.steps[node.id];
      if (!step || step.status !== 'pending') continue;
      const incoming = template.edges.filter((e: Data) => e.target === node.id);
      if (!incoming.length || !incoming.every((e: Data) => done(instance.steps[e.source]))) continue;
      if (incoming.every((e: Data) => instance.steps[e.source]?.status === 'skipped')) {
        step.status = 'skipped'; changed = true; continue;
      }
      if (['condition', 'subprocess'].includes(node.type) || incoming.some((e: Data) => e.type && e.type !== 'default')) {
        step.status = 'blocked'; step.blockedReason = 'Bu akış dalı otomatik ilerleme için desteklenmiyor; yönetici incelemesi gerekli.';
      } else if (['end', 'parallel_join', 'parallel_split', 'milestone'].includes(node.type)) {
        step.status = 'completed'; step.completedAt = new Date();
      } else if (node.type === 'ai_task') {
        const executionId = randomUUID();
        step.status = 'ai_processing'; step.activeExecutionId = executionId; step.startedAt = new Date();
        jobs.push({ nodeId: node.id, executionId });
      } else step.status = 'ready';
      changed = true;
    }
    if (!changed) break;
  }
  const entries = Object.entries(instance.steps) as Array<[string, Data]>;
  const counted = entries.filter(([id, s]) => !s.isSubStep && !['start', 'end'].includes(template.nodes.find((n: Data) => n.id === id)?.type));
  instance.progress = counted.length ? Math.round(counted.filter(([, s]) => done(s)).length / counted.length * 100) : 0;
  instance.activeNodeIds = entries.filter(([, s]) => ['ready', 'in_progress', 'ai_processing', 'ai_review', 'revision_needed'].includes(s.status)).map(([id]) => id);
  instance.activeAssigneeIds = [...new Set(entries.filter(([id]) => instance.activeNodeIds.includes(id)).map(([, s]) => s.assignment?.userId).filter(Boolean))];
  instance.activeStepLabels = instance.activeNodeIds.map((id: string) => template.nodes.find((n: Data) => n.id === id)?.label || id);
  if (entries.every(([, s]) => done(s))) { instance.status = 'completed'; instance.completedAt = new Date(); }
  return jobs;
}

function runtimePatch(instance: Data) {
  return { steps: instance.steps, context: instance.context, progress: instance.progress,
    activeNodeIds: instance.activeNodeIds, activeAssigneeIds: instance.activeAssigneeIds,
    activeStepLabels: instance.activeStepLabels, status: instance.status,
    ...(instance.completedAt ? { completedAt: instance.completedAt } : {}),
  };
}

async function executeClaim(db: any, ref: any, template: Data, job: { nodeId: string; executionId: string }) {
  const node = template.nodes.find((n: Data) => n.id === job.nodeId);
  const snapshot = await ref.get();
  const instance = snapshot.data();
  const current = instance.steps[job.nodeId];
  if (instance.status !== 'active' || current.status !== 'ai_processing' || current.activeExecutionId !== job.executionId) return;
  let config = { ...(node.aiAgentConfig || {}) };
  if (node.agentId) {
    const agentDoc = await db.collection('ai_agents').doc(node.agentId).get();
    const agent = agentDoc.data();
    if (!agent || agent.tenantId !== instance.tenantId || agent.status !== 'active') {
      config = { ...config, invalidAgent: true };
    } else config = { ...config, ...agent };
  }
  const trustedBrief = (await ref.collection('runtime_state').doc('brief').get()).data();
  if (!trustedBrief || trustedBrief.tenantId !== instance.tenantId || trustedBrief.projectId !== instance.projectId) throw new Error('Brief kaydı bulunamadı.');
  const context = { ...(instance.context || {}), workflowBrief: trustedBrief,
    operationalBrief: trustedBrief.operationalBrief, brand: trustedBrief.brand };
  const input = clean({ agentType: config.agentType || 'custom', instanceId: ref.id, nodeId: job.nodeId,
    context, promptTemplate: config.promptTemplate || '', inputMapping: config.inputMapping || {},
    outputMapping: config.outputMapping || {}, model: config.model || 'flash',
    maxRetries: Math.max(0, Math.min(config.maxRetries ?? 2, 2)), timeoutMs: config.timeoutMs || 60000,
    requiresHumanReview: true, systemPrompt: [
      context.brand?.systemPrompt,
      context.operationalBrief ? `Üretim brief'i (bu çalışmanın sabit bağlamı):\n${JSON.stringify(context.operationalBrief)}` : '',
      config.systemPrompt,
      current.revisions?.length ? `Yalnızca bu çıktı için revizyon geri bildirimi (kalıcı marka kuralı değildir):\n${current.revisions.at(-1).reason}` : '',
    ].filter(Boolean).join('\n\n'),
  });
  const outputRef = ref.collection('ai_outputs').doc(`${job.nodeId}_${job.executionId}`);
  // The full input and resolved prompt are immutable for this execution, not just their hashes.
  await outputRef.create({ tenantId: instance.tenantId, nodeId: job.nodeId, executionId: job.executionId,
    input, templateVersion: instance.templateVersion, status: 'running', startedAt: new Date() });
  let result: Data;
  try {
    if (config.invalidAgent) throw new Error('AI ajanı bulunamadı veya bu projede kullanılamıyor.');
    if (!input.promptTemplate.trim()) throw new Error('AI görevinin üretim talimatı eksik.');
    for (const field of node.inputSchema || []) {
      const v = valueAt(context, field.key);
      if (field.required && (v === undefined || v === null || v === '')) throw new Error(`Gerekli brief girdisi eksik: ${field.label}`);
    }
    for (const path of Object.values(input.inputMapping) as string[]) {
      const v = valueAt(context, path);
      if (v === undefined || v === null || v === '') throw new Error(`Gerekli bağlam eksik: ${path}`);
    }
    result = await runWorkflowAgent(input);
  } catch (error) {
    result = { success: false, output: {}, confidenceScore: 0, error: error instanceof Error ? error.message : 'AI adımı başarısız.' };
  }
  await db.runTransaction(async (tx: any) => {
    const fresh = (await tx.get(ref)).data();
    const step = fresh.steps[job.nodeId];
    if (fresh.status !== 'active' || step.activeExecutionId !== job.executionId || step.status !== 'ai_processing') {
      tx.update(outputRef, { status: 'superseded', completedAt: new Date() }); return;
    }
    const status = result.success ? 'review_pending' : 'failed';
    const record = clean({ executionId: job.executionId, agentType: input.agentType, status,
      confidenceScore: result.confidenceScore, error: result.error, tokensUsed: result.tokensUsed });
    tx.update(outputRef, clean({ ...result, status, completedAt: new Date() }));
    tx.update(ref, {
      [`steps.${job.nodeId}.status`]: result.success ? 'ai_review' : 'blocked',
      [`steps.${job.nodeId}.outputData`]: result.output || {},
      [`steps.${job.nodeId}.aiExecutions`]: [...(step.aiExecutions || []), record],
      updatedAt: new Date(), lastActivityAt: new Date(),
    });
  });
}

/** Shared server path: claimed AI work is awaited, never abandoned by a fire-and-forget request. */
export async function transitionWorkflow(actor: Actor, body: Data, mode: 'complete' | 'review') {
  if (!safeId(body.instanceId) || !safeId(body.nodeId)) fail(400, 'Geçersiz akış/adım kimliği.');
  const db = getAdminDb();
  const ref = db.collection('workflow_instances').doc(body.instanceId);
  const initial = (await ref.get()).data();
  if (!initial) fail(404, 'İş akışı bulunamadı.');
  if (initial.tenantId !== actor.tenantId) fail(403, 'Erişim reddedildi.');
  const access = await checkProjectAccess(actor, initial.projectId);
  if (!access.ok) fail(access.httpStatus, access.error);
  // runtime_state has no client grant in firestore.rules. Treat context as a display mirror only.
  const briefRef = ref.collection('runtime_state').doc('brief');
  const storedBrief = (await briefRef.get()).data();
  const brief = storedBrief || await captureBrief(db, actor, { ...access.project, id: initial.projectId });
  const outcome = await db.runTransaction(async (tx: any) => {
    const instance = (await tx.get(ref)).data();
    if (instance.tenantId !== actor.tenantId || instance.projectId !== initial.projectId) fail(409, 'Akış kapsamı değişti.');
    const templateRef = db.collection('workflow_templates').doc(instance.templateId);
    const template = (await tx.get(templateRef)).data();
    const trustedBrief = (await tx.get(briefRef)).data();
    if (!template || template.tenantId !== actor.tenantId) fail(403, 'Şablona erişilemiyor.');
    if (template.version !== instance.templateVersion) fail(409, 'Şablon sürümü değişti; akış incelenmeli.');
    const node = template.nodes.find((n: Data) => n.id === body.nodeId);
    const step = instance.steps?.[body.nodeId];
    if (!node || !step) fail(404, 'Adım bulunamadı.');
    authorizeStep(actor, step, node, mode === 'review' || ['review', 'approval'].includes(node.type));
    if (mode === 'complete' && step.status === 'completed') return { jobs: [], template, duplicate: true };
    if (instance.status !== 'active') fail(409, 'İş akışı etkin değil.');
    if ((trustedBrief || brief).tenantId !== actor.tenantId || (trustedBrief || brief).projectId !== instance.projectId) fail(409, 'Brief kapsamı değişti.');
    instance.context = { ...(instance.context || {}), workflowBrief: trustedBrief || brief };
    // Reserved context comes only from server-owned records, never from form keys.
    instance.context.operationalBrief = instance.context.workflowBrief.operationalBrief;
    instance.context.brand = instance.context.workflowBrief.brand;
    if (mode === 'complete') {
      if (!['in_progress', 'revision_needed'].includes(step.status) || node.type === 'ai_task') fail(409, 'Adım bu durumda tamamlanamaz; AI çıktısı ayrıca incelenmelidir.');
      const form = validateForm(node, body.formData ?? {});
      step.formData = form; step.outputData = form;
      instance.context[`step_${body.nodeId}`] = form;
      step.status = 'completed'; step.completedAt = new Date();
    } else {
      const expectedStatus = body.decision === 'retry' ? 'revision_needed' : 'ai_review';
      if (!safeId(body.executionId) || step.status !== expectedStatus || step.activeExecutionId !== body.executionId) fail(409, 'İnceleme güncel değil.');
      if (!['approved', 'rejected', 'retry'].includes(body.decision)) fail(400, 'Geçersiz inceleme kararı.');
      if (body.decision === 'rejected' && (typeof body.reason !== 'string' || !body.reason.trim())) fail(400, 'Revizyon nedeni gerekli.');
      const outputRef = ref.collection('ai_outputs').doc(`${body.nodeId}_${body.executionId}`);
      const record = (await tx.get(outputRef)).data();
      if (!record || record.status !== (body.decision === 'retry' ? 'rejected' : 'review_pending') || record.tenantId !== actor.tenantId) fail(409, 'Çıktı incelemeye açık değil.');
      if (body.decision === 'retry') {
        const executionId = randomUUID();
        step.status = 'ai_processing'; step.activeExecutionId = executionId;
        tx.update(ref, { ...runtimePatch(instance), updatedAt: new Date() });
        tx.create(ref.collection('audit_log').doc(), { action: 'ai_revision_requested', nodeId: body.nodeId, userId: actor.userId, timestamp: new Date() });
        return { jobs: [{ nodeId: body.nodeId, executionId }], template, duplicate: false };
      }
      step.status = body.decision === 'approved' ? 'completed' : 'revision_needed';
      step.aiExecutions = (step.aiExecutions || []).map((e: Data) => e.executionId === body.executionId
        ? { ...e, status: body.decision === 'approved' ? 'completed' : 'failed', reviewDecision: body.decision, reviewedBy: actor.userId } : e);
      if (body.decision === 'approved') {
        step.completedAt = new Date();
        instance.context[`step_${body.nodeId}`] = record.output;
      } else {
        step.currentRevision = (step.currentRevision || 0) + 1;
        step.revisions = [...(step.revisions || []), { revisionNumber: step.currentRevision, reason: body.reason.trim(), rejectedBy: actor.userId, rejectedAt: new Date() }];
      }
      tx.update(outputRef, { status: body.decision, reviewedBy: actor.userId, reviewedAt: new Date(), reason: body.reason || '' });
    }
    if (!trustedBrief) tx.create(briefRef, brief);
    const oldStatuses = Object.fromEntries(Object.entries(instance.steps).map(([id, value]) => [id, (value as Data).status]));
    const jobs = advance(instance, template);
    for (const next of template.nodes) {
      if (oldStatuses[next.id] !== 'pending' || instance.steps[next.id]?.status !== 'ready' || !next.assigneeRole) continue;
      tx.create(db.collection('notifications').doc(), { tenantId: actor.tenantId, type: 'task_ready',
        title: 'Yeni Görev Hazır', message: `"${next.label || next.id}" adımı sizin için hazır.`,
        relatedId: body.instanceId, relatedType: 'workflow_instance',
        metadata: { instanceId: body.instanceId, nodeId: next.id }, targetRole: next.assigneeRole,
        isRead: false, createdAt: new Date() });
    }
    tx.update(ref, { ...runtimePatch(instance), updatedAt: new Date(), lastActivityAt: new Date() });
    tx.create(ref.collection('audit_log').doc(), { action: mode === 'complete' ? 'step_completed' : `ai_output_${body.decision}`,
      nodeId: body.nodeId, userId: actor.userId, timestamp: new Date() });
    return { jobs, template, duplicate: false };
  });
  await Promise.all(outcome.jobs.map(async (job: any) => {
    try {
      await executeClaim(db, ref, outcome.template, job);
    } catch {
      await db.runTransaction(async (tx: any) => {
        const fresh = (await tx.get(ref)).data();
        const step = fresh.steps[job.nodeId];
        if (step.status !== 'ai_processing' || step.activeExecutionId !== job.executionId) return;
        tx.update(ref, { [`steps.${job.nodeId}.status`]: 'blocked',
          [`steps.${job.nodeId}.blockedReason`]: 'AI çalışması kaydedilemedi; yönetici incelemesi gerekli.', updatedAt: new Date() });
      });
    }
  }));
  return { success: true, duplicate: outcome.duplicate, aiTriggered: outcome.jobs.map((j: any) => j.nodeId) };
}
