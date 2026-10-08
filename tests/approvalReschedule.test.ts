import { describe, it, expect } from 'vitest';
import { planApproval, type ApprovalActor, type PlanSnapshot, type PostSnapshot } from '@/shared/approval/approvalEngine';

const plan = (over: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
  id: 'plan-1', tenantId: 't1', projectId: 'proj', postIds: ['p1'], status: 'approved', reviewRequestId: 'round-A', ...over,
});
const post = (status: string): PostSnapshot => ({ id: 'p1', tenantId: 't1', projectId: 'proj', contentPlanId: 'plan-1', status, hasScheduledAt: true, revisionCount: 0 });
const user = (role: string, assignedProjectIds: string[] = []): ApprovalActor => ({ kind: 'user', uid: `u-${role}`, tenantId: 't1', role, displayName: role, assignedProjectIds });
const AT = Date.UTC(2026, 9, 14, 7, 0);
const run = (actor: ApprovalActor, status: string, request: Record<string, unknown> = {}, p = plan()) =>
  planApproval({ actor, request: { action: 'reschedule', postIds: ['p1'], scheduledAt: AT, ...request } as any, plan: p, targetPosts: [post(status)], newId: () => 'round-B' });

describe('reschedule — onaylı/firmadaki zaman değişimi yeniden onay gerektirir', () => {
  for (const status of ['approved', 'pending_approval', 'scheduled']) {
    it(`${status}: iç incelemeye döner, onaylar temizlenir, yeni tur (eski müşteri ekranı geçersiz)`, () => {
      const r = run(user('brand_manager', ['proj']), status);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.postChanges).toHaveLength(1);
      expect(r.postChanges[0].toStatus).toBe('internal_review');
      expect((r.postChanges[0].fields.scheduledAt as Date).getTime()).toBe(AT);
      expect(r.postChanges[0].fields.approvedBy).toBeNull();
      expect(r.postChanges[0].fields.internalReviewedBy).toBeNull();
      expect(r.newReviewRequestId).toBe('round-B');
      expect(r.planFields.reviewRequestId).toBe('round-B');
      expect(r.planFields.approvedBy).toBeNull();
    });
  }

  it('eski turla müşteri onayı reddedilir (STALE_REVIEW)', () => {
    const r = planApproval({
      actor: user('client', ['proj']),
      request: { action: 'client_approve', reviewRequestId: 'round-A' },
      plan: plan({ status: 'pending_approval', reviewRequestId: 'round-B' }),
      targetPosts: [post('pending_approval')],
      newId: () => 'x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STALE_REVIEW');
  });

  it('henüz onaya gitmemiş içerikte yalnız zaman değişir, tur yenilenmez', () => {
    for (const status of ['draft', 'internal_review', 'revision_requested_internal', 'revision_requested']) {
      const r = run(user('admin'), status);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.postChanges[0].toStatus).toBe(status);
      expect(r.postChanges[0].fields).toEqual({ scheduledAt: new Date(AT) });
      expect(r.newReviewRequestId).toBeUndefined();
    }
  });

  it('yayınlanmış içerik yeniden zamanlanamaz', () => {
    const r = run(user('admin'), 'published');
    expect(r.ok).toBe(false);
  });

  it('müşteri, atanmamış marka yöneticisi ve başka tenant yapamaz', () => {
    expect(run(user('client', ['proj']), 'approved').ok).toBe(false);
    expect(run(user('brand_manager', ['other']), 'approved').ok).toBe(false);
    expect(run({ ...(user('admin') as any), tenantId: 't2' }, 'approved').ok).toBe(false);
  });

  it('tek post ve geçerli zaman zorunlu', () => {
    expect(run(user('admin'), 'approved', { postIds: undefined }).ok).toBe(false);
    expect(run(user('admin'), 'approved', { scheduledAt: 'yarın' }).ok).toBe(false);
    expect(run(user('admin'), 'approved', { scheduledAt: Number.NaN }).ok).toBe(false);
    expect(run(user('admin'), 'approved', { scheduledAt: Date.UTC(1999, 0, 1) }).ok).toBe(false);
  });
});
