// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { validatePlannerDraft, draftMediaRefs, MAX_DISMISSED, MAX_REJECTED } from '@/shared/planner/plannerDraft';
import { saveDraft, loadDraft, DraftError, DRAFTS, DRAFT_REQUESTS, draftDocId } from '@/api/_lib/plannerDraft/plannerDraft';
import { seedAsset, T, P } from './feedPlanner/integration/liveFixtures';
import { draft, slot, issuedText, provenanceDocs, RESP } from './planner/draftHelpers';
import { copyContentHash } from '@/shared/planner/copyContract';

const KEY = (n: number) => `abcdefghijklmnop${String(n).padStart(4, '0')}`;
const clone = <X>(x: X): X => JSON.parse(JSON.stringify(x));

describe('taslak şeması (liste elemanları dahil; fırlatmaz)', () => {
  it('geçerli taslak kabul; medya başvuruları ayrılır (slot/diğer)', () => {
    const r = validatePlannerDraft(draft());
    expect(r.ok).toBe(true);
    expect(draftMediaRefs(draft())).toEqual({ slotIds: ['a1', 'a2', 's1', 's2'], otherIds: ['d1', 'r1'] });
  });

  const bad: Array<[string, (d: any) => any]> = [
    ['null', () => null], ['dizi', () => []], ['metin', () => 'x'],
    ['bilinmeyen üst alan', (d) => ({ ...d, tenantId: 't2' })],
    ['weekStart kötü', (d) => ({ ...d, weekStart: '12 Ekim' })],
    ['feed 8 slot', (d) => ({ ...d, feed: d.feed.slice(1) })],
    ['story null', (d) => ({ ...d, story: null })],
    ['slot metin', (d) => ({ ...d, feed: ['a1', ...d.feed.slice(1)] })],
    ['slot bilinmeyen alan', (d) => ({ ...d, feed: [{ ...d.feed[0], x: 1 }, ...d.feed.slice(1)] })],
    ['mediaId güvensiz', (d) => ({ ...d, feed: [{ ...d.feed[0], mediaId: '../x' }, ...d.feed.slice(1)] })],
    ['feed formatı story', (d) => ({ ...d, feed: [{ ...d.feed[0], format: 'story' }, ...d.feed.slice(1)] })],
    ['story formatı feed', (d) => ({ ...d, story: [{ ...d.story[0], format: 'feed-4x5' }, ...d.story.slice(1)] })],
    ['locked metin', (d) => ({ ...d, feed: [{ ...d.feed[0], locked: 'evet' }, ...d.feed.slice(1)] })],
    ['text eksik', (d) => ({ ...d, feed: [(({ text, ...r }) => r)(d.feed[0]), ...d.feed.slice(1)] })],
    ['text boş nesne', (d) => ({ ...d, feed: [{ ...d.feed[0], text: {} }, ...d.feed.slice(1)] })],
    ['text caption+headline', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, headline: 'x' } }, ...d.feed.slice(1)] })],
    ['text çok uzun', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, caption: 'x'.repeat(1501) } }, ...d.feed.slice(1)] })],
    ['başlık çok uzun', (d) => ({ ...d, story: [{ ...d.story[0], text: { ...d.story[0].text, headline: 'x'.repeat(71) } }, ...d.story.slice(1)] })],
    ['text sayı', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, caption: 5 } }, ...d.feed.slice(1)] })],
    ['model metni hash/responseId yok', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { caption: 'x', source: 'model', lang: 'tr' } }, ...d.feed.slice(1)] })],
    ['source geçersiz', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, source: 'sablon' } }, ...d.feed.slice(1)] })],
    ['lang geçersiz', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, lang: 'fr' } }, ...d.feed.slice(1)] })],
    ['evidenceBasis geçersiz', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, evidenceBasis: 'uydurma' } }, ...d.feed.slice(1)] })],
    ['contentHash kötü', (d) => ({ ...d, feed: [{ ...d.feed[0], text: { ...d.feed[0].text, contentHash: 'XYZ' } }, ...d.feed.slice(1)] })],
    ['crop zoom aralık dışı', (d) => ({ ...d, feed: [{ ...d.feed[0], crop: { focus: { x: 0.5, y: 0.5 }, zoom: 9 } }, ...d.feed.slice(1)] })],
    ['crop odak aralık dışı', (d) => ({ ...d, feed: [{ ...d.feed[0], crop: { focus: { x: 2, y: 0.5 }, zoom: 1 } }, ...d.feed.slice(1)] })],
    ['crop NaN', (d) => ({ ...d, feed: [{ ...d.feed[0], crop: { focus: { x: NaN, y: 0.5 }, zoom: 1 } }, ...d.feed.slice(1)] })],
    ['crop focus eksik', (d) => ({ ...d, feed: [{ ...d.feed[0], crop: { zoom: 1 } }, ...d.feed.slice(1)] })],
    ['feed seri kimliği', (d) => ({ ...d, feed: [{ ...d.feed[0], seriesKey: 'the-ghosting' }, ...d.feed.slice(1)] })],
    ['seriesKey güvensiz', (d) => ({ ...d, story: [{ ...d.story[0], seriesKey: 'a b' }, ...d.story.slice(1)] })],
    ['aynı medya iki slotta', (d) => ({ ...d, feed: [d.feed[0], { ...d.feed[1], mediaId: 'a1' }, ...d.feed.slice(2)] })],
    ['aynı medya feed ve story', (d) => ({ ...d, story: [{ ...d.story[0], mediaId: 'a1' }, ...d.story.slice(1)] })],
    ['dismissed null', (d) => ({ ...d, dismissed: null })],
    ['dismissed [null]', (d) => ({ ...d, dismissed: [null] })],
    ['dismissed [undefined]', (d) => ({ ...d, dismissed: [undefined] })],
    ['dismissed [metin]', (d) => ({ ...d, dismissed: ['d1'] })],
    ['dismissed [{}]', (d) => ({ ...d, dismissed: [{}] })],
    ['dismissed lane yok', (d) => ({ ...d, dismissed: [{ mediaId: 'd1' }] })],
    ['dismissed mediaId sayı', (d) => ({ ...d, dismissed: [{ lane: 'feed', mediaId: 7 }] })],
    ['dismissed bilinmeyen alan', (d) => ({ ...d, dismissed: [{ lane: 'feed', mediaId: 'd1', x: 1 }] })],
    ['dismissed yinelenmiş', (d) => ({ ...d, dismissed: [{ lane: 'feed', mediaId: 'd1' }, { lane: 'feed', mediaId: 'd1' }] })],
    ['dismissed slotta tutuluyor', (d) => ({ ...d, dismissed: [{ lane: 'feed', mediaId: 'a1' }] })],
    ['rejected null', (d) => ({ ...d, rejected: null })],
    ['rejected [null]', (d) => ({ ...d, rejected: [null] })],
    ['rejected [{}]', (d) => ({ ...d, rejected: [{}] })],
    ['rejected kategori', (d) => ({ ...d, rejected: [{ ...d.rejected[0], category: 'uydurma' }] })],
    ['rejected scope', (d) => ({ ...d, rejected: [{ ...d.rejected[0], scope: 'x' }] })],
    ['rejected not uzun', (d) => ({ ...d, rejected: [{ ...d.rejected[0], note: 'x'.repeat(501) }] })],
    ['rejected not sayı', (d) => ({ ...d, rejected: [{ ...d.rejected[0], note: 5 }] })],
    ['rejected yinelenmiş', (d) => ({ ...d, rejected: [d.rejected[0], d.rejected[0]] })],
    ['rejected slotta tutuluyor', (d) => ({ ...d, rejected: [{ ...d.rejected[0], mediaId: 'a2' }] })],
  ];
  it.each(bad)('%s reddedilir', (_n, mut) => {
    let r: ReturnType<typeof validatePlannerDraft> | undefined;
    expect(() => { r = validatePlannerDraft(mut(clone(draft()))); }).not.toThrow();
    expect(r!.ok).toBe(false);
    expect(!r!.ok && r!.errors.length).toBeGreaterThan(0);
  });

  it('SESSİZ KIRPMA YOK: kapasite aşımı açık hata, tam kapasite kabul', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ lane: 'story' as const, mediaId: `x${i}` }));
    expect(validatePlannerDraft(draft({ dismissed: many(MAX_DISMISSED) })).ok).toBe(true);
    const over = validatePlannerDraft(draft({ dismissed: many(MAX_DISMISSED + 1) }));
    expect(!over.ok && over.errors.join()).toMatch(/dismissed_capacity/);
    const rej = (n: number) => Array.from({ length: n }, (_, i) => ({ mediaId: `y${i}`, category: 'tekrar', note: '', scope: 'content_only' }));
    expect(validatePlannerDraft(draft({ rejected: rej(MAX_REJECTED) })).ok).toBe(true);
    const over2 = validatePlannerDraft(draft({ rejected: rej(MAX_REJECTED + 1) }));
    expect(!over2.ok && over2.errors.join()).toMatch(/rejected_capacity/);
  });

  it('boş taslak (hiç slot) geçerli; çok büyük taslak reddedilir', () => {
    const empty = { weekStart: '2026-10-12', feed: Array(9).fill(null), story: Array(9).fill(null), dismissed: [], rejected: [] };
    expect(validatePlannerDraft(empty).ok).toBe(true);
    const rejected = Array.from({ length: 200 }, (_, i) => ({ mediaId: `y${i}`, category: 'tekrar', note: 'n'.repeat(500), scope: 'content_only' }));
    const dismissed = Array.from({ length: 200 }, (_, i) => ({ lane: 'story' as const, mediaId: `z${i}` }));
    const feed = Array.from({ length: 9 }, (_, i) => slot(`m${i}`, { text: { ...issuedText(`m${i}`, 'caption', 'x'), caption: 'x'.repeat(1500) } }));
    const big = draft({ feed: feed as any, rejected, dismissed });
    const r = validatePlannerDraft(big);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join()).toMatch(/çok büyük/);
  });
});

function setup() {
  const db = fakeFirestore();
  for (const id of ['a1', 'a2', 's1', 's2', 'd1', 'r1']) seedAsset(db, id);
  for (const [path, v] of provenanceDocs()) db.data.set(path, v);
  return db;
}
/** Doğrulama okumalarının transaction DIŞINA çıkmasını yakalayan sarmalayıcı */
function guarded(db: any) {
  let inTx = false;
  const outside: string[] = [];
  const wrap = (r: any) => ({ ...r, get: async () => { if (!inTx) outside.push(r.path); return r.get(); } });
  return {
    outside,
    db: {
      ...db,
      collection: (c: string) => { const col = db.collection(c); return { ...col, doc: (id: string) => wrap(col.doc(id)) }; },
      runTransaction: (fn: any) => db.runTransaction(async (tx: any) => { inTx = true; try { return await fn(tx); } finally { inTx = false; } }),
    },
  };
}
const save = (db: any, o: Record<string, unknown> = {}) =>
  saveDraft(db, { tenantId: T, projectId: P, uid: 'u1', weekStart: '2026-10-12', expectedVersion: 0, idempotencyKey: KEY(1), draft: draft(), now: 1000, ...o } as any);
const err = async (p: Promise<unknown>): Promise<DraftError> => { try { await p; } catch (e) { return e as DraftError; } throw new Error('hata beklendi'); };

describe('kalıcı taslak deposu (sahte Firestore)', () => {
  let db: any;
  beforeEach(() => { db = setup(); });

  it('ilk kayıt sürüm 1; yeniden yüklemede durum BİREBİR korunur (kilit, metin, kırpma, seri, eleme, ret)', async () => {
    expect(await save(db)).toEqual({ version: 1, replayed: false });
    const loaded = await loadDraft(db, { tenantId: T, projectId: P, weekStart: '2026-10-12' });
    expect(loaded!.version).toBe(1);
    expect(loaded!.draft).toEqual(draft());
    expect(loaded!.draft.feed[0]).toMatchObject({ locked: true, crop: { zoom: 1.5 }, text: { caption: expect.any(String), source: 'model' } });
    expect(loaded!.draft.story[0]).toMatchObject({ seriesKey: 'the-ghosting', locked: true, text: { headline: 'Sabahın ilk kararı.' } });
    expect(loaded!.updatedBy).toBe('u1');
    expect(await loadDraft(db, { tenantId: T, projectId: P, weekStart: '2026-10-19' })).toBeNull();
  });

  it('SÜRÜM: ardışık kayıt sürümü artırır; ESKİ sürümle yazım 409 version_conflict (güncel sürüm bildirilir) ve veri değişmez', async () => {
    await save(db);
    const d2 = draft({ dismissed: [] });
    expect(await save(db, { expectedVersion: 1, idempotencyKey: KEY(2), draft: d2 })).toEqual({ version: 2, replayed: false });
    const stale = await err(save(db, { expectedVersion: 1, idempotencyKey: KEY(3), draft: draft({ rejected: [] }) }));
    expect(stale).toMatchObject({ status: 409, code: 'version_conflict', details: { currentVersion: 2 } });
    expect((await loadDraft(db, { tenantId: T, projectId: P, weekStart: '2026-10-12' }))!.draft).toEqual(d2);
    expect(await err(save(db, { expectedVersion: 5, idempotencyKey: KEY(4) }))).toMatchObject({ code: 'version_conflict' });
    // belge yokken expectedVersion>0
    expect(await err(save(db, { weekStart: '2026-10-19', draft: draft({ weekStart: '2026-10-19' }), expectedVersion: 3, idempotencyKey: KEY(5) }))).toMatchObject({ code: 'version_conflict', details: { currentVersion: 0 } });
  });

  it('İDEMPOTENCY: aynı anahtar + aynı yük → önceki sonuç (yeniden yazım yok); aynı anahtar farklı yük → 409; başka kullanıcı bağımsız', async () => {
    await save(db);
    const before = JSON.stringify(db.data.get(`${DRAFTS}/${draftDocId(T, P, '2026-10-12')}`));
    const again = await save(db);
    expect(again).toEqual({ version: 1, replayed: true });
    expect(JSON.stringify(db.data.get(`${DRAFTS}/${draftDocId(T, P, '2026-10-12')}`))).toBe(before);
    expect([...db.data.keys()].filter((k: string) => k.startsWith(`${DRAFT_REQUESTS}/`))).toHaveLength(1);
    expect(await err(save(db, { draft: draft({ dismissed: [] }) }))).toMatchObject({ status: 409, code: 'idempotency_conflict' });
    expect(await err(save(db, { expectedVersion: 1 }))).toMatchObject({ code: 'idempotency_conflict' });
    // başka kullanıcı aynı anahtarı kullanabilir (anahtar tenant+uid kapsamlı); sürüm kontrolü yine geçerli
    expect(await err(save(db, { uid: 'u2' }))).toMatchObject({ code: 'version_conflict' });
  });

  it('PROJE KAPSAMI: aynı tenant+uid+anahtar ve aynı BOŞ yük iki ayrı projede — ikinci proje sessizce replayed:true DÖNMEZ, yazılmaz', async () => {
    seedAsset(db, 'x1', { projectId: 'p2' });
    const empty = draft({ feed: Array(9).fill(null), story: Array(9).fill(null), dismissed: [], rejected: [] });
    expect(await save(db, { draft: empty })).toEqual({ version: 1, replayed: false });
    const second = await err(save(db, { projectId: 'p2', draft: empty }));
    expect(second).toMatchObject({ status: 409, code: 'idempotency_conflict' });
    expect(await loadDraft(db, { tenantId: T, projectId: 'p2', weekStart: '2026-10-12' })).toBeNull();
    // farklı hafta da aynı anahtarı başka istek yapar
    const w2 = await err(save(db, { weekStart: '2026-10-19', draft: { ...empty, weekStart: '2026-10-19' } }));
    expect(w2).toMatchObject({ code: 'idempotency_conflict' });
    // aynı proje/hafta/yük hâlâ güvenle tekrarlanır; saklanan istek kapsamı taşır
    expect(await save(db, { draft: empty })).toEqual({ version: 1, replayed: true });
    const stored = [...db.data.entries()].find(([k]: any) => k.startsWith(`${DRAFT_REQUESTS}/`))![1];
    expect(stored).toMatchObject({ tenantId: T, projectId: P, weekStart: '2026-10-12' });
  });

  it('TRANSACTION: tüm medya/seri/kaynak okumaları transaction İÇİNDE yapılır (doğrulama ile yazım arasında boşluk yok)', async () => {
    const g = guarded(db);
    expect(await save(g.db)).toMatchObject({ version: 1 });
    expect(g.outside).toEqual([]);
    // arşivlenmiş medya aynı transaction okumasında yakalanır
    db.data.set('brand_media/a2', { ...db.data.get('brand_media/a2'), status: 'archived' });
    expect(await err(save(g.db, { expectedVersion: 1, idempotencyKey: KEY(60) }))).toMatchObject({ code: 'media_invalid', details: [{ id: 'a2', reason: 'archived' }] });
    expect(g.outside).toEqual([]);
  });

  it('SERİ KİMLİĞİ: yalnız medyanın insan-doğrulamalı ürün bağlantısında olan seriesKey kabul; doğrulanmamış/başka medyanın ürünü 422 series_unverified', async () => {
    const bad = (key: string | null) => draft({ story: [{ ...draft().story[0]!, seriesKey: key }, ...draft().story.slice(1)] as any });
    expect(await err(save(db, { draft: bad('uydurma-seri') }))).toMatchObject({ status: 422, code: 'series_unverified', details: [{ where: 'story[0]', seriesKey: 'uydurma-seri' }] });
    // doğrulanmış bağlantısı olmayan medya
    seedAsset(db, 's9');
    const d9 = draft({ story: [{ ...draft().story[0]!, mediaId: 's9', text: null }, ...draft().story.slice(1)] as any });
    expect(await err(save(db, { draft: d9, idempotencyKey: KEY(61) }))).toMatchObject({ code: 'series_unverified' });
    // başka tenant/proje kapsamındaki düzeltme sayılmaz
    const k = Object.keys(Object.fromEntries(provenanceDocs())).find((x) => x.endsWith('_s1'))!;
    db.data.set(k, { ...db.data.get(k), projectId: 'p2' });
    expect(await err(save(db, { idempotencyKey: KEY(62) }))).toMatchObject({ code: 'series_unverified' });
    expect([...db.data.keys()].filter((x: string) => x.startsWith(`${DRAFTS}/`))).toEqual([]);
    // seriesKey null: tek kare, kontrol gerekmez
    expect(await save(db, { draft: bad(null), idempotencyKey: KEY(63) })).toMatchObject({ version: 1 });
  });

  it('MODEL KAYNAĞI: istemciden gelen source:model/contentHash/responseId GÜVENİLMEZ — metin değiştirilmiş, hash uydurulmuş veya sunucuda üretilmemiş ise 422 provenance_invalid; elle metin source:manual ile açıkça ayrılır', async () => {
    const withFeed0 = (text: any) => draft({ feed: [{ ...draft().feed[0]!, text }, ...draft().feed.slice(1)] as any });
    const real = draft().feed[0]!.text!;
    // 1) metin değiştirildi, eski hash kaldı
    expect(await err(save(db, { draft: withFeed0({ ...real, caption: 'Başka bir cümle, başka bir iddia.' }) }))).toMatchObject({ status: 422, code: 'provenance_invalid', details: [{ where: 'feed[0]', reason: 'hash_text_media_mismatch' }] });
    // 2) hash metne ve medyaya uygun hesaplanmış ama sunucu hiç üretmemiş (istemci kendi hash'ini hesapladı)
    const forged = { ...real, caption: 'Kendi yazdığım metin.', contentHash: copyContentHash('a1', 'caption', { caption: 'Kendi yazdığım metin.' }) };
    expect(await err(save(db, { draft: withFeed0(forged), idempotencyKey: KEY(64) }))).toMatchObject({ code: 'provenance_invalid', details: [{ reason: 'not_issued_by_server' }] });
    // 3) gerçek hash başka medyaya taşındı
    seedAsset(db, 'a3');
    const moved = draft({ feed: [{ ...draft().feed[0]!, mediaId: 'a3' }, ...draft().feed.slice(1)] as any });
    expect(await err(save(db, { draft: moved, idempotencyKey: KEY(65) }))).toMatchObject({ code: 'provenance_invalid', details: [{ reason: 'hash_text_media_mismatch' }] });
    // 4) yanıt kimliği başka (kayıt yok)
    expect(await err(save(db, { draft: withFeed0({ ...real, responseId: 'resp-baska' }), idempotencyKey: KEY(66) }))).toMatchObject({ code: 'provenance_invalid', details: [{ reason: 'not_issued_by_server' }] });
    // 5) başka tenant/projeye ait kayıt kullanılamaz
    const rk = Object.keys(Object.fromEntries(provenanceDocs())).find((x) => x.startsWith('planner_copy_issued/'))!;
    db.data.set(rk, { ...db.data.get(rk), projectId: 'p2' });
    expect(await err(save(db, { idempotencyKey: KEY(67) }))).toMatchObject({ code: 'provenance_invalid' });
    db.data.set(rk, { ...db.data.get(rk), projectId: P });
    // 6) doğrulanmış metin kabul edilir
    expect(await save(db, { idempotencyKey: KEY(68) })).toMatchObject({ version: 1 });
    // 7) manual/plan: model kanıtı taşıyamaz; kendi başına kabul, 'model' diye sunulmaz
    const manual = withFeed0({ caption: 'Elle yazılmış taslak cümle.', source: 'manual', lang: 'tr' });
    expect(await save(db, { draft: manual, expectedVersion: 1, idempotencyKey: KEY(69) })).toMatchObject({ version: 2 });
    expect((await loadDraft(db, { tenantId: T, projectId: P, weekStart: '2026-10-12' }))!.draft.feed[0]!.text).toMatchObject({ source: 'manual' });
    for (const extra of [{ contentHash: 'a'.repeat(32) }, { responseId: RESP }, { evidenceBasis: 'persona_kanaat' }]) {
      expect(await err(save(db, { draft: withFeed0({ caption: 'Elle yazılmış.', source: 'manual', lang: 'tr', ...extra }), expectedVersion: 2, idempotencyKey: KEY(70) }))).toMatchObject({ code: 'draft_invalid' });
    }
  });

  it('YENİDEN DENEME: başarısız (sürüm çakışması) istek anahtarı tüketmez; düzeltilince aynı anahtarla yazılır', async () => {
    await save(db);
    await err(save(db, { expectedVersion: 0, idempotencyKey: KEY(9), draft: draft({ dismissed: [] }) }));
    expect(await save(db, { expectedVersion: 1, idempotencyKey: KEY(9), draft: draft({ dismissed: [] }) })).toEqual({ version: 2, replayed: false });
  });

  it('KAPSAM: başka tenant/proje medyası 422 media_invalid (varlık sızmaz); arşivli slot reddedilir, arşivli eleme kabul; başka tenant taslağı okunamaz', async () => {
    seedAsset(db, 'other-project', { projectId: 'p2' });
    seedAsset(db, 'other-tenant', { tenantId: 't2' });
    seedAsset(db, 'old', { status: 'archived' });
    const feedWith = (id: string) => draft({ feed: [slot(id), ...Array(8).fill(null)] as any });
    for (const id of ['other-project', 'other-tenant', 'ghost']) {
      const e = await err(save(db, { draft: feedWith(id), idempotencyKey: KEY(10) }));
      expect(e).toMatchObject({ status: 422, code: 'media_invalid', details: [{ id, reason: 'unknown_media' }] });
    }
    expect(await err(save(db, { draft: feedWith('old'), idempotencyKey: KEY(11) }))).toMatchObject({ code: 'media_invalid', details: [{ id: 'old', reason: 'archived' }] });
    expect(await save(db, { draft: draft({ dismissed: [{ lane: 'feed', mediaId: 'old' }] }), idempotencyKey: KEY(12) })).toMatchObject({ version: 1 });
    expect(await loadDraft(db, { tenantId: 't2', projectId: P, weekStart: '2026-10-12' })).toBeNull();
    expect(await loadDraft(db, { tenantId: T, projectId: 'p2', weekStart: '2026-10-12' })).toBeNull();
  });

  it('BOZUK LİSTE ve şema ihlalleri 422 draft_invalid (hiçbir şey yazılmaz); girdi doğrulaması 400', async () => {
    for (const mut of [{ dismissed: [null] }, { rejected: [null] }, { dismissed: [{}] }, { feed: [null] }]) {
      const e = await err(save(db, { draft: { ...draft(), ...mut }, idempotencyKey: KEY(20) }));
      expect(e).toMatchObject({ status: 422, code: 'draft_invalid' });
    }
    expect([...db.data.keys()].filter((k: string) => k.startsWith(`${DRAFTS}/`) || k.startsWith(`${DRAFT_REQUESTS}/`))).toEqual([]);
    expect(await err(save(db, { draft: draft({ weekStart: '2026-10-19' }) }))).toMatchObject({ code: 'draft_invalid' });
    for (const bad of [{ expectedVersion: -1 }, { expectedVersion: 1.5 }, { expectedVersion: '0' }, { idempotencyKey: 'kisa' }, { idempotencyKey: 'abcdefghijklmnop_001' }, { idempotencyKey: undefined }, { weekStart: '12 Ekim' }, { projectId: '../x' }]) {
      expect(await err(save(db, bad)), JSON.stringify(bad)).toMatchObject({ status: 400, code: 'bad_request' });
    }
  });

  it('bozulmuş saklı belge yüklenirken açık hata (500 draft_corrupt)', async () => {
    await save(db);
    const k = `${DRAFTS}/${draftDocId(T, P, '2026-10-12')}`;
    db.data.set(k, { ...db.data.get(k), draft: { ...db.data.get(k).draft, dismissed: [null] } });
    expect(await err(loadDraft(db, { tenantId: T, projectId: P, weekStart: '2026-10-12' }))).toMatchObject({ status: 500, code: 'draft_corrupt' });
  });
});

// ── uç nokta ──
const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (h: any) => (r: any, s: any) => h(Object.assign(r, authUser.current), s) }));
const endpointDb: { current: any } = { current: null };
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => endpointDb.current }));
import handler from '@/api/studio/planner-draft';
const res = () => {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  return r;
};
const call = async (method: string, o: any) => { const r = res(); await (handler as any)({ method, body: method === 'PUT' ? o : undefined, query: method === 'GET' ? o : {} }, r); return r; };

describe('/api/studio/planner-draft', () => {
  beforeEach(() => {
    const d = setup();
    d.data.set('projects/p1', { tenantId: 't1' });
    d.data.set('users/admin1', { tenantId: 't1', role: 'admin' });
    d.data.set('users/client1', { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['p1'] } });
    d.data.set('users/fl1', { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } });
    d.data.set('users/bm1', { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } });
    d.data.set('users/bm2', { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p2'] } });
    d.data.set('users/other', { tenantId: 't2', role: 'admin' });
    endpointDb.current = d;
    authUser.current = { userId: 'admin1', userUid: 'admin1', tenantId: 't1', userRole: 'admin' };
  });
  const body = (o: any = {}) => ({ projectId: 'p1', weekStart: '2026-10-12', expectedVersion: 0, idempotencyKey: KEY(1), draft: draft(), ...o });

  it('GET yok → exists:false; PUT kaydeder; GET aynen döner; tekrarlanan PUT replayed', async () => {
    expect((await call('GET', { projectId: 'p1', weekStart: '2026-10-12' })).body).toEqual({ exists: false, version: 0 });
    expect((await call('PUT', body())).body).toEqual({ version: 1, replayed: false });
    const g = await call('GET', { projectId: 'p1', weekStart: '2026-10-12' });
    expect(g.body).toMatchObject({ exists: true, version: 1, draft: draft(), updatedBy: 'admin1' });
    expect((await call('PUT', body())).body).toEqual({ version: 1, replayed: true });
  });
  it('hata kodları: 400, 405, 409 sürüm, 422 şema/medya', async () => {
    expect((await call('POST', {})).statusCode).toBe(405);
    expect((await call('PUT', body({ expectedVersion: 'x' }))).statusCode).toBe(400);
    await call('PUT', body());
    const stale = await call('PUT', body({ idempotencyKey: KEY(2) }));
    expect(stale).toMatchObject({ statusCode: 409, body: { code: 'version_conflict', details: { currentVersion: 1 } } });
    expect((await call('PUT', body({ expectedVersion: 1, idempotencyKey: KEY(3), draft: { ...draft(), dismissed: [null] } }))).statusCode).toBe(422);
    expect((await call('PUT', body({ expectedVersion: 1, idempotencyKey: KEY(4), draft: draft({ feed: [slot('ghost'), ...Array(8).fill(null)] as any }) }))).body.code).toBe('media_invalid');
  });
  it.each([['müşteri', 'client1', 't1'], ['freelancer', 'fl1', 't1'], ['atanmamış marka yöneticisi', 'bm2', 't1'], ['başka tenant', 'other', 't2']])('%s erişemez (GET ve PUT 403)', async (_n, uid, tenant) => {
    authUser.current = { userId: uid, userUid: uid, tenantId: tenant, userRole: 'x' };
    expect((await call('GET', { projectId: 'p1', weekStart: '2026-10-12' })).statusCode).toBe(403);
    expect((await call('PUT', body())).statusCode).toBe(403);
    expect([...endpointDb.current.data.keys()].filter((k: string) => k.startsWith(`${DRAFTS}/`) || k.startsWith(`${DRAFT_REQUESTS}/`))).toEqual([]);
  });
  it('gövdedeki tenant/kapsam alanları yok sayılır: kapsam kimlik doğrulamasından gelir', async () => {
    const r = await call('PUT', { ...body(), tenantId: 't2', userId: 'other' });
    expect(r.body.version).toBe(1);
    const k = `${DRAFTS}/${draftDocId('t1', 'p1', '2026-10-12')}`;
    expect(endpointDb.current.data.get(k)).toMatchObject({ tenantId: 't1', updatedBy: 'admin1' });
  });
});
