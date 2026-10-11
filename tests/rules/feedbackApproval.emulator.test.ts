// @vitest-environment node
/**
 * Ret/revizyon sebebi — mevcut onay geçişiyle AYNI transaction (gerçek Firestore emülatörü + Admin SDK).
 * Çalıştırma: firebase emulators:exec --only firestore --project demo-feedback-approval "<node> ./node_modules/vitest/vitest.mjs run tests/rules/feedbackApproval.emulator.test.ts"
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Timestamp as ClientTimestamp } from 'firebase/firestore';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-feedback-approval';

let server: typeof import('../../api/_lib/contentApprovalServer');
let admin: typeof import('../../api/_lib/firebaseAdmin');
let fb: typeof import('../../api/_lib/feedback/contentFeedback');
let cv: typeof import('../../shared/feedback/contentVersion');

const actor = (over: Record<string, any> = {}) => ({ kind: 'user' as const, uid: 'admin1', tenantId: 't1', role: 'admin', displayName: 'Admin', assignedProjectIds: [], ...over });
const SCHED = 1_760_000_000_000;

async function seed() {
  const db = admin.getAdminDb();
  await db.doc('projects/projA').set({ tenantId: 't1', name: 'Rakle', studioManaged: true });
  await db.doc('content_plans/planA').set({ tenantId: 't1', projectId: 'projA', status: 'internal_review', title: 'A', shareToken: 'tokA12345', postIds: ['p1'] });
  await db.doc('content_plans/planB').set({ tenantId: 't1', projectId: 'projA', status: 'internal_review', title: 'B', shareToken: 'tokB12345', postIds: ['p2'] });
  const { Timestamp } = await import('firebase-admin/firestore');
  const post = (planId: string) => ({ tenantId: 't1', projectId: 'projA', contentPlanId: planId, status: 'internal_review', caption: 'İlk metin', hashtags: ['tatlı'], media: [], mediaUrls: [], postType: 'static', platforms: ['instagram'], scheduledAt: Timestamp.fromMillis(SCHED), libraryAssetIds: [] });
  await db.doc('social_media_posts/p1').set(post('planA'));
  await db.doc('social_media_posts/p2').set(post('planB'));
  // Onaylı marka hafızası (değişmemeli)
  await db.doc('brand_leads/lead1').set({ tenantId: 't1', brandName: 'Rakle', analysis: { voice: 'samimi' } });
  await db.doc('agent_memories/m1').set({ tenantId: 't1', category: 'brand', content: 'onaylı not' });
  return db;
}

/** UI'nin gördüğü sürüm: istemci tarafı hash (WebCrypto) — sunucuyla aynı kanonik biçim */
async function seenHash(id: string) {
  const d = (await admin.getAdminDb().doc(`social_media_posts/${id}`).get()).data();
  return cv.contentHashOf({ ...d, scheduledAt: ClientTimestamp.fromMillis(d.scheduledAt.toMillis()) });
}

const reject = (planId: string, postId: string, feedback: any, a = actor()) =>
  server.executeApproval({ planId, actor: a as any, request: { action: 'internal_reject', postIds: [postId], comment: feedback.note || 'not' }, feedback });

describe.skipIf(!HAS_EMULATOR)('ret/revizyon sebebi + onay geçişi (emülatör)', () => {
  beforeAll(async () => {
    process.env.FIREBASE_PROJECT_ID = PROJECT;
    process.env.GCLOUD_PROJECT = PROJECT;
    admin = await import('../../api/_lib/firebaseAdmin');
    server = await import('../../api/_lib/contentApprovalServer');
    fb = await import('../../api/_lib/feedback/contentFeedback');
    cv = await import('../../shared/feedback/contentVersion');
  });

  beforeEach(async () => {
    const db = admin.getAdminDb();
    // alt koleksiyonlar (approval_events) dahil
    for (const col of ['content_plans', 'social_media_posts', 'projects', 'users', 'content_feedback', 'brand_leads', 'agent_memories']) await db.recursiveDelete(db.collection(col));
  });

  const KEY = 'key-0000000000000001';
  const base = (h: string, over: Record<string, any> = {}) => ({ category: 'metin', note: 'Metin çok uzun', scope: 'content_only', idempotencyKey: KEY, expectedContentHash: h, ...over });

  it('geçiş + sebep tek transaction: actor/zaman sunucudan, sürüm sunucu hash\'i; marka hafızası değişmez', async () => {
    const db = await seed();
    const memBefore = JSON.stringify([(await db.doc('brand_leads/lead1').get()).data(), (await db.doc('agent_memories/m1').get()).data()]);
    const h = await seenHash('p1');
    expect(h).toBe(fb.postContentHash((await db.doc('social_media_posts/p1').get()).data())); // istemci = sunucu
    const r = await reject('planA', 'p1', base(h));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.feedback).toEqual({ id: fb.feedbackDocId('t1', 'admin1', KEY), duplicate: false });
    expect((await db.doc('social_media_posts/p1').get()).data().status).toBe('revision_requested_internal');
    const f = (await db.doc(`content_feedback/${r.feedback!.id}`).get()).data();
    expect(f).toMatchObject({ tenantId: 't1', projectId: 'projA', target: { kind: 'post', postId: 'p1', planId: 'planA' }, action: 'internal_reject', category: 'metin', scope: 'content_only', actor: { uid: 'admin1', role: 'admin' }, contentVersion: { hash: h } });
    expect(typeof f.createdAt).toBe('number');
    expect(JSON.stringify([(await db.doc('brand_leads/lead1').get()).data(), (await db.doc('agent_memories/m1').get()).data()])).toBe(memBefore);
  });

  it('yanıt kayboldu → aynı anahtarla tekrar: geçiş yeniden çalışmaz, yeni kayıt yok; içerik sonradan revize edilse de', async () => {
    const db = await seed();
    const h = await seenHash('p1');
    expect((await reject('planA', 'p1', base(h))).ok).toBe(true);
    await db.doc('social_media_posts/p1').update({ caption: 'Revize metin' }); // içerik değişti
    const again = await reject('planA', 'p1', base(h));
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.feedback).toEqual({ id: fb.feedbackDocId('t1', 'admin1', KEY), duplicate: true });
    expect((await db.collection('content_feedback').get()).size).toBe(1);
    expect((await db.collection('content_plans/planA/approval_events').get()).size).toBe(1);
    expect((await db.collection('content_feedback').get()).docs[0].data().contentVersion.hash).toBe(h); // eski (görülen) sürüm
  });

  it('aynı anahtar farklı payload → 409 IDEMPOTENCY_CONFLICT', async () => {
    await seed();
    const h = await seenHash('p1');
    await reject('planA', 'p1', base(h));
    const r = await reject('planA', 'p1', base(h, { note: 'başka not' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('ekran açıkken içerik değişti → 409; geçiş ve sebep YAZILMAZ (kısmi sonuç yok)', async () => {
    const db = await seed();
    const h = await seenHash('p1');
    await db.doc('social_media_posts/p1').update({ caption: 'Başkası değiştirdi' });
    const r = await reject('planA', 'p1', base(h));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONTENT_VERSION_CHANGED');
    expect((await db.doc('social_media_posts/p1').get()).data().status).toBe('internal_review');
    expect((await db.collection('content_feedback').get()).size).toBe(0);
    expect((await db.collection('content_plans/planA/approval_events').get()).size).toBe(0);
  });

  it('istemcinin verdiği plan kimliğine güvenilmez: başka planın post\'u → red, yazma yok', async () => {
    const db = await seed();
    const h = await seenHash('p2');
    const r = await reject('planA', 'p2', base(h)); // p2 planB'ye ait
    expect(r.ok).toBe(false);
    expect((await db.doc('social_media_posts/p2').get()).data().status).toBe('internal_review');
    expect((await db.collection('content_feedback').get()).size).toBe(0);
  });

  it('başka tenant actor\'ı → red; sebep yazılmaz', async () => {
    const db = await seed();
    const h = await seenHash('p1');
    const r = await reject('planA', 'p1', base(h), actor({ uid: 'x9', tenantId: 't2' }));
    expect(r.ok).toBe(false);
    expect((await db.collection('content_feedback').get()).size).toBe(0);
  });

  it('geçiş o içeriği değiştirmiyorsa (zaten revizyonda) sebep tek başına yazılmaz', async () => {
    const db = await seed();
    await db.doc('social_media_posts/p1').update({ status: 'revision_requested_internal' });
    const h = await seenHash('p1');
    const r = await reject('planA', 'p1', base(h, { idempotencyKey: 'key-0000000000000002' }));
    expect(r.ok).toBe(false);
    expect((await db.collection('content_feedback').get()).size).toBe(0);
  });
});
