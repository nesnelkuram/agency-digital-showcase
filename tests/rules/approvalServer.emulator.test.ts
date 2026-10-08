// @vitest-environment node
/**
 * Onay sunucusu — gerçek Firestore + Storage emülatörüyle kabul testleri (Admin SDK).
 * Çalıştırma: npm run emulators:rules (ayrı terminal) → npm run test:rules
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const PROJECT = 'demo-approval';
const BUCKET = `${PROJECT}.appspot.com`;

let server: typeof import('../../api/_lib/contentApprovalServer');
let admin: typeof import('../../api/_lib/firebaseAdmin');

const mediaUrl = (path: string, token: string) =>
  `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

const adminActor = { kind: 'user' as const, uid: 'admin1', tenantId: 't1', role: 'admin', displayName: 'Admin', assignedProjectIds: [] };

async function seedPost(id: string, status: string, media: string[]) {
  const db = admin.getAdminDb();
  await db.doc(`social_media_posts/${id}`).set({
    tenantId: 't1', projectId: 'projA', contentPlanId: 'planA', status, caption: 'x',
    media: media.map((url, i) => ({ id: `m${i}`, url, type: 'image', mimeType: 'image/png', size: 4, order: i })),
  });
}

describe.skipIf(!HAS_EMULATOR)('contentApprovalServer (emülatör)', () => {
  beforeAll(async () => {
    process.env.FIREBASE_PROJECT_ID = PROJECT;
    process.env.GCLOUD_PROJECT = PROJECT;
    process.env.FIREBASE_STORAGE_BUCKET = BUCKET;
    admin = await import('../../api/_lib/firebaseAdmin');
    server = await import('../../api/_lib/contentApprovalServer');
  });

  beforeEach(async () => {
    const db = admin.getAdminDb();
    for (const col of ['content_plans', 'social_media_posts', 'projects', 'users']) {
      const snap = await db.collection(col).get();
      await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
    }
    await db.doc('projects/projA').set({ tenantId: 't1', name: 'Rakle' });
    await db.doc('content_plans/planA').set({ tenantId: 't1', projectId: 'projA', status: 'internal_review', title: 'A', shareToken: 'tokA12345', postIds: [] });
  });

  it('henüz yüklenmemiş dosyanın URL\'si müşteriye açılamaz (sıfır yazma)', async () => {
    const path = `social-media-drafts/t1/projA/late-${Date.now()}.png`;
    await seedPost('p1', 'internal_review', [mediaUrl(path, 'tok1')]);
    const r = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MEDIA_SOURCE_INVALID');
    const post = await admin.getAdminDb().doc('social_media_posts/p1').get();
    expect(post.data().status).toBe('internal_review');
  });

  it('dosya mevcut ve token eşleşiyorsa açılır; token uyuşmazsa reddedilir', { timeout: 30_000 }, async () => {
    const storage = await admin.getAdminStorage();
    const path = `social-media-drafts/t1/projA/ok-${Date.now()}.png`;
    await storage.bucket(BUCKET).file(path).save(Buffer.from([137, 80, 78, 71]), {
      resumable: false,
      contentType: 'image/png',
      metadata: { metadata: { firebaseStorageDownloadTokens: 'tok-good' } },
    });

    await seedPost('p2', 'internal_review', [mediaUrl(path, 'tok-wrong')]);
    const bad = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve' } });
    expect(bad.ok).toBe(false);

    await seedPost('p2', 'internal_review', [mediaUrl(path, 'tok-good'), 'data:image/jpeg;base64,/9j/4AAQ']);
    const good = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve' } });
    expect(good.ok).toBe(true);
    const post = await admin.getAdminDb().doc('social_media_posts/p2').get();
    expect(post.data().status).toBe('pending_approval');
  });

  it('değiştirilebilir yol (avatar) reddedilir', async () => {
    await seedPost('p3', 'internal_review', [mediaUrl('avatars/u1/a.png', 'x')]);
    const r = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve' } });
    expect(r.ok).toBe(false);
  });

  it('medyasız post açılır; iç revizyon notu paylaşım yanıtına girmez', async () => {
    await seedPost('p4', 'internal_review', []);
    const rej = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_reject', comment: 'YALNIZCA EKİP' } });
    expect(rej.ok).toBe(true);
    await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'resubmit' } });
    const ok = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve' } });
    expect(ok.ok).toBe(true);

    const { default: shareHandler } = await import('../../api/content-approval/share');
    let status = 0;
    let body: any = null;
    const res: any = {
      setHeader: () => res,
      status: (s: number) => ((status = s), res),
      json: (b: any) => ((body = b), res),
    };
    await shareHandler({ method: 'GET', query: { token: 'tokA12345' } } as any, res);
    expect(status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('YALNIZCA EKİP');
  });

  it('onaylı içeriğin zamanı değişince iç incelemeye döner, yeni tur açılır, eski müşteri ekranı reddedilir', async () => {
    const db = admin.getAdminDb();
    await db.doc('content_plans/planA').set({ tenantId: 't1', projectId: 'projA', status: 'approved', title: 'A', shareToken: 'tokA12345', postIds: [], reviewRequestId: 'round-A', approvedBy: 'client1' });
    await db.doc('social_media_posts/r1').set({
      tenantId: 't1', projectId: 'projA', contentPlanId: 'planA', status: 'approved', caption: 'x', media: [],
      scheduledAt: new Date('2026-10-09T11:00:00Z'), approvedBy: 'client1', internalReviewedBy: 'bm1',
    });
    const at = Date.UTC(2026, 9, 10, 15, 0);
    const r = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'reschedule', postIds: ['r1'], scheduledAt: at } });
    expect(r.ok).toBe(true);
    const p = (await db.doc('social_media_posts/r1').get()).data();
    expect(p.status).toBe('internal_review');
    expect(p.scheduledAt.toDate().getTime()).toBe(at);
    expect(p.approvedBy).toBeUndefined();
    expect(p.internalReviewedBy).toBeUndefined();
    const plan = (await db.doc('content_plans/planA').get()).data();
    expect(plan.reviewRequestId).not.toBe('round-A');
    expect(plan.approvedBy).toBeUndefined();
    const events = await db.collection('content_plans/planA/approval_events').get();
    expect(events.docs.some((d: any) => d.data().action === 'reschedule')).toBe(true);

    // İç onaydan sonra firma eski ekrandan (round-A) onay veremez
    await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve' } });
    const clientActor = { kind: 'user' as const, uid: 'client1', tenantId: 't1', role: 'client', displayName: 'Firma', assignedProjectIds: ['projA'] };
    const stale = await server.executeApproval({ planId: 'planA', actor: clientActor, request: { action: 'client_approve', reviewRequestId: 'round-A' } });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe('STALE_REVIEW');
  });

  it('kütüphane medyası (brand-media) müşteriye açılır; dosya yoksa reddedilir', { timeout: 30_000 }, async () => {
    const storage = await admin.getAdminStorage();
    const path = `brand-media/t1/projA/asset-${Date.now()}/final.png`;
    await storage.bucket(BUCKET).file(path).save(Buffer.from([137, 80, 78, 71]), {
      metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: 'libtok' } },
    });
    await seedPost('l1', 'internal_review', [mediaUrl(path, 'libtok')]);
    const ok = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve', postIds: ['l1'] } });
    expect(ok.ok).toBe(true);
    await seedPost('l2', 'internal_review', [mediaUrl(`brand-media/t1/projA/missing-${Date.now()}/x.png`, 'libtok')]);
    const missing = await server.executeApproval({ planId: 'planA', actor: adminActor, request: { action: 'internal_approve', postIds: ['l2'] } });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('MEDIA_SOURCE_INVALID');
  });
});
