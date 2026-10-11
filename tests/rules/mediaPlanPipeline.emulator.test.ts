// @vitest-environment node
/**
 * Analiz kuyruğu + plan envanteri — gerçek Firestore emülatörü + Admin SDK (gerçek Timestamp ve sorgu biçimleri).
 * Model çağrıları sahte; dış servis yok.
 * Çalıştırma: firebase emulators:exec --only firestore --project demo-media-plan "<node> ./node_modules/vitest/vitest.mjs run tests/rules/mediaPlanPipeline.emulator.test.ts"
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-media-plan';
const T = 't1';
const P = 'p1';
const BUCKET = 'demo.appspot.com';
const HOST = 'firebasestorage.googleapis.com';

let admin: typeof import('../../api/_lib/firebaseAdmin');
let q: typeof import('../../api/_lib/mediaAnalysis/autoQueue');
let runner: typeof import('../../api/_lib/mediaAnalysis/runner');
let plan: typeof import('../../api/_lib/planSuggest/planSuggest');
let corr: typeof import('../../api/_lib/mediaAnalysis/correctionStore');
let Timestamp: any;

const CATALOG = {
  subject: 'tatlı', description: 'd', tags: ['tatlı'], visibleObjects: [], foodCategories: ['tatlı'],
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: false },
  productIdentity: { status: 'belirsiz', note: '' }, usageSuggestions: ['feed'], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta',
};

describe.skipIf(!HAS_EMULATOR)('medya analiz kuyruğu + plan envanteri (emülatör)', () => {
  beforeAll(async () => {
    process.env.FIREBASE_PROJECT_ID = PROJECT;
    process.env.GCLOUD_PROJECT = PROJECT;
    admin = await import('../../api/_lib/firebaseAdmin');
    q = await import('../../api/_lib/mediaAnalysis/autoQueue');
    runner = await import('../../api/_lib/mediaAnalysis/runner');
    plan = await import('../../api/_lib/planSuggest/planSuggest');
    corr = await import('../../api/_lib/mediaAnalysis/correctionStore');
    Timestamp = (await import('firebase-admin/firestore')).Timestamp;
  });

  beforeEach(async () => {
    const db = admin.getAdminDb();
    for (const col of ['brand_media', 'social_media_posts', q.ANALYSIS_QUEUE, q.ANALYSIS_CURSOR_COL, 'media_ai_analyses', 'media_ai_analysis_latest', corr.CORRECTIONS]) {
      const snap = await db.collection(col).get();
      await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
    }
  });

  const SINCE = Date.parse('2026-10-12T06:00:00Z');
  async function seed(n: number) {
    const db = admin.getAdminDb();
    const batch = db.batch();
    const base = Math.floor(SINCE / 1000);
    for (let i = 0; i < n; i++) {
      const id = `m${String(i).padStart(3, '0')}`;
      const path = `brand-media/${T}/${P}/${id}/${id}.jpg`;
      batch.set(db.collection('brand_media').doc(id), {
        tenantId: T, projectId: P, kind: 'photo', status: 'active', title: id, fileName: `${id}.jpg`, tags: [], createdBy: 'u',
        // 60 kayıt aynı milisaniyede (mikrosaniyeleri farklı) → pageSize 25'i aşar
        createdAt: new Timestamp(base + 10, 5_000_000 + i * 1_000),
        storage: { path, downloadUrl: `https://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=x`, contentType: 'image/jpeg', size: 1000, width: 1080, height: 1350 },
      });
    }
    batch.set(db.collection('brand_media').doc('archive'), { tenantId: T, projectId: P, kind: 'photo', status: 'active', createdAt: new Timestamp(base - 3600, 0), storage: {} });
    await batch.commit();
    return db;
  }

  it('aktivasyon anından sonraki 60 kayıp bildirim gerçek Timestamp cursor ile kuyruğa girer; arşiv girmez; işçi gerçek sorguyla bitirir', async () => {
    const db = await seed(60);
    const NOW = SINCE + 3_600_000;
    const tv = (ms: number) => Timestamp.fromMillis(ms);
    let total = 0;
    for (let run = 0; run < 4; run++) {
      let ticks = 0;
      total += (await q.reconcileNewMedia(db, { featureEnabled: true, sinceMs: SINCE, now: NOW, pageSize: 25, timeValue: tv, clock: () => ticks++, deadline: 2 })).queued;
    }
    expect(total).toBe(60);
    const jobs = await db.collection(q.ANALYSIS_QUEUE).get();
    expect(jobs.size).toBe(60);
    expect(jobs.docs.some((d: any) => d.data().assetId === 'archive')).toBe(false);

    const callModel = vi.fn(async () => ({ id: 'm', stopReason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, parsed: CATALOG as any }));
    const deps = { owner: 'w', now: () => NOW, analysisDeps: () => ({ store: runner.firestoreAnalysisStore(db), readBytes: async (p: string) => Buffer.from(p), callModel, now: () => NOW }) };
    const out = await q.processAnalysisQueue(db, deps, { featureEnabled: true, limit: 100, pageSize: 25 });
    expect(out.states).toEqual({ done: 60 });
    expect(callModel).toHaveBeenCalledTimes(60);
    expect((await q.processAnalysisQueue(db, deps, { featureEnabled: true })).considered).toBe(0);
  }, 120_000);

  it('plan envanteri gerçek sorguyla: insan düzeltmesi korunur, başka proje ve arşiv dışarıda', async () => {
    const db = await seed(3);
    await db.collection('brand_media').doc('m001').update({ status: 'archived' });
    const otherPath = `brand-media/${T}/p2/x/x.jpg`;
    await db.collection('brand_media').doc('x').set({ tenantId: T, projectId: 'p2', kind: 'photo', status: 'active', createdAt: Timestamp.now(), storage: { path: otherPath, downloadUrl: `https://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(otherPath)}?alt=media`, contentType: 'image/jpeg', size: 1, width: 1080, height: 1350 } });
    await db.collection('media_ai_analysis_latest').doc(`${T}_${P}_m000`).set({ key: 'k0' });
    await db.collection('media_ai_analyses').doc('k0').set({ tenantId: T, projectId: P, sourceId: 'm000', status: 'done', result: CATALOG, sourceQuality: 'original' });
    await corr.saveCorrection(db, { tenantId: T, projectId: P, assetId: 'm000', input: { overrides: { subject: 'insan konusu' } }, uid: 'u', now: 1 });
    const inv = await plan.buildInventory(db, { tenantId: T, projectId: P, policy: { buckets: [BUCKET], hosts: [HOST] } });
    expect(inv.items.map((i) => i.mediaId).sort()).toEqual(['m000', 'm002']);
    expect(inv.items.find((i) => i.mediaId === 'm000')!.line).toContain('konu:insan konusu');
  });
});
