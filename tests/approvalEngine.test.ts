import { describe, it, expect } from 'vitest';
import {
  planApproval,
  validatePostIdsParam,
  userCanAccessPlan,
  postBelongsToPlan,
  effectiveApprovalConfig,
  computePlanStatus,
  type ApprovalActor,
  type PlanSnapshot,
  type PostSnapshot,
  type ApprovalRequest,
} from '@/shared/approval/approvalEngine';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const TENANT = 't1';

const plan = (over: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
  id: 'plan-1',
  tenantId: TENANT,
  projectId: 'proj-rakle',
  postIds: ['p1', 'p2'],
  status: 'draft',
  reviewRequestId: null,
  ...over,
});

const post = (id: string, status: string, over: Partial<PostSnapshot> = {}): PostSnapshot => ({
  id,
  tenantId: TENANT,
  projectId: 'proj-rakle',
  contentPlanId: 'plan-1',
  status,
  hasScheduledAt: false,
  revisionCount: 0,
  ...over,
});

const user = (role: string, over: Partial<Extract<ApprovalActor, { kind: 'user' }>> = {}): ApprovalActor => ({
  kind: 'user',
  uid: `${role}-uid`,
  tenantId: TENANT,
  role,
  displayName: role,
  email: `${role}@x.com`,
  assignedProjectIds: [],
  ...over,
});

const share = (clientName = 'Ayşe'): ApprovalActor => ({ kind: 'share', clientName });

let counter = 0;
const run = (
  actor: ApprovalActor,
  request: ApprovalRequest,
  p: PlanSnapshot,
  posts: Array<PostSnapshot | null>,
  studioManaged = false
) => planApproval({ actor, request, plan: p, policy: { studioManaged }, targetPosts: posts, newId: () => `round-${++counter}` });

// ─── postIds doğrulaması ───────────────────────────────────────────────────
describe('validatePostIdsParam', () => {
  it('undefined → tüm plan', () => {
    expect(validatePostIdsParam(undefined)).toEqual({ ok: true, ids: undefined });
  });
  it.each([[[123]], [['']], [['post-A', 123]], [null], ['x'], [[]], [[' ']]])('geçersiz %j → hata', (value) => {
    expect(validatePostIdsParam(value).ok).toBe(false);
  });
  it('geçerli dizi tekilleştirilir', () => {
    expect(validatePostIdsParam(['a', 'a', 'b'])).toEqual({ ok: true, ids: ['a', 'b'] });
  });
  it('planApproval geçersiz postIds ile hiçbir değişiklik üretmez', () => {
    const r = run(user('admin'), { action: 'submit_to_client', postIds: [123] as any }, plan(), [post('p1', 'draft')]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('BAD_REQUEST');
  });
});

// ─── Erişim ─────────────────────────────────────────────────────────────────
describe('userCanAccessPlan', () => {
  it('başka tenant reddedilir (admin dahil)', () => {
    expect(userCanAccessPlan(user('admin', { tenantId: 't2' }) as any, plan())).toBe(false);
  });
  it('iç rol tenant içinde erişir', () => {
    expect(userCanAccessPlan(user('editor') as any, plan())).toBe(true);
  });
  it('brand_manager yalnızca atanmış projeye erişir', () => {
    expect(userCanAccessPlan(user('brand_manager') as any, plan())).toBe(false);
    expect(userCanAccessPlan(user('brand_manager', { assignedProjectIds: ['proj-rakle'] }) as any, plan())).toBe(true);
  });
  it('client: atanmış proje, uid veya e-posta', () => {
    expect(userCanAccessPlan(user('client') as any, plan())).toBe(false);
    expect(userCanAccessPlan(user('client') as any, plan({ assignedClientId: 'client-uid' }))).toBe(true);
    expect(userCanAccessPlan(user('client') as any, plan({ assignedClientEmail: 'CLIENT@x.com' }))).toBe(true);
  });
  it('client başka tenant planına atanmış olsa bile erişemez', () => {
    expect(userCanAccessPlan(user('client', { tenantId: 't2' }) as any, plan({ assignedClientId: 'client-uid' }))).toBe(false);
  });
});

describe('postBelongsToPlan', () => {
  it('farklı plan, proje veya tenant → false', () => {
    expect(postBelongsToPlan(post('p1', 'draft', { contentPlanId: 'plan-2' }), plan())).toBe(false);
    expect(postBelongsToPlan(post('p1', 'draft', { projectId: 'other' }), plan())).toBe(false);
    expect(postBelongsToPlan(post('p1', 'draft', { tenantId: 't2' }), plan())).toBe(false);
  });
  it('contentPlanId yoksa plan.postIds üyeliği gerekir', () => {
    expect(postBelongsToPlan(post('p1', 'draft', { contentPlanId: undefined }), plan())).toBe(true);
    expect(postBelongsToPlan(post('p9', 'draft', { contentPlanId: undefined }), plan())).toBe(false);
  });
});

// ─── Plana ait olmayan post ─────────────────────────────────────────────────
describe('post–plan bağı', () => {
  it('tek uyumsuz post tüm işlemi reddeder', () => {
    const r = run(user('admin'), { action: 'submit_to_client', postIds: ['p1', 'x'] }, plan(), [
      post('p1', 'draft'),
      post('x', 'draft', { contentPlanId: 'plan-2' }),
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NOT_IN_PLAN');
  });
  it('bulunamayan açık post → 404', () => {
    const r = run(user('admin'), { action: 'submit_to_client', postIds: ['p1', 'nope'] }, plan(), [post('p1', 'draft'), null]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('POST_NOT_FOUND');
  });
});

// ─── Paylaşım linki ─────────────────────────────────────────────────────────
describe('paylaşım linki aktörü', () => {
  it('isim olmadan işlem yapılamaz', () => {
    const r = run(share(''), { action: 'client_approve' }, plan({ status: 'pending_approval' }), [post('p1', 'pending_approval')]);
    expect(r.ok).toBe(false);
  });
  it('iç akış işlemi yapamaz', () => {
    const r = run(share(), { action: 'submit_to_client' }, plan(), [post('p1', 'draft')]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('FORBIDDEN');
  });
  it('post bazında karar veremez', () => {
    const r = run(share(), { action: 'client_approve', postIds: ['p1'] }, plan({ status: 'pending_approval' }), [post('p1', 'pending_approval')]);
    expect(r.ok).toBe(false);
  });
  it('plan bazında onay pending post\'ları onaylar ve yorum ekler', () => {
    const r = run(share(), { action: 'client_approve' }, plan({ status: 'pending_approval' }), [
      post('p1', 'pending_approval'),
      post('p2', 'draft'),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.postChanges.map((c) => [c.postId, c.toStatus])).toEqual([['p1', 'approved']]);
      expect(r.performedBy).toBe('anonymous:Ayşe');
      expect(r.comments).toHaveLength(1);
    }
  });
  it('revizyon açıklamasız reddedilir', () => {
    const r = run(share(), { action: 'client_reject' }, plan({ status: 'pending_approval' }), [post('p1', 'pending_approval')]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('COMMENT_REQUIRED');
  });
});

// ─── İnceleme turu (reviewRequestId) ────────────────────────────────────────
describe('inceleme turu', () => {
  it('müşteriye gönderim yeni tur açar', () => {
    const r = run(user('admin'), { action: 'submit_to_client' }, plan(), [post('p1', 'draft'), post('p2', 'draft')]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newReviewRequestId).toBeTruthy();
      expect(r.planFields.reviewRequestId).toBe(r.newReviewRequestId);
    }
  });
  it('eski turdan gelen onay reddedilir (A gösterilir → revize → B gönderilir)', () => {
    const current = plan({ status: 'pending_approval', reviewRequestId: 'round-B' });
    const r = run(user('client', { assignedProjectIds: ['proj-rakle'] }), { action: 'client_approve', reviewRequestId: 'round-A' }, current, [
      post('p1', 'pending_approval'),
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('STALE_REVIEW');
      expect(r.httpStatus).toBe(409);
    }
  });
  it('tur kimliği olmayan istek, tur taşıyan planda reddedilir', () => {
    const r = run(share(), { action: 'client_approve' }, plan({ status: 'pending_approval', reviewRequestId: 'round-B' }), [post('p1', 'pending_approval')]);
    expect(r.ok).toBe(false);
  });
  it('güncel tur kabul edilir', () => {
    const r = run(share(), { action: 'client_approve', reviewRequestId: 'round-B' }, plan({ status: 'pending_approval', reviewRequestId: 'round-B' }), [
      post('p1', 'pending_approval'),
    ]);
    expect(r.ok).toBe(true);
  });
  it('revizyona alma (reopen) turu yeniler ve onayları temizler', () => {
    const r = run(user('admin'), { action: 'reopen' }, plan({ status: 'approved', reviewRequestId: 'round-A' }), [post('p1', 'approved')]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.postChanges[0].toStatus).toBe('internal_review');
      expect(r.postChanges[0].fields.approvedBy).toBeNull();
      expect(r.planFields.reviewRequestId).not.toBe('round-A');
    }
  });
});

// ─── Studio politikası ──────────────────────────────────────────────────────
describe('studioManaged politikası', () => {
  it('plan ayarını ezer', () => {
    expect(effectiveApprovalConfig({ requireInternalReview: false, autoScheduleOnApproval: true }, { studioManaged: true })).toMatchObject({
      requireInternalReview: true,
      autoScheduleOnApproval: false,
    });
  });
  it('taslaktan doğrudan müşteriye gönderim reddedilir', () => {
    const r = run(user('admin'), { action: 'submit_to_client' }, plan(), [post('p1', 'draft')], true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INTERNAL_REVIEW_REQUIRED');
  });
  it('müşteri revizyonu yeniden gönderilince iç incelemeye döner', () => {
    const r = run(user('admin'), { action: 'resubmit' }, plan({ status: 'revision_requested' }), [post('p1', 'revision_requested')], true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.postChanges[0].toStatus).toBe('internal_review');
  });
  it('tarih olsa da onay approved kalır (zamanlama yok)', () => {
    const r = run(share(), { action: 'client_approve', reviewRequestId: 'r' }, plan({ status: 'pending_approval', reviewRequestId: 'r' }), [
      post('p1', 'pending_approval', { hasScheduledAt: true }),
    ], true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.postChanges[0].toStatus).toBe('approved');
  });
  it('studio dışı planda tarihli onay scheduled olur (eski davranış)', () => {
    const r = run(share(), { action: 'client_approve' }, plan({ status: 'pending_approval' }), [post('p1', 'pending_approval', { hasScheduledAt: true })]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.postChanges[0].toStatus).toBe('scheduled');
  });
});

// ─── Revizyonun geri alınması (Codex ara inceleme 1) ───────────────────────
describe('client_undo', () => {
  const clientActor = user('client', { assignedProjectIds: ['proj-rakle'] });
  it('revizyon kararı geri alınamaz (iç inceleme atlanamaz)', () => {
    const r = run(clientActor, { action: 'client_undo', postIds: ['p1'], reviewRequestId: 'r' }, plan({ status: 'revision_requested', reviewRequestId: 'r' }), [
      post('p1', 'revision_requested'),
    ], true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_ELIGIBLE_POSTS');
  });
  it('kendi onayını geri alabilir', () => {
    const r = run(clientActor, { action: 'client_undo', postIds: ['p1'], reviewRequestId: 'r' }, plan({ status: 'approved', reviewRequestId: 'r' }), [
      post('p1', 'approved'),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.postChanges[0].toStatus).toBe('pending_approval');
  });
});

// ─── Rol sınırları ──────────────────────────────────────────────────────────
describe('rol sınırları', () => {
  it('editor müşteriye doğrudan gönderemez, iç incelemeye gönderebilir', () => {
    expect(run(user('editor'), { action: 'submit_to_client' }, plan(), [post('p1', 'draft')]).ok).toBe(false);
    expect(run(user('editor'), { action: 'submit_for_review' }, plan(), [post('p1', 'draft')]).ok).toBe(true);
  });
  it('account_manager müşteriye gönderebilir', () => {
    expect(run(user('account_manager'), { action: 'submit_to_client' }, plan(), [post('p1', 'draft')]).ok).toBe(true);
  });
  it('müşteri iç akış işlemi yapamaz', () => {
    const r = run(user('client', { assignedProjectIds: ['proj-rakle'] }), { action: 'reopen' }, plan({ status: 'approved' }), [post('p1', 'approved')]);
    expect(r.ok).toBe(false);
  });
  it('iç revizyon açıklama ister', () => {
    const r = run(user('admin'), { action: 'internal_reject' }, plan({ status: 'internal_review' }), [post('p1', 'internal_review')]);
    expect(r.ok).toBe(false);
  });
});

// ─── Müşteri ataması ────────────────────────────────────────────────────────
describe('submit_to_client ataması', () => {
  it('atanan müşteriye proje erişimi verilir', () => {
    const r = run(
      user('admin'),
      { action: 'submit_to_client', assignee: { clientId: 'c1', clientName: 'Ayşe', clientEmail: ' AYSE@x.com ' } },
      plan(),
      [post('p1', 'draft')]
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grantProjectToClientUid).toBe('c1');
      expect(r.planFields.assignedClientEmail).toBe('ayse@x.com');
    }
  });
  it('post\'lar zaten müşterideyse sadece atama güncellenir', () => {
    const r = run(
      user('admin'),
      { action: 'submit_to_client', assignee: { clientName: 'Ayşe', clientEmail: 'a@x.com' } },
      plan({ status: 'pending_approval', reviewRequestId: 'r' }),
      [post('p1', 'pending_approval')]
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.postChanges).toHaveLength(0);
      expect(r.newReviewRequestId).toBeUndefined();
    }
  });
});

describe('computePlanStatus', () => {
  it('karma durumlar', () => {
    expect(computePlanStatus([])).toBe('draft');
    expect(computePlanStatus(['approved', 'scheduled'])).toBe('approved');
    expect(computePlanStatus(['approved', 'pending_approval'])).toBe('partially_approved');
    expect(computePlanStatus(['pending_approval', 'revision_requested'])).toBe('revision_requested');
    expect(computePlanStatus(['internal_review', 'draft'])).toBe('internal_review');
  });
});

// ─── İç / müşteri revizyon notu ayrımı (Codex ara inceleme 3) ───────────────
describe('revizyon notları', () => {
  it('iç revizyon notu müşteri alanına yazılmaz', () => {
    const r = run(user('admin'), { action: 'internal_reject', comment: 'YALNIZCA EKİP' }, plan({ status: 'internal_review' }), [post('p1', 'internal_review')]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.postChanges[0].fields.lastInternalRevisionComment).toBe('YALNIZCA EKİP');
      expect(r.postChanges[0].fields).not.toHaveProperty('lastRevisionComment');
    }
  });
  it('müşteri notu kaynağıyla birlikte yazılır', () => {
    const r = run(share(), { action: 'client_reject', comment: 'Rengi değişsin', reviewRequestId: 'r' }, plan({ status: 'pending_approval', reviewRequestId: 'r' }), [
      post('p1', 'pending_approval'),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.postChanges[0].fields.lastRevisionComment).toBe('Rengi değişsin');
      expect(r.postChanges[0].fields.lastRevisionCommentSource).toBe('client');
    }
  });
});

// ─── Plan aktif onay alanları (Codex ara inceleme 7) ────────────────────────
import { planApprovedFields } from '@/shared/approval/approvalEngine';
describe('planApprovedFields', () => {
  it('onaydan çıkınca aktif onay alanları silinir', () => {
    expect(planApprovedFields('pending_approval', 'u', 'U', 'approved')).toEqual({ approvedBy: null, approvedByName: null, approvedAt: null });
  });
  it('yeni onayda yazılır, zaten onaylıysa ilk onay korunur', () => {
    expect(planApprovedFields('approved', 'u', 'U', 'pending_approval')).toMatchObject({ approvedBy: 'u' });
    expect(planApprovedFields('approved', 'u2', 'U2', 'approved')).toEqual({});
  });
});
