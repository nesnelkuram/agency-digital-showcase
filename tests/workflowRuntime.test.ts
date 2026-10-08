// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: null as any, agent: vi.fn(), access: vi.fn() }));
vi.mock('../api/_lib/firebaseAdmin', () => ({ getAdminDb: () => mocks.db }));
vi.mock('../api/_lib/projectAccess', () => ({ checkProjectAccess: mocks.access }));
vi.mock('../src/pipeline/workflow/orchestrator', () => ({ runWorkflowAgent: mocks.agent }));
import { transitionWorkflow } from '../api/_lib/workflowRuntime';

/** In-memory transactional store: all external storage and model calls are replaced. */
function store(seed: Record<string, any>) {
  const data = structuredClone(seed);
  let nextId = 0;
  let queue = Promise.resolve();
  const snapshot = (path: string) => ({ id: path.split('/').at(-1), exists: !!data[path], data: () => structuredClone(data[path]) });
  const patch = (path: string, update: any) => {
    for (const [key, value] of Object.entries(update)) {
      const parts = key.split('.'); let target = data[path];
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)!] = structuredClone(value);
    }
  };
  const document = (path: string): any => ({
    id: path.split('/').at(-1), path,
    get: async () => snapshot(path),
    create: async (value: any) => { if (data[path]) throw Error('exists'); data[path] = structuredClone(value); },
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (path: string, filters: Array<[string, any]> = []): any => ({
    doc: (id = `auto-${++nextId}`) => document(`${path}/${id}`),
    where: (key: string, _op: string, value: any) => collection(path, [...filters, [key, value]]),
    limit: () => collection(path, filters),
    get: async () => ({ docs: Object.keys(data).filter(k => k.startsWith(`${path}/`) && k.split('/').length === path.split('/').length + 1)
      .filter(k => filters.every(([key, value]) => data[k][key] === value)).map(snapshot) }),
  });
  return { data, collection, runTransaction: (fn: any) => {
    const run = queue.then(async () => {
      const writes: Array<() => void> = [];
      const value = await fn({ get: (ref: any) => ref.get(),
        update: (ref: any, update: any) => writes.push(() => patch(ref.path, update)),
        create: (ref: any, value: any) => writes.push(() => { data[ref.path] = structuredClone(value); }),
      });
      writes.forEach(w => w()); return value;
    });
    queue = run.catch(() => {}); return run;
  } };
}

const actor = { userId: 'manager', tenantId: 'tenant', userRole: 'brand_manager' };
let db: ReturnType<typeof store>;
const instance = () => db.data['workflow_instances/run'];
const template = () => db.data['workflow_templates/template'];
const complete = (formData = { subject: 'Yeni ürün' }) => transitionWorkflow(actor, { instanceId: 'run', nodeId: 'brief', formData }, 'complete');
const review = (decision = 'approved', extra = {}) => transitionWorkflow(actor, {
  instanceId: 'run', nodeId: 'copy', executionId: instance().steps.copy.activeExecutionId, decision, ...extra,
}, 'review');

beforeEach(() => {
  db = store({
    'workflow_instances/run': { tenantId: 'tenant', projectId: 'project', templateId: 'template', templateVersion: 1, status: 'active', context: {}, steps: {
      start: { status: 'completed' }, brief: { status: 'in_progress', assignment: { userId: 'manager' } },
      copy: { status: 'pending' }, handoff: { status: 'pending' }, end: { status: 'pending' },
    } },
    'workflow_templates/template': { tenantId: 'tenant', version: 1, nodes: [
      { id: 'start', type: 'start' },
      { id: 'brief', type: 'task', assigneeRole: 'brand_manager', formSchema: { fields: [{ id: 'subject', label: 'Konu', type: 'text', required: true }] } },
      { id: 'copy', type: 'ai_task', assigneeRole: 'brand_manager', aiAgentConfig: { promptTemplate: '{{subject}}', inputMapping: { subject: 'step_brief.subject' }, outputMapping: { caption: 'caption' }, requiresHumanReview: false } },
      { id: 'handoff', type: 'review', assigneeRole: 'brand_manager' }, { id: 'end', type: 'end' },
    ], edges: [{ source: 'start', target: 'brief' }, { source: 'brief', target: 'copy' }, { source: 'copy', target: 'handoff' }, { source: 'handoff', target: 'end' }] },
    'brand_leads/lead': { tenantId: 'tenant', businessName: 'Test Marka', updatedAt: 1, aiAnalysis: { brandPersonality: { tone: 'Sade' } } },
    'operational_briefs/brief-1': { tenantId: 'tenant', leadId: 'lead', status: 'completed', updatedAt: 5, catalog: { heroProducts: 'Cam bardak' }, constraints: { toneOrContentNoGo: 'Abartılı vaat yok', internalContacts: 'private', accountAccessReady: 'private' }, shareToken: 'private' },
  });
  mocks.db = db; mocks.agent.mockReset(); mocks.access.mockReset();
  mocks.agent.mockResolvedValue({ success: true, output: { caption: 'Camın yalın hali' }, confidenceScore: 0.9 });
  mocks.access.mockResolvedValue({ ok: true, project: { leadId: 'lead', tenantId: 'tenant' } });
});

describe('brief → AI → human review → next step', () => {
  it('runs the mock provider once, persists source context, and waits even with a high completeness score', async () => {
    await complete();
    expect(mocks.agent).toHaveBeenCalledTimes(1);
    const input = mocks.agent.mock.calls[0][0];
    expect(input.context.step_brief.subject).toBe('Yeni ürün');
    expect(input.context.operationalBrief.catalog.heroProducts).toBe('Cam bardak');
    expect(input.context.operationalBrief.constraints).toEqual({ toneOrContentNoGo: 'Abartılı vaat yok' });
    expect(JSON.stringify(input)).not.toContain('private');
    expect(input.context.brand.voiceSummary).toContain('Sade');
    expect(instance().steps.copy.status).toBe('ai_review');
    expect(instance().steps.handoff.status).toBe('pending');
    expect(instance().context.step_copy).toBeUndefined();
    await review();
    expect(instance().steps.copy.status).toBe('completed');
    expect(instance().context.step_copy.caption).toBe('Camın yalın hali');
    expect(instance().steps.handoff.status).toBe('ready');
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });
  it('keeps the original brief after edits to the source and does not accept client context injection', async () => {
    await transitionWorkflow(actor, { instanceId: 'run', nodeId: 'brief', formData: { subject: 'Yeni ürün', brand: 'fake' }, context: { brand: 'fake' } }, 'complete');
    const frozen = structuredClone(instance().context.workflowBrief);
    db.data['operational_briefs/brief-1'].catalog.heroProducts = 'Changed';
    instance().context.workflowBrief = { operationalBrief: { catalog: { heroProducts: 'Injected' } } };
    await review();
    expect(instance().context.workflowBrief).toEqual(frozen);
    expect(instance().context.step_brief).toEqual({ subject: 'Yeni ürün' });
    const record = Object.entries(db.data).find(([key]) => key.includes('/ai_outputs/'))![1];
    expect(record.input.context.operationalBrief.catalog.heroProducts).toBe('Cam bardak');
    expect(record.input.promptTemplate).toBe('{{subject}}');
  });
  it('deduplicates concurrent form submissions before model execution', async () => {
    await Promise.all([complete(), complete()]);
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });
  it('rejects stale approvals and preserves the waiting state', async () => {
    await complete();
    await expect(review('approved', { executionId: 'stale' })).rejects.toThrow('İnceleme güncel değil');
    expect(instance().steps.handoff.status).toBe('pending');
  });
  it('records a reason for rejection without advancing or regenerating', async () => {
    await complete();
    await review('rejected', { reason: 'Ürün özelliği yanlış' });
    expect(instance().steps.copy.status).toBe('revision_needed');
    expect(instance().steps.copy.revisions[0].reason).toBe('Ürün özelliği yanlış');
    expect(instance().steps.handoff.status).toBe('pending');
    expect(mocks.agent).toHaveBeenCalledTimes(1);
  });
  it('does not allow AI review to be bypassed through complete-step', async () => {
    await complete();
    await expect(transitionWorkflow(actor, { instanceId: 'run', nodeId: 'copy' }, 'complete')).rejects.toThrow('AI çıktısı ayrıca');
  });
  it('regenerates only after explicit retry and scopes feedback to that output', async () => {
    await complete();
    const oldId = instance().steps.copy.activeExecutionId;
    await review('rejected', { reason: 'Bu seride daha kısa yaz' });
    await review('retry');
    expect(mocks.agent).toHaveBeenCalledTimes(2);
    const input = mocks.agent.mock.calls[1][0];
    expect(input.systemPrompt).toContain('kalıcı marka kuralı değildir');
    expect(input.systemPrompt).toContain('Bu seride daha kısa yaz');
    expect(input.context.brand.systemPrompt).not.toContain('Bu seride');
    expect(instance().steps.copy.status).toBe('ai_review');
    await expect(review('approved', { executionId: oldId })).rejects.toThrow('İnceleme güncel değil');
    expect(Object.keys(db.data).filter(k => k.includes('/ai_outputs/'))).toHaveLength(2);
  });
  it('blocks failures instead of treating them as reviewed output', async () => {
    mocks.agent.mockResolvedValue({ success: false, output: {}, confidenceScore: 0, error: 'Provider unavailable' });
    await complete();
    expect(instance().steps.copy.status).toBe('blocked');
    expect(instance().steps.handoff.status).toBe('pending');
  });
  it('validates required brief input on the server before any state changes', async () => {
    await expect(complete({ subject: '  ' })).rejects.toThrow('Zorunlu alan eksik');
    expect(instance().steps.brief.status).toBe('in_progress');
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it('blocks missing mapped context before the provider call', async () => {
    template().nodes[2].aiAgentConfig.inputMapping.subject = 'absent.subject';
    await complete();
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(instance().steps.copy.status).toBe('blocked');
  });
  it('rejects cross-tenant and unassigned-project requests', async () => {
    await expect(transitionWorkflow({ ...actor, tenantId: 'other' }, { instanceId: 'run', nodeId: 'brief' }, 'complete')).rejects.toThrow('Erişim reddedildi');
    mocks.access.mockResolvedValue({ ok: false, httpStatus: 403, error: 'Atanmamış proje' });
    await expect(complete()).rejects.toThrow('Atanmamış proje');
    expect(mocks.agent).not.toHaveBeenCalled();
  });
  it('requires the configured human reviewer role', async () => {
    await complete();
    template().nodes[2].reviewConfig = { reviewerRole: 'account_manager' };
    await expect(review()).rejects.toThrow('inceleme yetkiniz yok');
  });
  it('requires matching template version and does not silently follow unsupported branches', async () => {
    template().version = 2;
    await expect(complete()).rejects.toThrow('Şablon sürümü değişti');
    template().version = 1; template().nodes[2].type = 'condition';
    await complete();
    expect(instance().steps.copy.status).toBe('blocked');
    expect(mocks.agent).not.toHaveBeenCalled();
  });
});
