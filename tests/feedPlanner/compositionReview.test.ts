// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { emptyPlan, generate, gridCtxFor, planFromIds, toggleLock, type PlanCtx } from '@/studio/feedPlanner/planner';
import { scoreCandidate } from '@/studio/feedPlanner/scorer';
import { compositionFit, defaultFocusOf } from '@/studio/feedPlanner/compositionFit';
import { CropEvalCache, VISUAL_SCHEMA_VERSION, type VisualDecision } from '@/shared/planner/visualDecision';
import { candidateFromInventory, type InventoryDTO } from '@/studio/feedPlanner/integration/fromInventory';
import type { Candidate } from '@/studio/feedPlanner/types';
import { unknownVisual, visual } from '../helpers/visualFixture';
import { cand } from './helpers';

const prov = (id: string, over: Record<string, unknown> = {}) => ({
  tenantId: 't1', projectId: 'dieci', assetId: id, analysisKey: `k-${id}`, sourceSha256: `sha-${id}`, analyzedAt: 1000, model: 'anthropic/claude-haiku-5.5', promptVersion: 'media-catalog-v3', schemaVersion: '3',
  visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'visual-decision-prompt-3', sourceQuality: 'original', geometryBasis: 'original' as const, ...over,
});
const vc = (id: string, over: Partial<VisualDecision> = {}, c: Partial<Candidate> = {}): Candidate =>
  cand(id, { group: 'pizza', dims: { w: 2000, h: 2500 }, visual: { decision: visual(over), provenance: prov(id) }, ...c });
const uc = (id: string, over: Partial<VisualDecision> = {}, c: Partial<Candidate> = {}): Candidate =>
  cand(id, { group: 'pizza', dims: { w: 2000, h: 2500 }, visual: { decision: unknownVisual(over), provenance: prov(id) }, ...c });
const ctxOf = (cs: Candidate[], extra: Partial<PlanCtx> = {}): PlanCtx => ({ brand: 'dieci', byId: new Map(cs.map((c) => [c.id, c])), storyIds: [], ...extra });
const fit = (c: Candidate, slot: number, placed: Record<number, Candidate>, format: any = 'feed-4x5', extra: Partial<Parameters<typeof gridCtxFor>[2]> = {}) => {
  const state = emptyPlan('feed');
  for (const [k, v] of Object.entries(placed)) state.slots[+k] = v.id;
  const byId = new Map([c, ...Object.values(placed)].map((x) => [x.id, x]));
  return compositionFit(c, format, gridCtxFor(slot, state, { byId, ...extra }));
};
const CENTER_BOX = { box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, boxConfidence: 'düşük' as const, scale: 'belirsiz' as const };

describe('BİLİNMEYEN iyi puan DEĞİLDİR (bağımsız inceleme bulgusu 1)', () => {
  it('inceleme fixture\'ı: kutu bilinen ama ağırlık/ışık/sıcaklık/ölçek/yoğunluk "belirsiz" üç aday → dikiş, satır, ızgara, sütun, ritim BİLİNMİYOR (null); iyi puan yok', () => {
    const mk = (id: string) => uc(id, { subject: CENTER_BOX });
    const a = mk('a'), b = mk('b'), c = mk('c');
    const r = fit(b, 1, { 0: a, 2: c });
    for (const k of ['seam', 'row', 'grid', 'column', 'rhythm'] as const) expect(r.parts[k], k).toBeNull();
    expect(r.unknown).toEqual(expect.arrayContaining(['seam', 'row', 'grid', 'column', 'rhythm']));
    // bilinen kısım yalnız KOD hesabı (modelin kutu tahmininden / kaynak boyutundan) olarak etiketli
    expect(r.sources.crop).toBe('code');
    expect(r.sources.placement).toBe('code');
    expect(r.sources.quality).toBe('code');
    expect(Object.values(r.sources)).not.toContain('model');
  });

  it('kutu da bilinmiyorsa (null) hiçbir görsel bileşen bilinmez → kompozisyon null; scoreCandidate toplamı grid\'siz formülle AYNI', () => {
    const a = uc('a'), b = uc('b'), c = uc('c');
    const r = fit(b, 1, { 0: a, 2: c });
    expect(r.value).toBeNull();
    expect(r.crop!.subject.status).toBe('bilinmiyor');
    expect(r.notes.join(' ')).toMatch(/belirsiz\/eksik: puana katılmadı/);
    const state = emptyPlan('feed');
    state.slots[0] = 'a';
    const byId = new Map([a, b].map((x) => [x.id, x]));
    const withGrid = scoreCandidate(b, 'feed-4x5', [a], [a], [], gridCtxFor(1, state, { byId }));
    const without = scoreCandidate(b, 'feed-4x5', [a], [a], []);
    expect(withGrid.parts.composition).toBeNull();
    expect(withGrid.total).toBe(without.total);
  });

  it('"belirsiz" ağırlık merkeze çevrilmez: sütun puanı yok; açıkça "merkez" bildiren ise 1 alır', () => {
    const unknownW = vc('u', { weight: { direction: 'belirsiz', reasons: [] } });
    const center = vc('c', { weight: { direction: 'merkez', reasons: [] } });
    expect(fit(unknownW, 1, {}).parts.column).toBeNull();
    expect(fit(center, 1, {}).parts.column).toBe(1);
    expect(fit(unknownW, 0, {}).parts.column).toBeNull();
    expect(fit(center, 0, {}).parts.column).toBe(0.85);
  });

  it('ızgara dengesi yalnız BİLİNEN üyelerle: 5 bilinmeyen + 3 bilinen "sol" → payda 3 (bilinmeyen paydayı şişirmez); <3 bilinen → bilinmiyor', () => {
    const placed: Record<number, Candidate> = {};
    for (let i = 0; i < 5; i++) placed[i] = uc(`u${i}`);
    const neutral = { color: { main: 'bej', accents: [], attention: 'belirsiz', temperature: 'nötr' as const } };
    placed[5] = vc('k1', { weight: { direction: 'sol', reasons: [] }, ...neutral });
    placed[6] = vc('k2', { weight: { direction: 'sol', reasons: [] }, ...neutral });
    const me = vc('me', { weight: { direction: 'sol', reasons: [] }, ...neutral });
    const r = fit(me, 7, placed);
    // yalnız yön boyutu dengesiz (3/3 sol → 1); ışık/sıcaklık/ölçek/kontrast nötr, denge ağır değil → bilinen 6 boyutun ortalaması 1/6 → 0.8333. Bilinmeyen 5 üye paydaya girseydi yön 3/8 olurdu.
    expect(r.parts.grid).toBeCloseTo(1 - 1 / 6, 10);
    const few = fit(me, 7, { 5: placed[5], 0: placed[0] });
    expect(few.parts.grid).toBeNull();
  });

  it('dikiş: ağırlık bilinmese bile iki tarafta BİLİNEN boş alan buluşması değerlendirilir; hiçbir bileşen bilinmeyen çift dışarıda', () => {
    const l = vc('l', { weight: { direction: 'belirsiz', reasons: [] }, negativeSpace: { zone: 'sağ', amount: 'geniş', regions: [] } });
    const r = vc('r', { weight: { direction: 'belirsiz', reasons: [] }, negativeSpace: { zone: 'sol', amount: 'geniş', regions: [] } });
    const res = fit(r, 1, { 0: l });
    expect(res.parts.seam!).toBeLessThan(1);
    expect(res.notes.join(' ')).toMatch(/büyük bir boşluk/);
    const nothing = fit(uc('x', { subject: CENTER_BOX }), 1, { 0: uc('y', { subject: CENTER_BOX }) });
    expect(nothing.parts.seam).toBeNull();
  });

  it('tekrar: karşılaştırılabilir bileşen az ise (yalnız ana renk) ceza orantılı hafifler; hiç yoksa bilinmiyor', () => {
    const col = { color: { main: 'kırmızı', accents: [], attention: 'belirsiz', temperature: 'belirsiz' as const } };
    const a = uc('a', col), b = uc('b', col);
    const one = fit(b, 1, { 0: a });
    expect(one.parts.repetition!).toBeGreaterThan(0.4); // tek bileşen eşleşti ama kanıt zayıf: tam ceza (0) DEĞİL
    expect(fit(uc('c'), 1, { 0: uc('d') }).parts.repetition).toBeNull();
  });

  it('bilinmeyen alanlı aday bilinenleri taklit edemez: aynı koşulda "belirsiz" olan, açıkça iyi olandan yüksek puan alamaz (seam/grid/row yokken value yalnız kod geometrisinden)', () => {
    const left = vc('left', { weight: { direction: 'sol', reasons: ['büyük_obje'] }, subject: { box: { x: 0.1, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } });
    const good = vc('good', { weight: { direction: 'sağ', reasons: ['büyük_obje'] }, subject: { box: { x: 0.55, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } });
    const unk = uc('unk', { subject: { box: { x: 0.55, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta', scale: 'belirsiz' } });
    const rg = fit(good, 1, { 0: left });
    const ru = fit(unk, 1, { 0: left });
    expect(ru.parts.seam).toBeNull();
    expect(ru.unknown).toContain('seam');
    expect(rg.parts.seam).not.toBeNull();
    expect(rg.sources.seam).toBe('model');
    expect(ru.sources.seam).toBeUndefined();
  });

  it('düşük güvenli ama "belirsiz" kutu güveni olan kutu GÜVENİLİR sayılmaz (geometri türevleri bilinmiyor)', () => {
    const c = vc('c', { subject: { box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, boxConfidence: 'belirsiz', scale: 'orta' } });
    const r = fit(c, 0, {});
    expect(r.crop!.subject.status).toBe('bilinmiyor');
    expect(r.parts.crop).toBeNull();
    expect(r.parts.placement).toBeNull();
  });
});

describe('manuel kırpım puanlamaya taşınır (bağımsız inceleme bulgusu 4)', () => {
  const WIDE_DIMS = { w: 4000, h: 2500 };
  const rightHeavy = (id: string, extra: Partial<Candidate> = {}) => vc(id, { weight: { direction: 'sağ', reasons: ['büyük_obje'] }, subject: { box: { x: 0.55, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: WIDE_DIMS, ...extra });

  it('aynı aday, farklı ETKİN kırpım → farklı kırpım bileşeni (konu manuel odakta kesilir); varsayılan kırpım konuyu korur', () => {
    const c = rightHeavy('c');
    const def = fit(c, 0, {}, 'story');
    expect(def.crop!.subject.status).toBe('korunur');
    const manual = fit(c, 0, {}, 'story', { cropOf: () => ({ focus: { x: 0.05, y: 0.5 }, zoom: 1 }) });
    expect(manual.crop!.subject.status).toBe('kesilir');
    expect(manual.parts.crop!).toBeLessThan(def.parts.crop!);
    expect(manual.value!).toBeLessThan(def.value!);
    // yakınlaştırma da etkindir
    const zoomed = fit(vc('z', { subject: { box: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: { w: 2000, h: 2000 } }), 0, {}, 'feed-4x5', { cropOf: () => ({ focus: { x: 0.5, y: 0.5 }, zoom: 2.5 }) });
    expect(zoomed.crop!.subject.status).not.toBe('korunur');
  });

  it('KOMŞUNUN manuel kırpımı komşu/satır/ızgara değerlendirmesine girer: ağırlık kayması komşunun etkin yönünü değiştirir', () => {
    // komşu: ağırlık "sağ" bildirilmiş, subject sağda. 1:1 pencerede (4000x2500): varsayılan (konu merkezli) kırpımda konum kayar → yön yeniden okunur ('merkez');
    // manuel merkez kırpımda ise 'sağ' kalır → solundaki karenin "sol" ağırlığıyla dikişte yığılır.
    const neighbor = rightHeavy('n');
    const me = vc('m', { weight: { direction: 'sol', reasons: ['büyük_obje'] }, subject: { box: { x: 0.1, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: { w: 2000, h: 2000 } });
    const state = emptyPlan('feed');
    state.slots[0] = 'n';
    state.formats[0] = 'feed-1x1';
    const byId = new Map([neighbor, me].map((x) => [x.id, x]));
    const defGrid = gridCtxFor(1, state, { byId });
    const manGrid = gridCtxFor(1, state, { byId, cropOf: (c) => (c.id === 'n' ? { focus: { x: 0.5, y: 0.5 }, zoom: 1 } : null) });
    const d = compositionFit(me, 'feed-4x5', defGrid);
    const m = compositionFit(me, 'feed-4x5', manGrid);
    expect(d.notes.join(' ')).not.toMatch(/dikişte yığılıyor/);
    expect(m.notes.join(' ')).toMatch(/dikişte yığılıyor/);
    expect(m.parts.seam!).toBeLessThan(d.parts.seam!);
  });

  it('SEÇİM değişir: manuel kırpımda konusu dışarıda kalan aday elenir (id sırası yanıltıcı: kaybeden "a-" ile başlar)', () => {
    const sq = { w: 2500, h: 2500 }; // Story kapsama eşiğini (≥0.5) geçen kaynak
    const a = vc('a-p', { subject: { box: { x: 0.55, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: sq });
    const z = vc('z-q', { subject: { box: { x: 0.55, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: sq });
    const base = emptyPlan('story');
    expect(generate(base, ctxOf([a, z])).state.slots[0]).toBe('a-p'); // varsayılan kırpım: eşit → kimlik sırası
    const manual = generate(base, ctxOf([a, z], { cropOf: (c) => (c.id === 'a-p' ? { focus: { x: 0.05, y: 0.5 }, zoom: 1 } : null) })).state;
    expect(manual.slots[0]).toBe('z-q');
  });

  it('KİLİTLİ kırpım: yeniden üretimde kilitli slot ve onun manuel kırpımı korunur; komşu seçimi kilitlinin GÖRÜNEN kırpımına göre yapılır', () => {
    const locked = rightHeavy('m-locked');
    const mSol = vc('a-m1', { weight: { direction: 'sol', reasons: ['büyük_obje'] }, subject: { box: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: { w: 2000, h: 2000 } });
    const mSag = vc('z-m2', { weight: { direction: 'sağ', reasons: ['büyük_obje'] }, subject: { box: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: { w: 2000, h: 2000 } });
    const lockedState = toggleLock(0, planFromIds(['m-locked'], 'feed'), true).state;
    lockedState.formats[0] = 'feed-1x1';
    const cropSpy = vi.fn((c: Candidate) => (c.id === 'm-locked' ? { focus: { x: 0.5, y: 0.5 }, zoom: 1 } : null));
    // varsayılan kırpım: kilitlinin etkin yönü 'merkez' → iki aday eşit → kimlik sırası (a-m1)
    expect(generate(lockedState, ctxOf([locked, mSol, mSag])).state.slots[1]).toBe('a-m1');
    // kilitlinin MANUEL kırpımı: etkin yön 'sağ' → soldaki kareye 'sol' ağırlıklı aday yığılır → 'z-m2' seçilir
    const out = generate(lockedState, ctxOf([locked, mSol, mSag], { cropOf: cropSpy }), true).state;
    expect(out.slots[0]).toBe('m-locked');
    expect(out.locked[0]).toBe(true);
    expect(out.slots[1]).toBe('z-m2');
    expect(cropSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-locked' }));
    // kilitli kare yeniden üretimle değişmedi ve sürüm/metin korumaları ayrı testlerde (lockRace) sürer
  });

  it('önbellekli yol aynı sonucu verir ve manuel kırpım ayrı anahtardır', () => {
    const cache = new CropEvalCache({ tenantId: 't1', projectId: 'dieci' });
    const c = rightHeavy('c');
    const a = fit(c, 0, {}, 'story', { cropCache: cache });
    const b = fit(c, 0, {}, 'story', { cropCache: cache, cropOf: () => ({ focus: { x: 0.05, y: 0.5 }, zoom: 1 }) });
    expect(a.crop!.subject.status).toBe('korunur');
    expect(b.crop!.subject.status).toBe('kesilir');
    expect(cache.size).toBe(2);
    expect(defaultFocusOf(c).x).toBeCloseTo(0.7, 5);
  });
});

describe('envanter adayı: insan varlığı yalnız AÇIK değerden (bulgu 3) ve kullanım önerisi kaynağı', () => {
  const readiness = { static: 'ok', carousel: 'ok', story: 'ok', reels: 'ok' } as any;
  const dto = (catalog: any): InventoryDTO => ({ id: 'm1', kind: 'photo', width: 1000, height: 1500, path: 'p', catalog, verifiedProductIds: [], usage: { usedInPostCount: 0, approvedUseCount: 0, pendingUseCount: 0 }, readiness });
  const human = (extra: Record<string, unknown> = {}) => ({ source: 'human', subject: 'Masa', description: 'Masa.', tags: [], foodCategories: [], visibleObjects: [], uncertainties: [], ...extra });
  const presence = (catalog: any) => { const r = candidateFromInventory(dto(catalog), { projectId: 'p1' }); return r.ok ? r.candidate.humanPresence : 'HATA'; };

  it('yalnız insan açıklaması: peoplePresent yoksa BİLİNMİYOR ("hayır" değil); açık true/false korunur; AI boolean her zaman bilinir', () => {
    expect(presence(human())).toBe('bilinmiyor');
    expect(presence(human({ peoplePresent: undefined }))).toBe('bilinmiyor');
    expect(presence(human({ peoplePresent: null }))).toBe('bilinmiyor');
    expect(presence(human({ peoplePresent: true }))).toBe('evet');
    expect(presence(human({ peoplePresent: false }))).toBe('hayır');
    expect(presence({ ...human(), source: 'ai', peoplePresent: false })).toBe('hayır');
    expect(presence(null)).toBe('bilinmiyor');
  });

  it('kullanım önerisi kaynağıyla taşınır (insan/AI); puanlamada biçim eşleşmesi amaç bileşenini değiştirir', () => {
    const r = candidateFromInventory(dto(human({ purposes: ['story', 'atmosfer'], purposesSource: 'human' })), { projectId: 'p1' });
    expect(r.ok && r.candidate.useTags).toEqual({ values: ['story', 'atmosfer'], source: 'human' });
    const none = candidateFromInventory(dto(human({ purposes: [] })), { projectId: 'p1' });
    expect(none.ok && none.candidate.useTags).toBeUndefined();
    const storyOnly = cand('s', { useTags: { values: ['story'], source: 'human' }, group: 'pizza' });
    const feedOk = cand('f', { useTags: { values: ['feed'], source: 'ai' }, group: 'pizza' });
    const sc = (c: Candidate, f: any) => scoreCandidate(c, f, [], [], []).parts.purpose;
    expect(sc(storyOnly, 'story')).toBe(1);
    expect(sc(storyOnly, 'feed-4x5')).toBe(0.45);
    expect(sc(feedOk, 'feed-4x5')).toBe(1);
    expect(sc(cand('n', { group: 'pizza' }), 'feed-4x5')).toBe(1); // öneri yok: eski grup sezgisi
  });
});


describe('seçimle ilgili ek alanlar gerçek karar yolunda (26 soru eşlemesi)', () => {
  it('bakış/hareket yönü: ızgara dışına bakan kare cezalı; komşular birbirine bakıyorsa iyi, sırt sırta kötü; yön belirsizse bilinmiyor', () => {
    const look = (d: 'sol' | 'sağ' | 'belirsiz') => vc('g' + d, { directions: { gaze: d, motion: 'yok', leadingLines: 'yok' } });
    expect(fit(look('sol'), 0, {}).parts.flow).toBe(0.6); // sol sütunda sola bakış → dışarı
    expect(fit(look('sağ'), 0, {}).parts.flow).toBe(1);
    expect(fit(look('sağ'), 2, {}).parts.flow).toBe(0.6);
    expect(fit(look('belirsiz'), 0, {}).parts.flow).toBeNull();
    expect(fit(vc('x', { directions: { gaze: 'yok', motion: 'yok', leadingLines: 'yok' } }), 0, {}).parts.flow).toBeNull(); // "yok" yön değildir
    const facing = fit(look('sol'), 1, { 0: look('sağ') }); // soldaki sağa, sağdaki sola bakıyor
    const backToBack = fit(look('sağ'), 1, { 0: look('sol') });
    expect(facing.parts.flow!).toBeGreaterThan(backToBack.parts.flow!);
    expect(backToBack.notes.join(' ')).toMatch(/sırt sırta/);
  });

  it('teknik kalite (model) ve kırpım sonrası çözünürlük (kod) seçimi etkiler; bilinmeyen teknik alanlar dışarıda', () => {
    const sharp = vc('s', {}, { dims: { w: 4000, h: 5000 } });
    const blurry = vc('b', { technical: { sharpness: 'bulanık', exposure: 'karanlık', noise: 'belirgin', compression: 'belirgin', issues: [] }, lighting: { direction: 'sol', brightZone: 'sol', darkZone: 'sağ', blownHighlights: 'var', crushedShadows: 'var' } }, { dims: { w: 4000, h: 5000 } });
    const unknownTech = vc('u', { technical: { sharpness: 'belirsiz', exposure: 'belirsiz', noise: 'belirsiz', compression: 'belirsiz', issues: [] }, lighting: { direction: 'belirsiz', brightZone: 'belirsiz', darkZone: 'belirsiz', blownHighlights: 'belirsiz', crushedShadows: 'belirsiz' }, tone: { light: 'orta', contrast: 'orta', detail: 'orta', subjectSeparation: 'belirsiz' } }, { dims: { w: 4000, h: 5000 } });
    expect(fit(blurry, 0, {}).parts.quality!).toBeLessThan(fit(sharp, 0, {}).parts.quality!);
    expect(fit(blurry, 0, {}).notes.join(' ')).toMatch(/teknik kalite sorunu/);
    expect(fit(unknownTech, 0, {}).sources.quality).toBe('code'); // yalnız çözünürlük (kod); model teknik alanları bilinmiyor
    const lowRes = vc('l', {}, { dims: { w: 600, h: 750 } });
    expect(fit(lowRes, 0, {}, 'story').parts.quality!).toBeLessThan(fit(sharp, 0, {}, 'story').parts.quality!);
    expect(fit(lowRes, 0, {}, 'story').notes.join(' ')).toMatch(/büyütme gerekiyor/);
  });

  it('odak rekabeti: aynı satırda iki "rekabet" eden kare kalabalık sayılır; bilinmeyen (yoğunluk ve rekabet belirsiz) üye sayılmaz', () => {
    const comp = (id: string) => vc(id, { focus: { competition: 'rekabet', competingElements: ['yan tabak'] }, density: 'dengeli' });
    expect(fit(comp('c3'), 2, { 0: comp('c1'), 1: comp('c2') }).notes.join(' ')).toMatch(/odak yarışan/);
    expect(fit(comp('c3'), 2, { 0: uc('u1'), 1: comp('c2') }).notes.join(' ')).toMatch(/odak yarışan/); // iki bilinen yoğun
    expect(fit(comp('c3'), 2, { 0: uc('u1'), 1: uc('u2') }).notes.join(' ')).not.toMatch(/odak yarışan/);
  });

  it('kullanım geçmişi bağımsız bileşen: görsel karar olmayan adayda da seçimi etkiler (kayıt yoksa bilinmiyor)', () => {
    const used = cand('a-used', { usage: { usedInPostCount: 4, approvedUseCount: 2, pendingUseCount: 0, lastUsedAt: 1 } });
    const fresh = cand('z-fresh', { usage: { usedInPostCount: 0, approvedUseCount: 0, pendingUseCount: 0, lastUsedAt: null } });
    expect(generate(emptyPlan('feed'), ctxOf([used, fresh])).state.slots[0]).toBe('z-fresh');
    expect(scoreCandidate(cand('n'), 'feed-4x5', [], [], []).parts.history).toBeNull();
  });
});
