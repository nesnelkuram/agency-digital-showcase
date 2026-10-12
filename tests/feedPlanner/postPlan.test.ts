// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  MAX_POSTS, POST_COLS, POST_FORMAT, POST_RATIO, POST_SIZE, addPosts, applyTexts, arrangePlan, capacityOf, cropVersionOf, deletePost, effectiveCrop, emptyPostPlan, evaluatePlan, layoutOf,
  movePost, neighborIdx, planPosts, postsNeedingText, replacePost, resolveDelete, scoreAt, setAssetLock, setCrop, setManualText, setPositionLock, textStatus, undoLast,
  type PostEnv, type PostPlan, type TextArrival,
} from '@/studio/feedPlanner/post/postPlan';
import { chronology, gridShape, planShape, profileAfterStep, profileView, snapshotInfo, sortHistory } from '@/studio/feedPlanner/post/postViews';
import { cropWindow, VISUAL_SCHEMA_VERSION, type VisualDecision } from '@/shared/planner/visualDecision';
import type { Candidate } from '@/studio/feedPlanner/types';
import { visual } from '../helpers/visualFixture';
import { aest, cand } from './helpers';

// Saf motor: model/ağ yok. Adaylar "nihai kırpılmış görünüm ölçümü" (aesthetics) ile gelir.
const prov = (id: string) => ({
  tenantId: 't1', projectId: 'dieci', assetId: id, analysisKey: `k-${id}`, sourceSha256: `s-${id}`, analyzedAt: 1, model: 'm', promptVersion: 'p', schemaVersion: '3',
  visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'v', sourceQuality: 'original', geometryBasis: 'original' as const,
});
const c = (id: string, o: Partial<Candidate> = {}, vis?: Partial<VisualDecision>): Candidate =>
  cand(id, { group: 'pizza', dims: { w: 1080, h: 1350 }, ...(vis ? { visual: { decision: visual(vis), provenance: prov(id) } } : {}), ...o });
const ids = (n: number, make: (id: string, i: number) => Candidate = (id) => c(id)) => Array.from({ length: n }, (_, i) => make(`a${String(i).padStart(2, '0')}`, i));
const envOf = (cs: Candidate[], history: Candidate[] = []): PostEnv => ({ brand: 'dieci', byId: new Map(cs.map((x) => [x.id, x])), history });
const plan = (n: number, cs: Candidate[], hist: Candidate[] = [], prev: PostPlan | null = null) => {
  const env = envOf(cs, hist);
  const r = planPosts(prev, n, env);
  return { r, p: r.plan, env };
};
const assets = (p: PostPlan) => p.posts.map((x) => x.assetId);
const HEAVY_R = { weight: { direction: 'sağ' as const, reasons: ['büyük_obje' as const] }, subject: { box: { x: 0.55, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta' as const, scale: 'orta' as const } };
const HEAVY_L = { weight: { direction: 'sol' as const, reasons: ['büyük_obje' as const] }, subject: { box: { x: 0.1, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta' as const, scale: 'orta' as const } };

describe('4:5 post biçimi ve nihai kırpım', () => {
  it('yalnız 1080×1350 (4:5): sabitler ve her kaynak oranında pencere 4:5; orijinal kaynak değişmez', () => {
    expect(POST_SIZE).toEqual({ w: 1080, h: 1350 });
    expect(POST_RATIO).toBeCloseTo(0.8, 10);
    expect(POST_FORMAT).toBe('feed-4x5');
    for (const dims of [{ w: 1000, h: 1000 }, { w: 3000, h: 2000 }, { w: 2000, h: 3500 }, { w: 1080, h: 1350 }]) {
      const w = cropWindow(dims, POST_RATIO, { x: 0.3, y: 0.6 }, 1);
      expect((w.w * dims.w) / (w.h * dims.h)).toBeCloseTo(0.8, 6);
      const z = cropWindow(dims, POST_RATIO, { x: 0.3, y: 0.6 }, 1.7);
      expect((z.w * dims.w) / (z.h * dims.h)).toBeCloseTo(0.8, 6);
      expect(z.w).toBeLessThan(w.w + 1e-9);
    }
    const src = c('s', { dims: { w: 3000, h: 2000 } });
    const before = JSON.stringify(src.dims);
    const { p } = plan(1, [src]);
    setCrop(p, 's', { zoom: 2 });
    expect(JSON.stringify(src.dims)).toBe(before);
    // 4:5'e %50'den az sığan kaynak (aşırı yatay) post için uygun değildir
    expect(capacityOf(emptyPostPlan(), envOf([c('wide', { dims: { w: 4000, h: 1000 } })])).available).toBe(0);
  });

  it('etkin kırpım: otomatik (konu merkezli) → manuel; sıfırlama otomatiğe döner', () => {
    const s = c('s', {}, { subject: { box: { x: 0.6, y: 0.3, w: 0.2, h: 0.3 }, boxConfidence: 'orta', scale: 'orta' } });
    const { p } = plan(1, [s]);
    expect(effectiveCrop(p, s).focus.x).toBeCloseTo(0.7, 5);
    const m = setCrop(p, 's', { focus: { x: 0.2, y: 0.5 }, zoom: 1.5 }).plan;
    expect(effectiveCrop(m, s)).toEqual({ focus: { x: 0.2, y: 0.5 }, zoom: 1.5 });
    const a = setCrop(m, 's', { auto: true }).plan;
    expect(effectiveCrop(a, s).zoom).toBe(1);
    expect(effectiveCrop(a, s).focus.x).toBeCloseTo(0.7, 5);
    expect(cropVersionOf(a, 's')).toBe(2); // sürüm geri düşmez
  });
});

describe('N post, 3 sütun, kısmi son satır, dürüst kapasite', () => {
  it('N değerleri: tam ve kısmi satırlar (1, 2, 3, 4, 7, 9, 10); sütun/komşuluk geometrisi', () => {
    const cs = ids(14);
    for (const [n, rows, last, partial] of [[1, 1, 1, true], [2, 1, 2, true], [3, 1, 3, false], [4, 2, 1, true], [7, 3, 1, true], [9, 3, 3, false], [10, 4, 1, true]] as const) {
      const { p } = plan(n, cs);
      expect(p.posts).toHaveLength(n);
      expect(new Set(assets(p)).size).toBe(n);
      expect(planShape(p)).toEqual({ total: n, rows, lastRowFilled: last, partial });
    }
    expect(gridShape(0)).toMatchObject({ rows: 0, lastRowFilled: 0, partial: false });
    expect(POST_COLS).toBe(3);
    expect(neighborIdx(4, 7)).toEqual([1, 3, 5]); // 7 hücre: alt komşu (7) yok
    expect(neighborIdx(6, 7)).toEqual([3]); // son sıradaki tek hücre
    expect(neighborIdx(0, 7)).toEqual([1, 3]);
  });

  it('ADAY AZLIĞI: N=7 ama 4 uygun aday → 4 post; eksik açıkça söylenir; sahte veya tekrarlı doldurma YOK', () => {
    const { r, p, env } = plan(7, ids(4));
    expect(p.posts).toHaveLength(4);
    expect(p.requested).toBe(7);
    expect(new Set(assets(p)).size).toBe(4);
    expect(r.message).toMatch(/İstenen 7 post; yalnız 4 uygun görsel var\. Eksik 3 post sahte veya tekrarlı görselle DOLDURULMADI/);
    expect(capacityOf(p, env)).toMatchObject({ requested: 7, filled: 4, shortfall: 3, available: 0 });
    // aday hiç yoksa plan boş
    const none = plan(5, []);
    expect(none.p.posts).toHaveLength(0);
    expect(none.r.message).toMatch(/Uygun aday yok/);
  });

  it('MARKA İZOLASYONU: başka marka, yayımlanmış ve video kapağı adaylar plana HİÇ girmez', () => {
    const own = ids(3);
    const foreign = [c('x1', { brand: 'baska' }), c('x2', { brand: 'baska' }), c('x3', { brand: 'baska' })];
    const pub = [c('h1', { published: true, origin: 'history' })];
    const vid = [c('v1', { kind: 'video_cover' })];
    const { p } = plan(9, [...own, ...foreign, ...pub, ...vid]);
    expect(assets(p).sort()).toEqual(['a00', 'a01', 'a02']);
    expect(plan(3, foreign).p.posts).toHaveLength(0);
  });

  it('sınırlar: N 1..MAX_POSTS; geçersiz N plan kurmaz; aynı girdi aynı plan (deterministik)', () => {
    const cs = ids(40);
    expect(planPosts(null, 0, envOf(cs)).message).toMatch(/en az 1/);
    expect(plan(MAX_POSTS + 20, cs).p.posts).toHaveLength(MAX_POSTS);
    expect(assets(plan(8, cs).p)).toEqual(assets(plan(8, cs).p));
  });

  it('planlama saf ve çağrısızdır: ağ/model yok, havuz değişmez', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cs = ids(10);
    const snapshot = JSON.stringify(cs);
    plan(9, cs);
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(cs)).toBe(snapshot);
  });
});

describe('ilişkisel seçim: nihai kırpılmış ölçüm, komşu, geçmiş', () => {
  it('seçim kırpılmış ölçümlere göredir: aynı aday farklı (kırpılmış) aesthetics ile farklı bağlam puanı alır', () => {
    const warm = c('w', { aesthetics: aest({ warmth: 0.4, brightness: 0.45, palette: ['#cc5522', '#ee9966', '#aa3311', '#ffccaa'] }) });
    const cool = c('w', { aesthetics: aest({ warmth: -0.4, brightness: 0.45, palette: ['#2255cc', '#6699ee', '#1133aa', '#aaccff'] }) });
    const neighbor = c('n', { aesthetics: aest({ warmth: 0.4, brightness: 0.45, palette: ['#cc5522', '#ee9966', '#aa3311', '#ffccaa'] }) });
    const env = (cand: Candidate) => envOf([cand, neighbor]);
    const pl = (cand: Candidate): PostPlan => ({ ...emptyPostPlan(), posts: [{ id: 'p1', assetId: 'n', assetLock: false, posLock: false, version: 1, text: null }] });
    const a = scoreAt(['n', null], pl(warm), 1, warm, env(warm)).parts.harmony!;
    const b = scoreAt(['n', null], pl(cool), 1, cool, env(cool)).parts.harmony!;
    expect(a).toBeGreaterThan(b);
  });

  it('MEVCUT YAYINLAR (geçmiş snapshot) komşu olarak değerlendirmeye girer: plan bloğunun son sırası geçmişle birleşir', () => {
    // 4 post → son satırda 1 hücre; profilde onun SAĞINDA geçmiş gönderi var (idx 4,5). Ağırlık yığılması geçmişe karşı da ölçülür.
    const hist = [c('h0', { published: true, origin: 'history', date: '2026-09-30' }, HEAVY_L), c('h1', { published: true, origin: 'history', date: '2026-09-20' }, HEAVY_L)];
    const pool = [c('xR', {}, HEAVY_R), c('xL', {}, HEAVY_L)];
    const env = envOf(pool, hist);
    const base: PostPlan = { ...emptyPostPlan(), posts: ids(3).map((_, i) => ({ id: `q${i}`, assetId: `fill${i}`, assetLock: false, posLock: false, version: 1, text: null })) };
    const fill = ids(3, (id, i) => c(`fill${i}`, {}, { weight: { direction: 'merkez', reasons: [] } }));
    for (const f of fill) env.byId.set(f.id, f);
    // idx 3 (son sırada tek hücre) sağ komşusu idx 4 = geçmiş h0 (ağırlık SOLDA): soldaki karenin ağırlığı SAĞDA olan yığılır
    const sR = scoreAt(base.posts.map((p) => p.assetId), base, 3, env.byId.get('xR')!, env);
    const sL = scoreAt(base.posts.map((p) => p.assetId), base, 3, env.byId.get('xL')!, env);
    expect(sR.compositionNotes.join(' ')).toMatch(/dikişte yığılıyor/);
    expect(sL.compositionNotes.join(' ')).not.toMatch(/dikişte yığılıyor/);
  });

  it('plan sırası: Sırayı iyileştir konum kilitliyi sabit tutar; gerçekten puan artmazsa değişmez', () => {
    const cs = [c('a1', {}, HEAVY_R), c('a2', {}, HEAVY_L), c('a3', {}, HEAVY_R), c('a4', {}, HEAVY_L)];
    const { p, env } = plan(4, cs);
    const worst = { ...p, posts: [...p.posts].sort((x, y) => (x.assetId < y.assetId ? -1 : 1)) };
    const arranged = arrangePlan(worst, env);
    expect(arranged.plan.posts).toHaveLength(4);
    expect(new Set(assets(arranged.plan))).toEqual(new Set(assets(worst)));
    expect(evaluatePlan(arranged.plan, env).total).toBeGreaterThanOrEqual(evaluatePlan(worst, env).total);
    // konum kilidi
    const pinned = setPositionLock(worst, worst.posts[0].id, true).plan;
    const a2 = arrangePlan(pinned, env).plan;
    expect(a2.posts[0].id).toBe(pinned.posts[0].id);
    expect(arrangePlan(setPositionLock(setPositionLock(emptyOne(), 'p1', true).plan, 'p1', true).plan, env).message).toBeTruthy();
  });
});
const emptyOne = (): PostPlan => ({ ...emptyPostPlan(), posts: [{ id: 'p1', assetId: 'a00', assetLock: false, posLock: false, version: 1, text: null }] });

describe('Değiştir / ele-yenisini getir: sayı korunur, konuma uygun aday', () => {
  it('post sayısı AYNI; kimlik aynı; yeni varlık planda yok; eski metin düşer; dismiss yalnız eleme modunda eski varlığı eler', () => {
    const { p, env } = plan(4, ids(10));
    const target = p.posts[1];
    const withText = applyTexts(p, [{ postId: target.id, expected: { version: target.version, assetId: target.assetId, cropVersion: 0 }, text: { text: 'Eski metin', source: 'model' } }]).plan;
    const t2 = withText.posts[1];
    const r = replacePost(withText, target.id, 'replace', env, t2.version);
    expect(r.plan.posts).toHaveLength(4);
    expect(r.plan.posts[1].id).toBe(target.id);
    expect(r.plan.posts[1].assetId).not.toBe(target.assetId);
    expect(new Set(assets(r.plan)).size).toBe(4);
    expect(r.plan.posts[1].text).toBeNull();
    expect(r.plan.dismissed).toEqual([]);
    expect(r.message).toMatch(/Eski metin yeni görsele taşınmadı/);
    const d = replacePost(r.plan, target.id, 'dismiss', env, r.plan.posts[1].version);
    expect(d.plan.posts).toHaveLength(4);
    expect(d.plan.dismissed).toEqual([r.plan.posts[1].assetId]);
    // elenen varlık bir daha otomatik önerilmez
    let cur = d.plan;
    for (let k = 0; k < 6; k++) cur = replacePost(cur, target.id, 'replace', env).plan;
    expect(assets(cur)).not.toContain(r.plan.posts[1].assetId);
  });

  it('seçim BAĞIMSIZ en yüksek puana göre değil, konuma/kalan plana uyuma göre: komşuyla dikişte yığılan aday elenir', () => {
    const left = c('m-left', {}, HEAVY_R);
    const crowd = c('a-crowd', {}, HEAVY_L); // kimlik sırası onu kayırır
    const fits = c('z-fits', {}, HEAVY_R);
    const env = envOf([left, crowd, fits]);
    const start: PostPlan = { ...emptyPostPlan(), nextId: 3, posts: [
      { id: 'p1', assetId: 'm-left', assetLock: false, posLock: false, version: 1, text: null },
      { id: 'p2', assetId: 'old', assetLock: false, posLock: false, version: 2, text: null },
    ] };
    env.byId.set('old', c('old', {}, HEAVY_R));
    const r = replacePost(start, 'p2', 'replace', env);
    expect(r.plan.posts[1].assetId).toBe('z-fits');
  });

  it('uygun aday YOKSA mevcut durum aynen korunur ve dürüst mesaj verilir; tekrarlı doldurma yok', () => {
    const { p, env } = plan(3, ids(3));
    const r = replacePost(p, p.posts[0].id, 'replace', env);
    expect(r.plan).toBe(p);
    expect(r.message).toMatch(/uygun başka aday yok; mevcut görsel korundu/);
    expect(assets(r.plan)).toEqual(assets(p));
  });

  it('kilitli post değiştirilmez/elenmez (görsel kilidi VE konum kilidi); eski sürümle gelen işlem yok sayılır; olmayan post yok sayılır', () => {
    const { p, env } = plan(3, ids(8));
    const a = setAssetLock(p, p.posts[0].id, true).plan;
    expect(replacePost(a, a.posts[0].id, 'replace', env).message).toMatch(/Kilitli post değiştirilemez/);
    const b = setPositionLock(p, p.posts[1].id, true).plan;
    expect(replacePost(b, b.posts[1].id, 'dismiss', env).plan).toBe(b);
    const stale = replacePost(p, p.posts[2].id, 'replace', env, p.posts[2].version - 1);
    expect(stale).toMatchObject({ stale: true });
    expect(stale.plan).toBe(p);
    expect(replacePost(p, 'p999', 'replace', env)).toMatchObject({ stale: true });
  });

  it('değişimden sonra BÜTÜN plan uyumu yeniden değerlendirilir (son işlem önce/sonra + plan puanı)', () => {
    const { p, env } = plan(4, ids(9, (id, i) => c(id, {}, i % 2 ? HEAVY_L : HEAVY_R)));
    const r = replacePost(p, p.posts[2].id, 'replace', env);
    expect(r.plan.lastChange!.label).toBe('Değiştir');
    expect(r.plan.lastChange!.before.map((x) => x.assetId)).toEqual(assets(p));
    expect(r.plan.lastChange!.after.map((x) => x.assetId)).toEqual(assets(r.plan));
    const ev = evaluatePlan(r.plan, env);
    expect(ev.perPost).toHaveLength(4);
    expect(ev.total).toBeGreaterThanOrEqual(0);
  });
});

describe('Sil: sayıyı azaltır, doldurmaz; iki ayrı kilit; çatışma önizlemesi', () => {
  const four = () => plan(4, ids(10));

  it('Sil post sayısını DÜŞÜRÜR (N-1); otomatik yeni görsel EKLEMEZ; kalan kimlikler aynı kalır', () => {
    const { p, env } = four();
    const ids0 = p.posts.map((x) => x.id);
    const r = deletePost(p, p.posts[1].id, env);
    expect(r.plan.posts).toHaveLength(3);
    expect(r.plan.requested).toBe(3);
    expect(r.plan.posts.map((x) => x.id)).toEqual([ids0[0], ids0[2], ids0[3]]);
    expect(assets(r.plan)).toEqual([p.posts[0].assetId, p.posts[2].assetId, p.posts[3].assetId]);
    expect(r.message).toMatch(/otomatik yeni görsel eklenmedi/);
    expect(r.conflict).toBeUndefined();
  });

  it('İKİ KİLİT FARKLI: görsel kilidi varlığı tutar ama konum kayabilir; konum kilidi aynı konumda kalır', () => {
    const { p, env } = four();
    const [A, B, C, D] = p.posts;
    // B yalnız görsel kilitli → A silinince yukarı kayar (varlık korunur)
    const lockA = setAssetLock(p, B.id, true).plan;
    const r1 = deletePost(lockA, A.id, env);
    expect(r1.plan.posts.map((x) => x.id)).toEqual([B.id, C.id, D.id]);
    expect(r1.plan.posts[0].assetId).toBe(B.assetId);
    expect(r1.plan.posts[0].assetLock).toBe(true);
    // B konum kilitli (idx 1) → A silinince B AYNI konumda (1) kalır, kilitsizler boşlukları doldurur
    const lockP = setPositionLock(p, B.id, true).plan;
    const r2 = deletePost(lockP, A.id, env);
    expect(r2.plan.posts.map((x) => x.id)).toEqual([C.id, B.id, D.id]);
    expect(r2.plan.posts[1].posLock).toBe(true);
    expect(r2.conflict).toBeUndefined();
  });

  it('kilit semantiği: konum kilidi görsel kilidini gerektirir; görsel kilidi kalkınca konum kilidi de kalkar; yinelenen işlem sürümü artırmaz', () => {
    const { p } = four();
    const id = p.posts[0].id;
    const pos = setPositionLock(p, id, true).plan;
    expect(pos.posts[0]).toMatchObject({ assetLock: true, posLock: true });
    const off = setAssetLock(pos, id, false).plan;
    expect(off.posts[0]).toMatchObject({ assetLock: false, posLock: false });
    const a = setAssetLock(p, id, true).plan;
    expect(a.posts[0]).toMatchObject({ assetLock: true, posLock: false });
    const again = setAssetLock(a, id, true);
    expect(again.plan).toBe(a);
    expect(setPositionLock(a, id, false).plan).toBe(a);
    expect(layoutOf(pos.posts)[0]).toMatchObject({ posLock: true, assetLock: true });
  });

  it('KİLİTLİ post silinemez (sert kısıt); sessiz taşıma ve doldurma yok', () => {
    const { p, env } = four();
    const a = setAssetLock(p, p.posts[0].id, true).plan;
    expect(deletePost(a, a.posts[0].id, env)).toMatchObject({ plan: a, message: expect.stringMatching(/Kilitli post/) });
    const b = setPositionLock(p, p.posts[2].id, true).plan;
    expect(deletePost(b, b.posts[2].id, env).plan).toBe(b);
  });

  it('SİLME ↔ KONUM KİLİDİ ÇATIŞMASI: plan DEĞİŞMEZ, önizleme (önce/sonra) ve açık seçenekler döner', () => {
    const { p, env } = four();
    const [A, , , D] = p.posts;
    const locked = setPositionLock(p, D.id, true).plan; // idx 3; A silinince N'=3 → konum 3 yok
    const r = deletePost(locked, A.id, env);
    expect(r.plan).toBe(locked);
    expect(r.conflict).toBeTruthy();
    const cf = r.conflict!;
    expect(cf.conflictingIds).toEqual([D.id]);
    expect(cf.reason).toMatch(new RegExp(`${D.id} · konum 4`));
    expect(cf.before.map((x) => x.assetId)).toEqual(assets(locked));
    expect(cf.afterRelease).toHaveLength(3);
    expect(cf.afterRelease.find((x) => x.id === D.id)!.posLock).toBe(false);
    expect(cf.afterRelease.find((x) => x.id === D.id)!.assetLock).toBe(true); // görsel kilidi korunur
    expect(cf.options.map((o) => o.id)).toEqual(['cancel', 'release_and_delete']);
  });

  it('çatışma: İPTAL hiçbir şeyi değiştirmez; ONAY konum kilidini kaldırıp siler (görsel kilidi kalır), sayı N-1, geri alınabilir', () => {
    const { p, env } = four();
    const [A, , , D] = p.posts;
    const locked = setPositionLock(p, D.id, true).plan;
    const cf = deletePost(locked, A.id, env).conflict!;
    const cancel = resolveDelete(locked, cf, 'cancel', env);
    expect(cancel.plan).toBe(locked);
    expect(cancel.message).toMatch(/iptal edildi/);
    const ok = resolveDelete(locked, cf, 'release_and_delete', env);
    expect(ok.plan.posts).toHaveLength(3);
    expect(ok.plan.posts.some((x) => x.id === A.id)).toBe(false);
    const d = ok.plan.posts.find((x) => x.id === D.id)!;
    expect(d).toMatchObject({ assetLock: true, posLock: false, assetId: D.assetId });
    expect(ok.plan.posts.map((x) => x.id)).toEqual(cf.afterRelease.map((x) => x.id)); // onaylanan önizlemeyle birebir
    const back = undoLast(ok.plan, env);
    expect(back.plan.posts.map((x) => x.id)).toEqual(locked.posts.map((x) => x.id));
    expect(back.plan.posts[3]).toMatchObject({ id: D.id, posLock: true });
  });

  it('ESKİ çatışma önizlemesi uygulanamaz (plan o arada değişti)', () => {
    const { p, env } = four();
    const [A, B, , D] = p.posts;
    const locked = setPositionLock(p, D.id, true).plan;
    const cf = deletePost(locked, A.id, env).conflict!;
    const changed = setAssetLock(locked, B.id, true).plan; // plan değişti
    const r = resolveDelete(changed, cf, 'release_and_delete', env);
    expect(r).toMatchObject({ stale: true });
    expect(r.plan).toBe(changed);
  });

  it('çatışma olmayan silme: konum kilitli post başka yerde kalır → önizleme gerekmez, kilit yerinde', () => {
    const { p, env } = plan(6, ids(10));
    const locked = setPositionLock(p, p.posts[1].id, true).plan; // idx 1
    const r = deletePost(locked, locked.posts[4].id, env);
    expect(r.conflict).toBeUndefined();
    expect(r.plan.posts[1].id).toBe(locked.posts[1].id);
    expect(r.plan.posts).toHaveLength(5);
  });

  it('PLAN ÇOK AZALIRKEN kompaktlaştırma: art arda silme; son post silinince boş plan, hiç doldurma yok', () => {
    let { p, env } = plan(3, ids(8));
    for (let k = 0; k < 3; k++) p = deletePost(p, p.posts[0].id, env).plan;
    expect(p.posts).toHaveLength(0);
    expect(p.requested).toBe(0);
  });
});

describe('Sayı artırma, yeniden planlama ve kilitler', () => {
  it('Post ekle: yeni postlar SONA eklenir, mevcut konumlar/kilitler/kimlikler aynı kalır; kapasite aşılırsa dürüst mesaj', () => {
    const { p, env } = plan(3, ids(5));
    const locked = setPositionLock(p, p.posts[0].id, true).plan;
    const r = addPosts(locked, 1, env);
    expect(r.plan.posts).toHaveLength(4);
    expect(r.plan.posts.slice(0, 3).map((x) => x.id)).toEqual(locked.posts.map((x) => x.id));
    expect(r.plan.posts[0].posLock).toBe(true);
    expect(new Set(assets(r.plan)).size).toBe(4);
    const more = addPosts(r.plan, 5, env);
    expect(more.plan.posts).toHaveLength(5);
    expect(more.message).toMatch(/yalnız 5 uygun görsel var/);
    const none = addPosts(more.plan, 1, env);
    expect(none.plan.posts).toHaveLength(5);
    expect(none.message).toMatch(/Eklenecek uygun aday yok|İstenen/);
  });

  it('Yeniden planla: konum kilitli AYNI konumda, görsel kilitli plana KALIR, kilitsizler yenilenir; kilitli sayısı N\'den büyükse reddedilir', () => {
    const { p, env } = plan(6, ids(20));
    let cur = setPositionLock(p, p.posts[4].id, true).plan;
    cur = setAssetLock(cur, cur.posts[1].id, true).plan;
    const pinnedAsset = cur.posts[4].assetId;
    const keptAsset = cur.posts[1].assetId;
    const again = planPosts(cur, 6, env);
    expect(again.plan.posts).toHaveLength(6);
    expect(again.plan.posts[4].assetId).toBe(pinnedAsset);
    expect(again.plan.posts[4].posLock).toBe(true);
    expect(assets(again.plan)).toContain(keptAsset);
    const keptPost = again.plan.posts.find((x) => x.assetId === keptAsset)!;
    expect(keptPost.assetLock).toBe(true);
    const tooFew = planPosts(cur, 1, env);
    expect(tooFew.plan).toBe(cur);
    expect(tooFew.message).toMatch(/Kilitli 2 post var/);
    const outside = planPosts(cur, 4, env);
    expect(outside.message).toMatch(/hedef sayının/);
  });

  it('sıra değiştirme: konum kilitli post yerinden oynatılamaz; kilitsiz komşuyla yer değişir ve kimlikler korunur', () => {
    const { p, env } = plan(4, ids(8));
    const moved = movePost(p, p.posts[1].id, -1, env);
    expect(moved.plan.posts.map((x) => x.id)).toEqual([p.posts[1].id, p.posts[0].id, p.posts[2].id, p.posts[3].id]);
    const pinned = setPositionLock(p, p.posts[0].id, true).plan;
    expect(movePost(pinned, pinned.posts[1].id, -1, env).message).toMatch(/Konum kilitli post yerinden oynatılamaz/);
    expect(movePost(p, p.posts[0].id, -1, env).message).toMatch(/taşınacak konum yok/);
  });
});

describe('Geri al, stabil kimlik ve geç yanıt koruması', () => {
  const arrival = (p: PostPlan, i: number, text = 'Yeni metin', cropVersion = 0): TextArrival => ({ postId: p.posts[i].id, expected: { version: p.posts[i].version, assetId: p.posts[i].assetId, cropVersion }, text: { text, source: 'model' } });

  it('kimlikler kararlıdır: silinen kimlik yeniden kullanılmaz; sürümler yalnız artar; dizi indeksi kimlik değildir', () => {
    let { p, env } = plan(3, ids(8));
    const before = p.posts.map((x) => x.id);
    const gone = p.posts[0].id;
    p = deletePost(p, gone, env).plan;
    p = addPosts(p, 1, env).plan;
    const idsNow = p.posts.map((x) => x.id);
    expect(idsNow).not.toContain(gone);
    expect(new Set([...before, ...idsNow]).size).toBe(4);
    const v0 = p.posts.map((x) => x.version);
    const after = replacePost(p, p.posts[1].id, 'replace', env).plan;
    expect(after.posts[1].version).toBeGreaterThan(v0[1]);
    expect(after.posts[0].version).toBe(v0[0]);
  });

  it('GERİ AL: değiştirmeyi, silmeyi, kilidi ve kırpımı tutarlı anlık duruma döndürür; kimlikler ve insan metni korunur', () => {
    const { p, env } = plan(4, ids(10));
    let cur = setManualText(p, p.posts[2].id, 'İnsan yazdı', p.posts[2].version).plan;
    const textPost = cur.posts[2];
    const rep = replacePost(cur, cur.posts[0].id, 'replace', env).plan;
    expect(undoLast(rep, env).plan.posts.map((x) => x.assetId)).toEqual(assets(cur));
    const del = deletePost(cur, cur.posts[1].id, env).plan;
    const undoDel = undoLast(del, env).plan;
    expect(undoDel.posts.map((x) => x.id)).toEqual(cur.posts.map((x) => x.id));
    expect(undoDel.posts[2].text?.text).toBe('İnsan yazdı');
    expect(undoDel.posts[2].id).toBe(textPost.id);
    const lock = setPositionLock(cur, cur.posts[0].id, true).plan;
    expect(undoLast(lock, env).plan.posts[0]).toMatchObject({ assetLock: false, posLock: false });
    expect(undoLast(emptyPostPlan(), env).message).toMatch(/Geri alınacak işlem yok/);
  });

  it('geri alma sonrası sürümler GERİ DÜŞMEZ: önceki sürümle gelen eski işlem/yanıt reddedilir', () => {
    const { p, env } = plan(3, ids(8));
    const target = p.posts[1];
    const rep = replacePost(p, target.id, 'replace', env).plan;
    const back = undoLast(rep, env).plan;
    expect(back.posts[1].assetId).toBe(target.assetId);
    expect(back.posts[1].version).toBeGreaterThan(rep.posts[1].version);
    // değiştirme ÖNCESİ sürümle (istek anında yakalanmış) gelen metin: yok sayılır
    const res = applyTexts(back, [arrival(p, 1)]);
    expect(res.applied).toEqual([]);
    expect(res.stale[0].postId).toBe(target.id);
  });

  it('geri al UZAK/yeni veriyi silmez: anlık görüntüden SONRA gelen metin korunur; artık geçersiz varlık geri getirilmez', () => {
    const { p, env } = plan(3, ids(8));
    const del = deletePost(p, p.posts[2].id, env).plan;
    // sildikten SONRA kalan postlara metin geldi (geç yanıt)
    const withText = applyTexts(del, [arrival(del, 0, 'Sonradan gelen')]).plan;
    const back = undoLast(withText, env).plan;
    expect(back.posts).toHaveLength(3);
    expect(back.posts[0].text?.text).toBe('Sonradan gelen');
    // uzak veri değişti: silinen varlık havuzdan çıktı (arşivlendi) → geri getirilmez, dürüst mesaj
    const env2 = envOf(ids(8).filter((x) => x.id !== p.posts[2].assetId));
    const r2 = undoLast(del, env2);
    expect(r2.plan.posts.map((x) => x.assetId)).not.toContain(p.posts[2].assetId);
    expect(r2.message).toMatch(/artık geçerli olmayan varlıklar geri getirilmedi: p3/);
    // kimlik sayacı geri düşmez
    expect(back.nextId).toBeGreaterThanOrEqual(withText.nextId);
  });

  it('GEÇ YANIT: silinmiş post, değişmiş görsel, değişmiş kırpım ve kilit/sürüm değişimi (Kalsın yarışı) → metin yazılmaz', () => {
    const { p, env } = plan(4, ids(10));
    const reqs = p.posts.map((_, i) => arrival(p, i, `Metin ${i}`));
    let cur = deletePost(p, p.posts[0].id, env).plan; // post 0 silindi
    cur = replacePost(cur, p.posts[1].id, 'replace', env).plan; // post 1 görseli değişti
    cur = setCrop(cur, p.posts[2].assetId, { zoom: 1.4 }).plan; // post 2 kırpımı değişti
    cur = setAssetLock(cur, p.posts[3].id, true).plan; // post 3 kilitlendi (sürüm arttı)
    const res = applyTexts(cur, reqs);
    expect(res.applied).toEqual([]);
    expect(res.stale.map((s) => s.why)).toEqual(['post silinmiş', 'görsel değişmiş', 'kırpım değişmiş', 'post (kilit/sürüm) değişmiş']);
    // kilit SONRADAN açılsa bile eski istek geri yazamaz
    const unlocked = setAssetLock(cur, p.posts[3].id, false).plan;
    expect(applyTexts(unlocked, [reqs[3]]).applied).toEqual([]);
  });

  it('yeniden SIRALAMA sonrası geç yanıt doğru posta (kimlikle) yazılır; başka konuma/varlığa yazılmaz', () => {
    const { p, env } = plan(3, ids(8));
    const req = arrival(p, 0, 'Birinci için');
    const moved = movePost(p, p.posts[0].id, 1, env).plan; // post 0 artık idx 1
    const res = applyTexts(moved, [req]);
    expect(res.applied).toEqual([p.posts[0].id]);
    expect(res.plan.posts[1].id).toBe(p.posts[0].id);
    expect(res.plan.posts[1].text?.text).toBe('Birinci için');
    expect(res.plan.posts[0].text).toBeNull();
  });

  it('Kalsın: kilitli ve GEÇERLİ metni olan post yeni metinle ezilmez; kilitli ama metni yok/eski olan açık eylemle yazılabilir', () => {
    const { p } = plan(2, ids(5));
    const t1 = applyTexts(p, [arrival(p, 0, 'Kilitlenecek')]).plan;
    const locked = setAssetLock(t1, t1.posts[0].id, true).plan;
    const res = applyTexts(locked, [{ postId: locked.posts[0].id, expected: { version: locked.posts[0].version, assetId: locked.posts[0].assetId, cropVersion: 0 }, text: { text: 'Ezmeye çalışan', source: 'model' } }]);
    expect(res.applied).toEqual([]);
    expect(res.stale[0].why).toMatch(/kilitli ve geçerli metni var/);
    expect(res.plan.posts[0].text?.text).toBe('Kilitlenecek');
    expect(postsNeedingText(locked, true).map((x) => x.id)).toEqual([locked.posts[1].id]); // kilitli+geçerli zorla bile hedeflenmez
    const crop = setCrop(locked, locked.posts[0].assetId, { zoom: 1.3 }).plan; // metin eski oldu
    expect(textStatus(crop, crop.posts[0])).toBe('eski_kırpım');
    expect(postsNeedingText(crop).map((x) => x.id)).toContain(crop.posts[0].id);
  });
});

describe('metin geçerliliği: görsel/kırpım değişimi', () => {
  it('GÖRSEL değişince eski caption yeni varlığa aitmiş gibi KALMAZ (null); KIRPIM değişince metin "eski" olur ama silinmez; insan metni kırpımda korunur', () => {
    const { p, env } = plan(3, ids(8));
    const t = applyTexts(p, [{ postId: p.posts[0].id, expected: { version: p.posts[0].version, assetId: p.posts[0].assetId, cropVersion: 0 }, text: { text: 'Model metni', source: 'model' } }]).plan;
    const manual = setManualText(t, t.posts[1].id, 'İnsan metni', t.posts[1].version).plan;
    expect(textStatus(manual, manual.posts[0])).toBe('geçerli');
    const cropped = setCrop(manual, manual.posts[0].assetId, { focus: { x: 0.3, y: 0.3 } }).plan;
    expect(cropped.posts[0].text?.text).toBe('Model metni');
    expect(textStatus(cropped, cropped.posts[0])).toBe('eski_kırpım');
    expect(cropped.posts[1].text?.text).toBe('İnsan metni');
    expect(textStatus(cropped, cropped.posts[1])).toBe('geçerli'); // başka varlığın kırpımı etkilemez
    const replaced = replacePost(manual, manual.posts[0].id, 'replace', env).plan;
    expect(replaced.posts[0].text).toBeNull();
    expect(manual.posts[0].text?.text).toBe('Model metni');
  });

  it('kırpım düzenlemesi: sürüm artar, yalnız o varlığı taşıyan postun sürümü artar; art arda düzenleme tek geri-al adımı; beklenen sürüm uyuşmazsa reddedilir', () => {
    const { p, env } = plan(3, ids(8));
    const a = p.posts[0].assetId;
    const c1 = setCrop(p, a, { zoom: 1.2 }).plan;
    const c2 = setCrop(c1, a, { zoom: 1.4 }).plan;
    expect(cropVersionOf(c2, a)).toBe(2);
    expect(c2.posts[0].version).toBeGreaterThan(p.posts[0].version);
    expect(c2.posts[1].version).toBe(p.posts[1].version);
    expect(c2.undo.length).toBe(c1.undo.length); // birleştirildi
    const back = undoLast(c2, env).plan;
    expect(back.crops[a]).toMatchObject({ focus: null, zoom: 1 }); // otomatik kırpıma döndü
    expect(back.crops[a].version).toBeGreaterThan(cropVersionOf(c2, a)); // ama sürüm GERİ DÜŞMEDİ: eski kırpım yanıtı uygulanamaz
    expect(setCrop(c2, a, { zoom: 2 }, 1)).toMatchObject({ stale: true }); // beklenen sürüm 1, gerçek 2
    expect(setCrop(c2, 'olmayan', { zoom: 2 })).toMatchObject({ stale: true });
  });
});

describe('yayın sırası ve profil görünümü', () => {
  const hist = [
    c('h-old', { published: true, origin: 'history', date: '2026-07-01' }),
    c('h-new', { published: true, origin: 'history', date: '2026-09-30' }),
    c('h-mid', { published: true, origin: 'history', date: '2026-08-15' }),
    c('h-undated', { published: true, origin: 'history' }),
  ];

  it('KRONOLOJİK yayın sırası profil sırasının TERSİDİR; yeni gönderi profilde BAŞA gelir', () => {
    const { p } = plan(5, ids(8));
    const chrono = chronology(p.posts);
    expect(chrono.map((x) => x.order)).toEqual([1, 2, 3, 4, 5]);
    expect(chrono[0]).toMatchObject({ postId: p.posts[4].id, profileIdx: 4 }); // ilk yayınlanan = profil sırasının sonu
    expect(chrono[4]).toMatchObject({ postId: p.posts[0].id, profileIdx: 0 }); // son yayınlanan = sol üst
    const prof = profileView(p.posts, sortHistory(hist));
    expect(prof[0]).toMatchObject({ source: 'plan', postId: p.posts[0].id, publishOrder: 5 });
    expect(prof[4]).toMatchObject({ source: 'plan', publishOrder: 1 });
  });

  it('mevcut geçmişle BİRLEŞİR: plan bloğu + geçmiş snapshot (en yeni önce, tarihsiz sonda); k. yayın adımında yeni post başa gelip öncekiler kayar', () => {
    const { p } = plan(4, ids(8));
    const h = sortHistory(hist);
    expect(h.map((x) => x.id)).toEqual(['h-new', 'h-mid', 'h-old', 'h-undated']);
    const full = profileView(p.posts, h);
    expect(full.map((x) => x.source)).toEqual(['plan', 'plan', 'plan', 'plan', 'snapshot', 'snapshot', 'snapshot', 'snapshot']);
    expect(full[4]).toMatchObject({ assetId: 'h-new', dateKnown: true, date: '2026-09-30' });
    expect(full[7]).toMatchObject({ assetId: 'h-undated', dateKnown: false });
    const chrono = chronology(p.posts);
    const s0 = profileAfterStep(p.posts, h, 0);
    expect(s0.every((x) => x.source === 'snapshot')).toBe(true);
    expect(s0[0].assetId).toBe('h-new');
    const s1 = profileAfterStep(p.posts, h, 1);
    expect(s1[0]).toMatchObject({ source: 'plan', postId: chrono[0].postId, publishOrder: 1 });
    expect(s1[1].assetId).toBe('h-new');
    const s2 = profileAfterStep(p.posts, h, 2);
    expect(s2[0]).toMatchObject({ postId: chrono[1].postId, publishOrder: 2 }); // yeni gönderi başa geldi
    expect(s2[1]).toMatchObject({ postId: chrono[0].postId, publishOrder: 1 }); // önceki bir kayıp
    expect(s2[2].assetId).toBe('h-new');
    const s4 = profileAfterStep(p.posts, h, 99);
    expect(s4.map((x) => x.assetId)).toEqual(full.map((x) => x.assetId));
  });

  it('kısmi satırlar: plan bloğunun son sırası kısmi; birleşik profilde geçmiş o sırayı tamamlar', () => {
    const { p } = plan(4, ids(8));
    expect(planShape(p)).toMatchObject({ rows: 2, lastRowFilled: 1, partial: true });
    const merged = gridShape(profileView(p.posts, sortHistory(hist)).length);
    expect(merged).toMatchObject({ total: 8, rows: 3, lastRowFilled: 2, partial: true });
    expect(gridShape(profileView(p.posts, sortHistory(hist.slice(0, 2))).length)).toMatchObject({ total: 6, rows: 2, partial: false });
  });

  it('SNAPSHOT etiketi: kaynak, bilinen tarih ve "canlı değil" uyarısı; geçmiş yoksa dürüst not', () => {
    const info = snapshotInfo(sortHistory(hist), 'Instagram arşivi snapshot\'ı');
    expect(info).toMatchObject({ count: 4, newestKnownDate: '2026-09-30' });
    expect(info.note).toMatch(/Instagram arşivi snapshot'ı: 4 gönderi, bilinen en yeni tarih 2026-09-30\. CANLI veri değildir/);
    expect(snapshotInfo([c('x', { published: true })]).note).toMatch(/tarihler bilinmiyor/);
    expect(snapshotInfo([]).note).toMatch(/mevcut yayın geçmişi bağlı değil/);
  });
});
