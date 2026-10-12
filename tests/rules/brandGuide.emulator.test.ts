/**
 * Konuşmalı marka rehberi — YEREL EMÜLATÖR (demo-*; canlı DB/kimlik bilgisi yok): gerçek Firestore işlemleri
 * (iyimser sürüm, idempotency, onay) ve istemci kuralı (varsayılan red) birlikte doğrulanır. Model SAHTEDİR (ücretli çağrı yok).
 * Çalıştırma: firebase emulators:exec --config <ports.json> --only firestore --project demo-brand-guide "node ./node_modules/vitest/vitest.mjs run tests/rules/brandGuide.emulator.test.ts"
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { generateDraft, saveDraftEdit, approveDraft, loadGuideState, GUIDE_DRAFTS, GUIDE_VERSIONS, GUIDE_REQUESTS, GUIDE_LOCKS, GuideError } from '@/api/_lib/brandGuide/brandGuide';
import { BRAND_GUIDE_COLLECTION, brandGuideDocId, findApprovedGuide } from '@/api/_lib/planCopy/planCopy';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const T = 't1';
const P = 'p1';
const KEY = (n: number) => `guidekey-${String(n).padStart(8, '0')}`;
const BRIEF = { brandName: 'HAL', whatTheyDo: 'Mahalle fırını ve kahvaltı mekanı.', audience: 'Semt sakinleri', tone: 'Sıcak ve samimi', examples: 'Sabah ekmeği kokusuyla uyan semt.', avoid: 'indirim vaadi', free: '' };
const OUT = { toneLabels: ['samimi'], toneNotes: 'Sıcak.', avoid: ['indirim vaadi'], facts: ['Mahalle fırını ve kahvaltı mekanı'], openQuestions: [] };
let app: App;
let adb: Firestore;
let env: RulesTestEnvironment;
let modelCalls = 0;
const callModel: any = async () => { modelCalls++; return { id: `gen-${modelCalls}`, stopReason: 'end_turn', parsed: OUT, provider: 'openrouter', modelUsed: 'm/x', requestId: null, usageDetail: { inputTokens: 1, outputTokens: 1, totalTokens: 2, cachedTokens: 0, reasoningTokens: 0, costUsd: 0 } }; };
const gen = (o: Record<string, unknown> = {}) => generateDraft(adb, { callModel, model: 'anthropic/claude-sonnet-5.5' }, { tenantId: T, projectId: P, uid: 'u1', brief: BRIEF, expectedDraftVersion: 0, idempotencyKey: KEY(1), now: 100, ...o } as any);
const fail = async (p: Promise<unknown>): Promise<GuideError> => { try { await p; } catch (e) { return e as GuideError; } throw new Error('hata beklendi'); };

describe.skipIf(!HAS_EMULATOR)('marka rehberi: emülatörde gerçek işlemler', () => {
  beforeAll(async () => {
    const [h, p] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    app = initializeApp({ projectId: 'demo-brand-guide' }, 'brand-guide-test');
    adb = getFirestore(app);
    env = await initializeTestEnvironment({ projectId: 'demo-brand-guide', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: h, port: Number(p) } });
  });
  afterAll(async () => { await env?.cleanup(); await deleteApp(app); });
  beforeEach(async () => { await env.clearFirestore(); modelCalls = 0; vi.restoreAllMocks(); });

  it('taslak → insan düzenlemesi → onay: sürümler, değişmez kopya ve plan-copy\'nin okuduğu onaylı rehber', async () => {
    const d1 = (await gen()).draft;
    expect(d1.version).toBe(1);
    expect((await adb.collection(BRAND_GUIDE_COLLECTION).get()).size).toBe(0); // AI onaylı rehbere yazmadı
    const d2 = (await saveDraftEdit(adb, { tenantId: T, projectId: P, uid: 'u1', guide: { ...d1.guide, toneNotes: 'Elle' }, expectedDraftVersion: 1, idempotencyKey: KEY(2), now: 200 })).draft;
    const a = await approveDraft(adb, { tenantId: T, projectId: P, uid: 'admin1', confirm: true, expectedDraftVersion: 2, contentKey: d2.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(3), now: 300 });
    expect(a.approved.version).toBe(1);
    expect((await adb.doc(`${GUIDE_VERSIONS}/${brandGuideDocId(T, P)}_v1`).get()).exists).toBe(true);
    expect(await findApprovedGuide(adb, T, P)).toMatchObject({ version: 1, guide: { toneNotes: 'Elle' } });
    expect((await loadGuideState(adb, { tenantId: T, projectId: P })).approved!.version).toBe(1);
  });

  it('EŞZAMANLI onay: aynı taslak sürümüne iki farklı anahtarla onay → yalnız biri yazılır, diğeri 409 (onaylı sürüm tek kalır)', async () => {
    const d = (await gen()).draft;
    const mk = (n: number) => approveDraft(adb, { tenantId: T, projectId: P, uid: 'admin1', confirm: true, expectedDraftVersion: 1, contentKey: d.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(n), now: 300 });
    const rs = await Promise.allSettled([mk(10), mk(11)]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = rs.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(GuideError);
    expect((await adb.doc(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`).get()).data()!.version).toBe(1);
    expect((await adb.collection(GUIDE_VERSIONS).get()).size).toBe(1);
  });

  it('EŞZAMANLI düzenleme: aynı sürümden iki kayıt → yalnız biri kazanır, diğeri draft_conflict (insan düzenlemesi ezilmez)', async () => {
    const d = (await gen()).draft;
    const mk = (n: number, note: string) => saveDraftEdit(adb, { tenantId: T, projectId: P, uid: `u${n}`, guide: { ...d.guide, toneNotes: note }, expectedDraftVersion: 1, idempotencyKey: KEY(n), now: 200 });
    const rs = await Promise.allSettled([mk(20, 'A'), mk(21, 'B')]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(((rs.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as GuideError).code).toBe('draft_conflict');
  });

  it('EŞZAMANLI üretim (gerçek Firestore işlemleri): aynı anahtarla 5 paralel istek → TAM 1 sağlayıcı çağrısı, 1 taslak; kilit bırakılır', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    const slow: any = async () => { calls++; await gate; return callModel(); };
    const all = Array.from({ length: 5 }, () => generateDraft(adb, { callModel: slow, model: 'anthropic/claude-sonnet-5.5' }, { tenantId: T, projectId: P, uid: 'u1', brief: BRIEF, expectedDraftVersion: 0, idempotencyKey: KEY(40), now: 100 } as any).then((r) => ({ ok: r }), (e) => ({ err: e as GuideError })));
    await new Promise((r) => setTimeout(r, 400));
    release();
    const rs = await Promise.all(all);
    expect(calls).toBe(1);
    // Gerçek Firestore çakışmada yeniden dener: geç gelenler pending görür VEYA bitmiş kaydı replay olarak alır — hiçbiri modeli çağırmaz
    expect(rs.filter((r: any) => r.ok && !r.ok.replayed)).toHaveLength(1);
    expect(rs.filter((r: any) => r.err).every((r: any) => ['request_pending', 'idempotency_conflict'].includes(r.err.code))).toBe(true);
    expect((await adb.collection(GUIDE_DRAFTS).get()).size).toBe(1);
    expect((await adb.collection(GUIDE_LOCKS).get()).size).toBe(0);
    expect((await generateDraft(adb, { callModel: slow, model: 'm/x' }, { tenantId: T, projectId: P, uid: 'u1', brief: BRIEF, expectedDraftVersion: 0, idempotencyKey: KEY(40), now: 100 } as any)).replayed).toBe(true);
    expect(calls).toBe(1);
  });

  it('İDEMPOTENCY gerçek işlemlerle: aynı anahtar model\'i tekrar çağırmaz; farklı kullanıcı aynı anahtarı ayrı kullanır', async () => {
    await gen();
    expect((await gen()).replayed).toBe(true);
    expect(modelCalls).toBe(1);
    expect((await fail(gen({ brief: { ...BRIEF, brandName: 'X' } }))).code).toBe('idempotency_conflict');
  });

  it('İSTEMCİ ERİŞİMİ KAPALI: brand_guide_drafts, brand_guides, brand_guide_versions ve brand_guide_requests için hiçbir rol okuyamaz/yazamaz (tanımlı bir koleksiyonla karşılaştırmalı)', async () => {
    const d = (await gen()).draft;
    await approveDraft(adb, { tenantId: T, projectId: P, uid: 'admin1', confirm: true, expectedDraftVersion: 1, contentKey: d.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(30), now: 300 });
    await adb.doc(`${GUIDE_LOCKS}/${brandGuideDocId(T, P)}`).set({ tenantId: T, projectId: P, requestId: 'x', leaseUntil: 1 });
    await adb.doc('users/admin1').set({ tenantId: T, role: 'admin', profile: {} });
    await adb.doc('users/bm1').set({ tenantId: T, role: 'brand_manager', profile: { assignedProjectIds: [P] } });
    await adb.doc('users/other').set({ tenantId: 't2', role: 'admin', profile: {} });
    await adb.doc('projects/p1').set({ tenantId: T });
    await adb.doc('content_plans/plan1').set({ tenantId: T, projectId: P, status: 'draft' });
    await assertSucceeds(env.authenticatedContext('admin1').firestore().doc('content_plans/plan1').get()); // kontrol: tanımlı koleksiyon okunabilir
    const paths = [
      `${GUIDE_DRAFTS}/${brandGuideDocId(T, P)}`,
      `${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`,
      `${GUIDE_VERSIONS}/${brandGuideDocId(T, P)}_v1`,
      `${GUIDE_LOCKS}/${brandGuideDocId(T, P)}`,
      ...(await adb.collection(GUIDE_REQUESTS).get()).docs.map((x) => x.ref.path),
    ];
    for (const uid of ['admin1', 'bm1', 'other', null]) {
      const db = (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
      for (const path of paths) {
        await assertFails(db.doc(path).get());
        await assertFails(db.doc(path).set({ tenantId: T, projectId: P, version: 99 }));
        await assertFails(db.doc(path).delete());
      }
      await assertFails(db.collection(BRAND_GUIDE_COLLECTION).where('tenantId', '==', T).get());
    }
    expect((await adb.doc(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`).get()).data()!.version).toBe(1); // istemci denemeleri veriyi değiştirmedi
  });
});
