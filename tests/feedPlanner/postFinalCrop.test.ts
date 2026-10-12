// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { scoreAt, setCrop, emptyPostPlan, visualPlanSig, layoutOf, planPosts, replacePost, setManualText, setAssetLock, movePost, deletePost, undoLast, type PostEnv, type PostPlan } from '@/studio/feedPlanner/post/postPlan';
import { finalCropDecision } from '@/studio/feedPlanner/compositionFit';
import { CropMeasurer, measureKey } from '@/studio/feedPlanner/post/cropMeasure';
import { chronology, profileAfterStep, profileView } from '@/studio/feedPlanner/post/postViews';
import { cropVisibility, evaluateCrop, VISUAL_SCHEMA_VERSION, type VisualDecision } from '@/shared/planner/visualDecision';
import type { Candidate } from '@/studio/feedPlanner/types';
import { visual } from '../helpers/visualFixture';
import { aest, cand } from './helpers';

const prov = (id: string, sha = 'same', tenant = 't1', analysisKey = 'v1') => ({ tenantId: tenant, projectId: 'dieci', assetId: id, analysisKey, sourceSha256: sha, analyzedAt: 1, model: 'm', promptVersion: 'p', schemaVersion: '3', visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'v', sourceQuality: 'original', geometryBasis: 'original' as const });
const vc = (id: string, over: Partial<VisualDecision> = {}, c: Partial<Candidate> = {}): Candidate => cand(id, { dims: { w: 1500, h: 1000 }, aesthetics: aest({ brightness: 0.5, palette: ['#777777'], density: 0.3 }), visual: { decision: visual(over), provenance: prov(id) }, ...c });
const envOf = (cs: Candidate[]): PostEnv => ({ brand: 'dieci', byId: new Map(cs.map((c) => [c.id, c])), history: [] });
const CROPPED = { crops: { a: { focus: { x: 0.5, y: 0.5 }, zoom: 2, version: 1 }, b: { focus: { x: 0.5, y: 0.5 }, zoom: 2, version: 1 } } };
const tone = (light: 'açık' | 'koyu'): Partial<VisualDecision> => ({ tone: { light, contrast: 'orta', detail: 'orta', subjectSeparation: 'iyi' } });
const color = (main: string): Partial<VisualDecision> => ({ color: { main, accents: [main], attention: main, temperature: 'sıcak' } });

describe('SON KIRPIM sözleşmesi: tam-kaynak yorumu kırpılmış piksel ölçümüyle karıştırılmaz (puanlama)', () => {
  it('kırpım pikselleri/konumu/zoom sabitken YALNIZ tam-kaynak ışık/renk/yoğunluk/çevre/denge/çizgi değişirse puan DEĞİŞMEZ', () => {
    const rich = (light: 'açık' | 'koyu', main: string, over: Partial<VisualDecision> = {}) => vc('a', { ...tone(light), ...color(main), ...over });
    const base = rich('açık', 'beyaz');
    const b = vc('b', { ...tone('açık'), ...color('beyaz') });
    const e = envOf([base, b]);
    const ref = scoreAt(['a', 'b'], CROPPED, 0, base, e);
    for (const changed of [
      rich('koyu', 'siyah'),
      rich('açık', 'beyaz', { surroundings: { relation: 'iç_içe', setting: 'dış_mekan' } }),
      rich('açık', 'beyaz', { balance: 'asimetrik_ağır', density: 'kalabalık' }),
      rich('açık', 'beyaz', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'çapraz' } }),
      rich('açık', 'beyaz', { lighting: { direction: 'sağ', brightZone: 'sağ', darkZone: 'sol', blownHighlights: 'var', crushedShadows: 'var' }, focus: { competition: 'rekabet', competingElements: ['x'] } }),
    ]) {
      const s = scoreAt(['a', 'b'], CROPPED, 0, changed, envOf([changed, b]));
      expect(s.exact, JSON.stringify(changed.visual!.decision.tone)).toBeCloseTo(ref.exact, 9);
    }
  });

  it('KIRPILMAMIŞ (4:5 kaynak, zoom 1) görüntüde tam-kaynak model yorumu GEÇERLİDİR: aynı değişiklik puanı değiştirir (yerelleştirme yalnız kesilen kırpımda)', () => {
    const mk = (id: string, light: 'açık' | 'koyu', main: string) => vc(id, { ...tone(light), ...color(main) }, { dims: { w: 1080, h: 1350 } });
    const a1 = mk('a', 'açık', 'beyaz');
    const a2 = mk('a', 'koyu', 'siyah');
    const b = mk('b', 'açık', 'beyaz');
    const p = { crops: {} };
    const s1 = scoreAt(['a', 'b'], p, 0, a1, envOf([a1, b]));
    const s2 = scoreAt(['a', 'b'], p, 0, a2, envOf([a2, b]));
    expect(s2.exact).not.toBeCloseTo(s1.exact, 6);
  });

  it('kırpılmışta kırpım PİKSELLERİ puanı belirler: ölçüm değişince puan değişir', () => {
    const dark = vc('a', {}, { aesthetics: aest({ brightness: 0.1, palette: ['#111111'], density: 0.3 }) });
    const light = vc('a', {}, { aesthetics: aest({ brightness: 0.9, palette: ['#eeeeee'], density: 0.3 }) });
    const b = vc('b', {}, { aesthetics: aest({ brightness: 0.9, palette: ['#eeeeee'], density: 0.3 }) });
    const s1 = scoreAt(['a', 'b'], CROPPED, 0, dark, envOf([dark, b]));
    const s2 = scoreAt(['a', 'b'], CROPPED, 0, light, envOf([light, b]));
    expect(s1.exact).not.toBeCloseTo(s2.exact, 6);
  });

  it('finalCropDecision: yerelleştirilemeyenler belirsiz, piksel bazlılar son kırpım ölçümünden; ana konu görünürse gaze/motion ve konumdan ağırlık; ölçüm yoksa bilinmiyor', () => {
    const c = vc('a', { directions: { gaze: 'sol', motion: 'sağ', leadingLines: 'yatay' }, subject: { box: { x: 0.45, y: 0.3, w: 0.1, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } }, { aesthetics: aest({ brightness: 0.8, contrast: 0.3, density: 0.6, warmth: -0.2, negativeSpace: 0.3, negativeZone: 'üst', palette: ['#cc3322', '#eeeeee', '#222222', '#888888'] }) });
    const ev = evaluateCrop(c.visual!.decision, c.dims, 0.8, { x: 0.5, y: 0.5 }, 2);
    const d = finalCropDecision(c, ev);
    expect(d.tone).toEqual({ light: 'açık', contrast: 'yüksek', detail: 'yoğun', subjectSeparation: 'belirsiz' });
    expect(d.density).toBe('kalabalık');
    expect(d.color.temperature).toBe('soğuk');
    expect(d.color.main).toBe('kırmızı');
    expect(d.negativeSpace).toMatchObject({ amount: 'geniş', zone: 'üst', regions: [] });
    expect(d.surroundings).toEqual({ relation: 'belirsiz', setting: 'belirsiz' });
    expect(d.balance).toBe('belirsiz');
    expect(d.directions).toEqual({ gaze: 'sol', motion: 'sağ', leadingLines: 'belirsiz' });
    expect(d.lighting.direction).toBe('belirsiz');
    expect(d.subject.scale).toBe('belirsiz');
    expect(d.weight.direction).toBe('merkez');
    expect(d.focus.competition).toBe('belirsiz');
    // ölçüm yok → türetilenler de bilinmiyor
    const none = finalCropDecision({ ...c, aesthetics: undefined }, ev);
    expect(none.tone.light).toBe('belirsiz');
    expect(none.color.temperature).toBe('belirsiz');
    expect(none.density).toBe('belirsiz');
    expect(none.negativeSpace.amount).toBe('belirsiz');
    // ana konu kırpım dışında → gaze/motion/ağırlık bilinmiyor
    const out = evaluateCrop(c.visual!.decision, c.dims, 0.8, { x: 0.05, y: 0.5 }, 2.5);
    expect(out.subject.status).not.toBe('korunur');
    const dOut = finalCropDecision(c, out);
    expect(dOut.directions.gaze).toBe('belirsiz');
    expect(dOut.weight.direction).toBe('belirsiz');
  });

  it('tam-kaynak çekim ölçeği/konumu (semantic) kırpılmış adayda bilinmiyor sayılır: komşunun kırpılmışlığı da', () => {
    const wideShot = (id: string) => vc(id, {}, { semantic: { shotScale: 'yakın', subjectPos: 'sol', source: 'katalog' } });
    const a = wideShot('a');
    const b = wideShot('b');
    const flipped = vc('a', {}, { semantic: { shotScale: 'geniş', subjectPos: 'sağ', source: 'katalog' } });
    const s1 = scoreAt(['a', 'b'], CROPPED, 0, a, envOf([a, b]));
    const s2 = scoreAt(['a', 'b'], CROPPED, 0, flipped, envOf([flipped, b]));
    expect(s1.exact).toBeCloseTo(s2.exact, 9);
  });
});

describe('kaynak içerik kimliği ve kapsam: ölçüm önbelleği', () => {
  const base = vc('a', {}, { imageKey: 'stable/path.jpg' });
  const w = { x: 0, y: 0, w: 0.8, h: 1 };
  it('aynı yol+boyut ama farklı SHA → farklı anahtar; farklı tenant → farklı; yalnız analiz anahtarı/zamanı değişirse AYNI (gereksiz ölçüm yok)', () => {
    const withSha = (sha: string, tenant = 't1', analysisKey = 'v1') => ({ ...base, visual: { ...base.visual!, provenance: prov('a', sha, tenant, analysisKey) } });
    expect(measureKey(withSha('old'), w)).not.toBe(measureKey(withSha('new'), w));
    expect(measureKey(withSha('old'), w)).not.toBe(measureKey(withSha('old', 't2'), w));
    expect(measureKey(withSha('old', 't1', 'v1'), w)).toBe(measureKey(withSha('old', 't1', 'v9'), w));
    expect(measureKey({ ...withSha('old'), brand: 'baska' }, w)).not.toBe(measureKey(withSha('old'), w));
  });

  it('kaynak değişince yeniden ölçülür; yalnız analiz değişince ölçülmez; eski SHA\'nın geç yanıtı yeni kaynağa yazılmaz', async () => {
    const fn = vi.fn(async () => aest());
    const m = new CropMeasurer(fn, () => 'mock://x', vi.fn());
    const sha = (s: string, ak = 'v1') => ({ ...base, visual: { ...base.visual!, provenance: prov('a', s, 't1', ak) } });
    m.request(sha('s1'), w);
    await new Promise((r) => setTimeout(r, 0));
    m.request(sha('s1', 'v2'), w); // yalnız analiz anahtarı: ölçüm yok
    await new Promise((r) => setTimeout(r, 0));
    expect(fn).toHaveBeenCalledTimes(1);
    m.request(sha('s2'), w); // kaynak içeriği değişti
    await new Promise((r) => setTimeout(r, 0));
    expect(fn).toHaveBeenCalledTimes(2);
    const lates: Array<(v: any) => void> = [];
    const slow = vi.fn(() => new Promise<any>((r) => lates.push(r)));
    const m2 = new CropMeasurer(slow, () => 'mock://x', vi.fn());
    m2.request(sha('s1'), w);
    m2.request(sha('s2'), w);
    await new Promise((r) => setTimeout(r, 0));
    lates.forEach((l) => l(aest({ brightness: 0.2 })));
    await new Promise((r) => setTimeout(r, 0));
    expect(m2.get(sha('s1'), w)).toBeUndefined();
  });

  it('KAPSAM: ölçücü kapsam değişince atılır — bekleyen ölçüm tamamlansa da sonuç yazılmaz, onChange çağrılmaz; aynı kaynak başka kapsamda ayrı anahtar', async () => {
    const finishes: Array<(v: any) => void> = [];
    const onChange = vi.fn();
    const old = new CropMeasurer(vi.fn(() => new Promise<any>((r) => finishes.push(r))), () => 'mock://x', onChange, 3, 't1|dieci');
    old.request(base, w);
    await new Promise((r) => setTimeout(r, 0));
    old.dispose();
    finishes.forEach((f) => f(aest()));
    await new Promise((r) => setTimeout(r, 0));
    expect(old.get(base, w)).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
    old.request(base, w); // atılmış ölçücü yeni istek almaz
    expect(old.pending()).toBe(0);
    const a = new CropMeasurer(vi.fn(async () => aest()), () => 'mock://x', vi.fn(), 3, 't1|dieci');
    const b = new CropMeasurer(vi.fn(async () => aest({ brightness: 0.1 })), () => 'mock://x', vi.fn(), 3, 't2|dieci');
    a.request(base, w);
    b.request(base, w);
    await new Promise((r) => setTimeout(r, 0));
    expect(a.get(base, w)?.brightness).not.toBe(b.get(base, w)?.brightness);
  });
});

describe('ölçücü dispose/revive (StrictMode)', () => {
  it('dispose kuyruktakileri BAŞLATMAZ ama silmez; revive sonrası kuyruk tamamlanır', async () => {
    const fn = vi.fn(async () => aest());
    const m = new CropMeasurer(fn, () => 'mock://x', vi.fn(), 1);
    const cs = ['a', 'b', 'c'].map((id) => vc(id));
    cs.forEach((c) => m.request(c, null));
    m.dispose();
    await new Promise((r) => setTimeout(r, 5));
    expect(fn.mock.calls.length).toBeLessThanOrEqual(1);
    m.revive();
    cs.forEach((c) => m.request(c, null));
    await new Promise((r) => setTimeout(r, 10));
    expect(cs.every((c) => m.get(c, null) !== undefined)).toBe(true);
  });
});

describe('tam kare sınırı: yalnız GERÇEKTEN tam kare "tam"', () => {
  it('810×1000 → 4:5 kırpımda kenar kesilir: tam DEĞİL; 1079×1350 ve 1080×1349 de; tam 4:5 tam; kayan nokta toleransı ayrı', () => {
    const r = cropVisibility(null, { w: 810, h: 1000 }, 0.8, { x: 0.5, y: 0.5 }, 1);
    expect(r.windowShare).toBeLessThan(1);
    expect(r.cropped).toBe(true);
    expect(r.facts).not.toBe('tam');
    expect(cropVisibility(visual(), { w: 1079, h: 1350 }, 0.8, { x: 0.5, y: 0.5 }, 1).cropped).toBe(true);
    expect(cropVisibility(visual(), { w: 1080, h: 1349 }, 0.8, { x: 0.5, y: 0.5 }, 1).cropped).toBe(true);
    expect(cropVisibility(null, { w: 1080, h: 1350 }, 0.8, { x: 0.5, y: 0.5 }, 1)).toMatchObject({ cropped: false, facts: 'tam' });
    expect(cropVisibility(null, { w: 1080.0000001, h: 1350 }, 0.8, { x: 0.5, y: 0.5 }, 1).facts).toBe('tam'); // yalnız sayısal tolerans
    // kesilen kenarda ana konu görünürse yalnız ana konu; bilinmiyorsa yok
    expect(cropVisibility(visual(), { w: 810, h: 1000 }, 0.8, { x: 0.5, y: 0.5 }, 1).facts).toBe('yalnız_konu');
  });
});

describe('görsel plan imzası (onay bağı)', () => {
  const mk = (n: number): { p: PostPlan; env: PostEnv } => {
    const cs = Array.from({ length: 8 }, (_, i) => vc(`a${i}`, {}, { dims: { w: 1080, h: 1350 } }));
    const env = envOf(cs);
    return { p: planPosts(null, n, env).plan, env };
  };
  it('görsel, sıra, silme ve kırpım imzayı DEĞİŞTİRİR; elle metin ve kilit DEĞİŞTİRMEZ; geri alma önceki imzayı döndürür', () => {
    const { p, env } = mk(4);
    const sig = visualPlanSig(p);
    expect(visualPlanSig(replacePost(p, p.posts[0].id, 'replace', env).plan)).not.toBe(sig);
    expect(visualPlanSig(movePost(p, p.posts[0].id, 1, env).plan)).not.toBe(sig);
    expect(visualPlanSig(deletePost(p, p.posts[1].id, env).plan)).not.toBe(sig);
    const cropped = setCrop(p, p.posts[2].assetId, { zoom: 1.5 }).plan;
    expect(visualPlanSig(cropped)).not.toBe(sig);
    expect(visualPlanSig(setCrop(cropped, p.posts[2].assetId, { zoom: 1.5, focus: { x: 0.2, y: 0.2 } }).plan)).not.toBe(visualPlanSig(cropped));
    expect(visualPlanSig(setManualText(p, p.posts[0].id, 'insan metni', p.posts[0].version).plan)).toBe(sig);
    expect(visualPlanSig(setAssetLock(p, p.posts[0].id, true).plan)).toBe(sig);
    expect(visualPlanSig(emptyPostPlan())).toBe('');
    expect(visualPlanSig(undoLast(replacePost(p, p.posts[0].id, 'replace', env).plan, env).plan)).toBe(sig);
  });
});

describe('önizleme verisi: SON kırpım ve anlık görüntünün kendi kırpımı', () => {
  const mk = () => {
    const cs = Array.from({ length: 6 }, (_, i) => vc(`a${i}`, {}, { dims: { w: 2000, h: 2000 } }));
    const env = envOf(cs);
    return { p: planPosts(null, 4, env).plan, env };
  };
  it('kronoloji/profil hücreleri varlığın SON kırpımını taşır; kırpılmamış null; geçmiş hücrelerinde kırpım yok', () => {
    const { p, env } = mk();
    const asset = p.posts[0].assetId;
    const c = setCrop(p, asset, { focus: { x: 0.2, y: 0.4 }, zoom: 1.7 }).plan;
    const hist = [cand('h1', { brand: 'dieci', published: true, date: '2026-09-01' })];
    expect(chronology(c.posts, c.crops).find((x) => x.assetId === asset)!.crop).toMatchObject({ zoom: 1.7, version: 1 });
    expect(chronology(c.posts, c.crops).find((x) => x.assetId !== asset)!.crop).toBeNull();
    const prof = profileView(c.posts, hist, c.crops);
    expect(prof[0].crop).toMatchObject({ zoom: 1.7 });
    expect(prof[4].crop).toBeUndefined(); // geçmiş snapshot: bugünkü kırpıma çevrilmez
    const step = profileAfterStep(c.posts, hist, 4, c.crops);
    expect(step[0]).toMatchObject({ assetId: asset, crop: { zoom: 1.7 } });
    void env;
  });

  it('önce/sonra: her anlık görüntü KENDİ kırpımıyla (kırpım işleminde önce=otomatik, sonra=yeni; geri alınca ters); silme önizlemesi çatışma anındaki kırpımı korur', () => {
    const { p, env } = mk();
    const asset = p.posts[1].assetId;
    const cropped = setCrop(p, asset, { zoom: 2 });
    const lc = cropped.plan.lastChange!;
    expect(lc.before.find((x) => x.assetId === asset)!.crop).toBeNull();
    expect(lc.after.find((x) => x.assetId === asset)!.crop).toMatchObject({ zoom: 2 });
    const back = undoLast(cropped.plan, env).plan.lastChange!;
    expect(back.before.find((x) => x.assetId === asset)!.crop).toMatchObject({ zoom: 2 });
    expect(back.after.find((x) => x.assetId === asset)!.crop).toMatchObject({ focus: null, zoom: 1 });
    expect(layoutOf(cropped.plan.posts, [], cropped.plan.crops)[1].crop).toMatchObject({ zoom: 2 });
    const pinned = { ...cropped.plan, posts: cropped.plan.posts.map((x, i) => (i === 3 ? { ...x, assetLock: true, posLock: true } : x)) };
    const cf = deletePost(pinned, pinned.posts[0].id, env).conflict!;
    expect(cf.before.find((x) => x.assetId === asset)!.crop).toMatchObject({ zoom: 2 });
    expect(cf.afterRelease.find((x) => x.assetId === asset)!.crop).toMatchObject({ zoom: 2 });
  });
});
