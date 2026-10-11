/**
 * Kalıcı planlayıcı taslağı — YEREL EMÜLATÖR (demo-*; canlı DB/kimlik bilgisi yok). Sunucu deposu gerçek Firestore
 * işlemleriyle (firebase-admin → emülatör) ve istemci kuralı (varsayılan red) birlikte doğrulanır.
 * Çalıştırma (ayrı portlarla): firebase emulators:exec --config <ports.json> --only firestore --project demo-planner-draft "node ./node_modules/vitest/vitest.mjs run tests/rules/plannerDraft.emulator.test.ts"
 */
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { saveDraft, loadDraft, DRAFTS, DRAFT_REQUESTS, draftDocId, DraftError } from '@/api/_lib/plannerDraft/plannerDraft';
import { BRAND_VOICE_COLLECTION } from '@/api/_lib/planCopy/planCopy';
import { draft, slot, provenanceDocs } from './../planner/draftHelpers';
import { COPY_ISSUED } from '@/api/_lib/planCopy/planCopy';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const T = 't1';
const P = 'p1';
const WEEK = '2026-10-12';
const KEY = (n: number) => `abcdefghijklmnop${String(n).padStart(4, '0')}`;
let app: App;
let adb: Firestore;
let env: RulesTestEnvironment;

const asset = (id: string, o: Record<string, any> = {}) => ({ tenantId: T, projectId: P, kind: 'photo', status: 'active', title: id, fileName: `${id}.jpg`, tags: [], createdBy: 'u', createdAt: 1, storage: { path: `brand-media/${T}/${P}/${id}/${id}.jpg`, width: 1080, height: 1350 }, ...o });
const save = (o: Record<string, unknown> = {}) => saveDraft(adb, { tenantId: T, projectId: P, uid: 'u1', weekStart: WEEK, expectedVersion: 0, idempotencyKey: KEY(1), draft: draft(), now: 1000, ...o } as any);
const fail = async (p: Promise<unknown>): Promise<DraftError> => { try { await p; } catch (e) { return e as DraftError; } throw new Error('hata beklendi'); };

describe.skipIf(!HAS_EMULATOR)('kalıcı taslak: emülatörde gerçek işlemler', () => {
  beforeAll(async () => {
    const [h, p] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    app = initializeApp({ projectId: 'demo-planner-draft' }, 'planner-draft-test');
    adb = getFirestore(app);
    env = await initializeTestEnvironment({ projectId: 'demo-planner-draft', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: h, port: Number(p) } });
  });
  afterAll(async () => { await env?.cleanup(); await deleteApp(app); });
  beforeEach(async () => {
    await env.clearFirestore();
    for (const id of ['a1', 'a2', 's1', 's2', 'd1', 'r1']) await adb.doc(`brand_media/${id}`).set(asset(id));
    await adb.doc('brand_media/old').set(asset('old', { status: 'archived' }));
    await adb.doc('brand_media/other-project').set(asset('other-project', { projectId: 'p2' }));
    await adb.doc('brand_media/other-tenant').set(asset('other-tenant', { tenantId: 't2' }));
    for (const [path, v] of provenanceDocs()) await adb.doc(path).set(v);
  });

  it('YENİDEN YÜKLEME: kaydedilen durum (Kalsın, metin, kırpma, seri, eleme, ret) taze okumada birebir döner', async () => {
    expect(await save()).toEqual({ version: 1, replayed: false });
    const loaded = await loadDraft(adb, { tenantId: T, projectId: P, weekStart: WEEK });
    expect(loaded!.draft).toEqual(draft());
    expect(loaded!.draft.feed[0]).toMatchObject({ locked: true, crop: { focus: { x: 0.3, y: 0.5 }, zoom: 1.5 } });
    expect(loaded!.draft.story[0]!.seriesKey).toBe('the-ghosting');
    // taze bir Firestore istemcisiyle okuma (oturum yeniden açılmış gibi)
    const raw = (await getFirestore(app).doc(`${DRAFTS}/${draftDocId(T, P, WEEK)}`).get()).data()!;
    expect(raw.version).toBe(1);
    expect(raw.draft.dismissed).toEqual([{ lane: 'feed', mediaId: 'd1' }]);
  });

  it('ESKİ SÜRÜM: güncel sürümle yazılır, eski sürümle 409 ve güncel veri korunur', async () => {
    await save();
    const d2 = draft({ dismissed: [] });
    expect(await save({ expectedVersion: 1, idempotencyKey: KEY(2), draft: d2 })).toEqual({ version: 2, replayed: false });
    expect(await fail(save({ expectedVersion: 1, idempotencyKey: KEY(3), draft: draft({ rejected: [] }) }))).toMatchObject({ status: 409, code: 'version_conflict', details: { currentVersion: 2 } });
    expect((await loadDraft(adb, { tenantId: T, projectId: P, weekStart: WEEK }))!.draft).toEqual(d2);
  });

  it('AYNI İSTEĞİN TEKRARI: önceki sonuç, yeniden yazım yok; farklı yükle aynı anahtar 409', async () => {
    await save();
    const before = (await adb.doc(`${DRAFTS}/${draftDocId(T, P, WEEK)}`).get()).data()!;
    expect(await save()).toEqual({ version: 1, replayed: true });
    expect((await adb.doc(`${DRAFTS}/${draftDocId(T, P, WEEK)}`).get()).data()).toEqual(before);
    expect((await adb.collection(DRAFT_REQUESTS).get()).size).toBe(1);
    expect(await fail(save({ draft: draft({ dismissed: [] }) }))).toMatchObject({ status: 409, code: 'idempotency_conflict' });
  });

  it('EŞZAMANLI YAZIM: aynı sürümden başlayan 5 yazımdan YALNIZ biri kazanır; sürüm 1 kalır; diğerleri version_conflict', async () => {
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => save({ idempotencyKey: KEY(n), draft: draft({ dismissed: [{ lane: 'feed', mediaId: 'd1' }], rejected: [{ mediaId: 'r1', category: 'tekrar', note: `yazar ${n}`, scope: 'content_only' }] }) })));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(4);
    for (const b of bad) expect(b.reason).toMatchObject({ status: 409, code: 'version_conflict' });
    expect((await loadDraft(adb, { tenantId: T, projectId: P, weekStart: WEEK }))!.version).toBe(1);
  });

  it('EŞZAMANLI TEKRAR: aynı anahtar/yük 5 kez eşzamanlı → tek yazım, tümü sürüm 1 döner', async () => {
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => save()));
    expect(rs.every((r) => r.version === 1)).toBe(true);
    expect(rs.filter((r) => !r.replayed)).toHaveLength(1);
    expect((await adb.collection(DRAFT_REQUESTS).get()).size).toBe(1);
  });

  it('BOZUK LİSTE ve şema ihlali: 422, hiçbir belge yazılmaz', async () => {
    for (const mut of [{ dismissed: [null] }, { rejected: [null] }, { dismissed: [{}] }, { feed: [null] }, { dismissed: ['x'] }]) {
      expect(await fail(save({ draft: { ...draft(), ...mut }, idempotencyKey: KEY(20) }))).toMatchObject({ status: 422, code: 'draft_invalid' });
    }
    expect((await adb.collection(DRAFTS).get()).size).toBe(0);
    expect((await adb.collection(DRAFT_REQUESTS).get()).size).toBe(0);
  });

  it('BAŞKA MARKA/TENANT: yabancı medya 422 (varlık sızmaz); arşivli slot reddedilir, arşivli eleme kabul; başka kapsam taslağı okunamaz', async () => {
    const feedWith = (id: string) => draft({ feed: [slot(id), ...Array(8).fill(null)] as any });
    for (const id of ['other-project', 'other-tenant', 'ghost']) expect(await fail(save({ draft: feedWith(id), idempotencyKey: KEY(30) }))).toMatchObject({ status: 422, code: 'media_invalid', details: [{ id, reason: 'unknown_media' }] });
    expect(await fail(save({ draft: feedWith('old'), idempotencyKey: KEY(31) }))).toMatchObject({ details: [{ id: 'old', reason: 'archived' }] });
    expect(await save({ draft: draft({ dismissed: [{ lane: 'feed', mediaId: 'old' }] }), idempotencyKey: KEY(32) })).toMatchObject({ version: 1 });
    expect(await loadDraft(adb, { tenantId: 't2', projectId: P, weekStart: WEEK })).toBeNull();
    expect(await loadDraft(adb, { tenantId: T, projectId: 'p2', weekStart: WEEK })).toBeNull();
    // aynı hafta başka projede bağımsız belge
    await adb.doc('brand_media/b1').set(asset('b1', { projectId: 'p2' }));
    const other = { weekStart: WEEK, feed: [slot('b1'), ...Array(8).fill(null)], story: Array(9).fill(null), dismissed: [], rejected: [] };
    expect(await saveDraft(adb, { tenantId: T, projectId: 'p2', uid: 'u1', weekStart: WEEK, expectedVersion: 0, idempotencyKey: KEY(33), draft: other, now: 2 })).toMatchObject({ version: 1 });
    expect((await loadDraft(adb, { tenantId: T, projectId: P, weekStart: WEEK }))!.version).toBe(1);
  });

  it('PROJE KAPSAMI: aynı tenant+uid+anahtar ve aynı BOŞ yük iki projede — ikinci projede yazılmadan replayed:true DÖNMEZ', async () => {
    await adb.doc('brand_media/b1').set(asset('b1', { projectId: 'p2' }));
    const empty = { weekStart: WEEK, feed: Array(9).fill(null), story: Array(9).fill(null), dismissed: [], rejected: [] };
    expect(await save({ draft: empty })).toEqual({ version: 1, replayed: false });
    const e = await fail(saveDraft(adb, { tenantId: T, projectId: 'p2', uid: 'u1', weekStart: WEEK, expectedVersion: 0, idempotencyKey: KEY(1), draft: empty, now: 5 } as any));
    expect(e).toMatchObject({ status: 409, code: 'idempotency_conflict' });
    expect(await loadDraft(adb, { tenantId: T, projectId: 'p2', weekStart: WEEK })).toBeNull();
    expect((await adb.collection(DRAFTS).get()).size).toBe(1);
    // aynı kapsam tekrarı hâlâ güvenle replay
    expect(await save({ draft: empty })).toEqual({ version: 1, replayed: true });
    expect((await adb.collection(DRAFT_REQUESTS).get()).docs[0].data()).toMatchObject({ tenantId: T, projectId: P, weekStart: WEEK });
  });

  it('YARIŞ: doğrulama okuması işlemin İÇİNDE; transaction ortasında dışarıdan arşivlenen medya, eski kontrolle yazılan taslağa dönüşemez', async () => {
    // saveDraft'ın medya okumasından hemen sonra, işlem sürerken medyayı dışarıdan arşivlemeye çalışan bir yazar başlat.
    let archive: Promise<unknown> | null = null;
    let archiveDoneAt = 0;
    let saveDoneAt = 0;
    let tick = 0;
    const racing: any = new Proxy(adb, {
      get(target, prop, recv) {
        if (prop !== 'runTransaction') return Reflect.get(target, prop, target);
        return (fn: any) => target.runTransaction(async (tx: any) => fn(new Proxy(tx, {
          get(t, p) {
            if (p !== 'get') return typeof (t as any)[p] === 'function' ? (t as any)[p].bind(t) : (t as any)[p];
            return async (ref: any) => {
              const r = await t.get(ref);
              if (!archive && ref.path === 'brand_media/a2') {
                archive = target.doc('brand_media/a2').update({ status: 'archived' }).then(() => { archiveDoneAt = ++tick; });
                await new Promise((res) => setTimeout(res, 400)); // yazarın araya girmesi için süre tanı
              }
              return r;
            };
          },
        })));
      },
    });
    const outcome = await saveDraft(racing, { tenantId: T, projectId: P, uid: 'u1', weekStart: WEEK, expectedVersion: 0, idempotencyKey: KEY(50), draft: draft(), now: 7 } as any).then((r) => ({ ok: true as const, r }), (e) => ({ ok: false as const, e }));
    saveDoneAt = ++tick;
    await archive;
    // Tutarlılık: arşivleme, taslağın doğrulandığı okumadan SONRA ve taslak yazımı tamamlanmadan ÖNCE tamamlanmış olamaz.
    if (outcome.ok) expect(archiveDoneAt).toBeGreaterThan(saveDoneAt); // kilit: yazar işlem bitene dek bekledi
    else expect(outcome.e).toMatchObject({ code: 'media_invalid' }); // veya işlem yeniden okudu ve reddetti
    expect(archiveDoneAt).toBeGreaterThan(0);
    // sonuç ne olursa olsun kayıtlı taslak yalnız ONAYLANMIŞ bir okumaya dayanır
    const stored = await loadDraft(adb, { tenantId: T, projectId: P, weekStart: WEEK });
    if (outcome.ok) expect(stored!.version).toBe(1); else expect(stored).toBeNull();
  });

  it('SERİ + MODEL KAYNAĞI (gerçek işlem): doğrulanmamış seriesKey ve sunucuda üretilmemiş model hash\'i 422; sunucu kayıtlı metin kabul', async () => {
    const d = draft();
    const noSeries = draft({ story: [{ ...d.story[0]!, seriesKey: 'uydurma' }, ...d.story.slice(1)] as any });
    expect(await fail(save({ draft: noSeries, idempotencyKey: KEY(51) }))).toMatchObject({ status: 422, code: 'series_unverified' });
    const forged = draft({ feed: [{ ...d.feed[0]!, text: { ...d.feed[0]!.text!, responseId: 'resp-uydurma' } }, ...d.feed.slice(1)] as any });
    expect(await fail(save({ draft: forged, idempotencyKey: KEY(52) }))).toMatchObject({ code: 'provenance_invalid', details: [{ reason: 'not_issued_by_server' }] });
    expect((await adb.collection(DRAFTS).get()).size).toBe(0);
    expect(await save({ idempotencyKey: KEY(53) })).toMatchObject({ version: 1 });
  });

  it('İSTEMCİ ERİŞİMİ KAPALI: planner_drafts, planner_draft_requests ve brand_voice_context için hiçbir rol okuyamaz/yazamaz (tanımlı bir koleksiyonla karşılaştırmalı)', async () => {
    await save();
    await adb.doc(`${BRAND_VOICE_COLLECTION}/${T}_${P}`).set({ tenantId: T, projectId: P, bundle: {} });
    await adb.doc('users/admin1').set({ tenantId: T, role: 'admin', profile: {} });
    await adb.doc('users/bm1').set({ tenantId: T, role: 'brand_manager', profile: { assignedProjectIds: [P] } });
    await adb.doc('users/other').set({ tenantId: 't2', role: 'admin', profile: {} });
    await adb.doc('projects/p1').set({ tenantId: T });
    await adb.doc('content_plans/plan1').set({ tenantId: T, projectId: P, status: 'draft' });
    const draftPath = `${DRAFTS}/${draftDocId(T, P, WEEK)}`;
    await assertSucceeds(env.authenticatedContext('admin1').firestore().doc('content_plans/plan1').get()); // kontrol: tanımlı koleksiyon okunabilir
    for (const uid of ['admin1', 'bm1', 'other', null]) {
      const db = (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
      for (const path of [draftPath, `${DRAFT_REQUESTS}/x`, `${BRAND_VOICE_COLLECTION}/${T}_${P}`, ...(await adb.collection(COPY_ISSUED).get()).docs.map((d) => d.ref.path)]) {
        await assertFails(db.doc(path).get());
        await assertFails(db.doc(path).set({ tenantId: T, projectId: P, version: 99 }));
        await assertFails(db.doc(path).delete());
      }
      await assertFails(db.collection(DRAFTS).where('tenantId', '==', T).get());
    }
    expect((await loadDraft(adb, { tenantId: T, projectId: P, weekStart: WEEK }))!.version).toBe(1); // istemci denemeleri veriyi değiştirmedi
  });
});
