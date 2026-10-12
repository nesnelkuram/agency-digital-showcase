// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { emptyPlan, generate, gridCtxFor, planFromIds, replaceSlot, toggleLock, FEED_SLOTS, type PlanCtx, type PlanState } from '@/studio/feedPlanner/planner';
import { scoreCandidate, PART_LABEL } from '@/studio/feedPlanner/scorer';
import { compositionFit, cropOf } from '@/studio/feedPlanner/compositionFit';
import { CropEvalCache, VISUAL_SCHEMA_VERSION, type VisualDecision } from '@/shared/planner/visualDecision';
import type { Candidate } from '@/studio/feedPlanner/types';
import { visual } from '../helpers/visualFixture';
import { cand } from './helpers';

const prov = (id: string, analysisKey = `k-${id}`, tenantId = 't1', projectId = 'dieci') => ({
  tenantId, projectId, assetId: id, analysisKey, model: 'anthropic/claude-haiku-5.5', promptVersion: 'media-catalog-v3', schemaVersion: '3',
  visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'visual-decision-prompt-3', sourceQuality: 'original', geometryBasis: 'original' as const,
});
/** Görsel kararlı aday. Piksel ölçümü ve grup SABİT: farkı yalnız kompozisyon yaratır. */
const vc = (id: string, over: Partial<VisualDecision> = {}, c: Partial<Candidate> = {}): Candidate =>
  cand(id, { group: 'pizza', dims: { w: 2000, h: 2500 }, visual: { decision: visual(over), provenance: prov(id) }, ...c });
const ctxOf = (cs: Candidate[], extra: Partial<PlanCtx> = {}): PlanCtx => ({ brand: 'dieci', byId: new Map(cs.map((c) => [c.id, c])), storyIds: [], ...extra });
const NEAR = { subject: { box: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, boxConfidence: 'yüksek' as const, scale: 'yakın' as const } };
const WIDE = { subject: { box: { x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, boxConfidence: 'yüksek' as const, scale: 'geniş' as const } };
const DARK_DENSE = { tone: { light: 'koyu' as const, contrast: 'yüksek' as const, detail: 'yoğun' as const }, density: 'kalabalık' as const, color: { main: 'kırmızı', accents: [], temperature: 'sıcak' as const } };
const LIGHT_CALM = { tone: { light: 'açık' as const, contrast: 'düşük' as const, detail: 'sade' as const }, density: 'sakin' as const, color: { main: 'mavi', accents: [], temperature: 'soğuk' as const } };
const leanR = { weight: { direction: 'sağ' as const, reasons: ['büyük_obje' as const] }, subject: { box: { x: 0.55, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta' as const, scale: 'orta' as const } };
const leanL = { weight: { direction: 'sol' as const, reasons: ['büyük_obje' as const] }, subject: { box: { x: 0.1, y: 0.3, w: 0.35, h: 0.4 }, boxConfidence: 'orta' as const, scale: 'orta' as const } };

const fit = (c: Candidate, slot: number, placed: Record<number, Candidate>, format: any = 'feed-4x5') => {
  const state = emptyPlan('feed');
  for (const [k, v] of Object.entries(placed)) state.slots[+k] = v.id;
  const byId = new Map([c, ...Object.values(placed)].map((x) => [x.id, x]));
  return compositionFit(c, format, gridCtxFor(slot, state, { byId }));
};

describe('komşu ritmi: yakın-geniş / açık-koyu / sakin-yoğun', () => {
  it('komşuyla AYNI ölçek+ton+yoğunluk düşük, zıt olan yüksek ritim; sonuç puana yansır', () => {
    const a = vc('a', { ...NEAR, ...DARK_DENSE });
    const same = vc('same', { ...NEAR, ...DARK_DENSE });
    const diff = vc('diff', { ...WIDE, ...LIGHT_CALM });
    const rs = fit(same, 1, { 0: a });
    const rd = fit(diff, 1, { 0: a });
    expect(rs.parts.rhythm!).toBeLessThan(0.15);
    expect(rd.parts.rhythm!).toBeGreaterThan(0.9);
    expect(rs.notes.join(' ')).toMatch(/ritim düz/);
    expect(rd.value!).toBeGreaterThan(rs.value!);
  });

  it('plan üretimi: Kalsın\'daki kareye komşu slota ZIT kare seçilir (aynı piksel/grup/format; fark yalnız kompozisyon)', () => {
    const a = vc('m-a', { ...NEAR, ...DARK_DENSE });
    const same = vc('a-same', { ...NEAR, ...DARK_DENSE }); // kimlik sırası "yanlış" adayı kayırır: seçimi kompozisyon belirlemeli
    const diff = vc('z-diff', { ...WIDE, ...LIGHT_CALM });
    const base = toggleLock(0, planFromIds(['m-a'], 'feed'), true).state;
    const out = generate(base, ctxOf([a, same, diff])).state;
    expect(out.slots[0]).toBe('m-a');
    expect(out.locked[0]).toBe(true);
    expect(out.slots[1]).toBe('z-diff');
  });
});

describe('ağırlık: sütun konumu, komşu dikişi, boşluk', () => {
  it('sol sütunda ağırlık kenara (sol) değil içeri (sağ) bakmalı; sağ sütunda tersi; orta sütunda merkez', () => {
    const R = vc('r', leanR);
    const L = vc('l', leanL);
    expect(fit(R, 0, {}).parts.column).toBe(1);
    expect(fit(L, 0, {}).parts.column).toBe(0.45);
    expect(fit(L, 2, {}).parts.column).toBe(1);
    expect(fit(R, 2, {}).parts.column).toBe(0.45);
    expect(fit(vc('m'), 1, {}).parts.column).toBe(1);
    expect(fit(R, 1, {}).parts.column).toBe(0.7);
    expect(fit(L, 0, {}).notes.join(' ')).toMatch(/sol sütunda ağırlık kenara doğru/);
  });

  it('YAN YANA: soldaki karenin ağırlığı sağda + sağdakinin ağırlığı solda = dikişte yığılma (ceza); dışa kaçan ağırlıklar = dikiş boşluğu (daha hafif ceza)', () => {
    const left = vc('left', leanR); // ağırlık sağda
    const crowd = fit(vc('x', leanL), 1, { 0: left }); // sağdakinin ağırlığı solda → yığılma
    const calm = fit(vc('y', leanR), 1, { 0: left });
    expect(crowd.parts.seam!).toBeLessThan(calm.parts.seam!);
    expect(crowd.notes.join(' ')).toMatch(/dikişte yığılıyor/);
    const goesOut = fit(vc('z', leanR), 1, { 0: vc('w', leanL) }); // soldaki sola, sağdaki sağa: aradaki dikiş boş
    expect(goesOut.notes.join(' ')).toMatch(/dikişte boşluk/);
    expect(goesOut.parts.seam!).toBeGreaterThan(crowd.parts.seam!);
  });

  it('DİKEY dikiş: üstteki karenin ağırlığı altta + alttakinin ağırlığı üstte = yığılma', () => {
    const top = vc('t', { weight: { direction: 'alt', reasons: ['büyük_obje'] }, subject: { box: { x: 0.3, y: 0.55, w: 0.4, h: 0.35 }, boxConfidence: 'orta', scale: 'orta' } });
    const bottomUp = vc('b', { weight: { direction: 'üst', reasons: ['büyük_obje'] }, subject: { box: { x: 0.3, y: 0.1, w: 0.4, h: 0.35 }, boxConfidence: 'orta', scale: 'orta' } });
    const r = fit(bottomUp, 3, { 0: top });
    expect(r.notes.join(' ')).toMatch(/alt alta dikişte yığılıyor/);
  });

  it('komşuların boş alanları dikişte buluşursa büyük boşluk uyarısı', () => {
    const l = vc('l', { negativeSpace: { zone: 'sağ', amount: 'geniş' } });
    const r = vc('r', { negativeSpace: { zone: 'sol', amount: 'geniş' } });
    expect(fit(r, 1, { 0: l }).notes.join(' ')).toMatch(/boş alanı yan yana büyük bir boşluk/);
    const n = vc('n', { negativeSpace: { zone: 'sol', amount: 'az' } });
    expect(fit(n, 1, { 0: l }).notes.join(' ')).not.toMatch(/büyük bir boşluk/);
  });
});

describe('satır üçlüsü, tüm ızgara dengesi, tekrar, kullanım geçmişi', () => {
  it('satırdaki üç kare aynı yöne akıyorsa ceza; karışık yön ve çeşitli ölçek ödüllenir', () => {
    const L1 = vc('l1', leanL); const L2 = vc('l2', leanL);
    const same = fit(vc('l3', leanL), 2, { 0: L1, 1: L2 });
    expect(same.notes.join(' ')).toMatch(/aynı yöne akıyor/);
    const mixed = fit(vc('r3', { ...leanR, ...WIDE, weight: { direction: 'sağ', reasons: [] } }), 2, { 0: L1, 1: vc('mid', { ...NEAR }) });
    expect(mixed.parts.row!).toBeGreaterThan(same.parts.row!);
    expect(fit(vc('d3', { ...DARK_DENSE }), 2, { 0: vc('d1', { ...DARK_DENSE }), 1: vc('d2', { ...DARK_DENSE }) }).notes.join(' ')).toMatch(/aynı satırda iki kalabalık\/odak yarışan kare/);
  });

  it('tüm ızgara: sekiz kare koyu+sola ağırken dokuzuncu açık+sağa eğimli olan ızgarayı DENGELER', () => {
    const placed: Record<number, Candidate> = {};
    for (let i = 0; i < 8; i++) placed[i] = vc(`g${i}`, { ...leanL, tone: { light: 'koyu', contrast: 'orta', detail: 'orta' } });
    const heavy = fit(vc('h', { ...leanL, tone: { light: 'koyu', contrast: 'orta', detail: 'orta' } }), 8, placed);
    const balance = fit(vc('b', { ...leanR, tone: { light: 'açık', contrast: 'orta', detail: 'orta' } }), 8, placed);
    expect(balance.parts.grid!).toBeGreaterThan(heavy.parts.grid!);
    expect(heavy.notes.join(' ')).toMatch(/ağırlık tek yana kayıyor/);
  });

  it('TEKRAR: komşuyla aynı konu konumu + ölçek + ana renk yüksek ceza', () => {
    const a = vc('a', { ...NEAR });
    const dup = fit(vc('dup', { ...NEAR }), 1, { 0: a });
    const other = fit(vc('oth', { subject: { box: { x: 0.04, y: 0.1, w: 0.3, h: 0.3 }, boxConfidence: 'orta', scale: 'geniş' }, color: { main: 'yeşil', accents: [], temperature: 'soğuk' } }), 1, { 0: a });
    expect(dup.parts.repetition!).toBeLessThan(0.35);
    expect(other.parts.repetition!).toBeGreaterThan(0.7);
    expect(dup.notes.join(' ')).toMatch(/konu konumu, ölçek ve ana renk tekrarı/);
  });

  it('KULLANIM GEÇMİŞİ: çok kullanılan/onaylı posta girmiş görsel taze olandan düşük; plan üretimi taze olanı seçer', () => {
    const used = vc('a-used', {}, { usage: { usedInPostCount: 5, approvedUseCount: 3, pendingUseCount: 0, lastUsedAt: 1 } });
    const fresh = vc('z-fresh', {}, { usage: { usedInPostCount: 0, approvedUseCount: 0, pendingUseCount: 0, lastUsedAt: null } });
    const hist = (c: Candidate) => scoreCandidate(c, 'feed-4x5', [], [], []).parts.history;
    expect(hist(used)!).toBeLessThan(hist(fresh)!);
    expect(hist(fresh)).toBe(1);
    expect(hist(cand('nousage'))).toBeNull(); // kayıt yoksa bilinmiyor
    const out = generate(emptyPlan('feed'), ctxOf([used, fresh])).state;
    expect(out.slots[0]).toBe('z-fresh');
  });
});

describe('kırpım farkı: Story / dikey / kare', () => {
  it('Story 9:16 kırpımında geniş konu KESİLİR: kırpım bileşeni düşer, neden yazılır; dar konu korunur', () => {
    const wideSubject = vc('ws', { subject: { box: { x: 0.02, y: 0.3, w: 0.96, h: 0.4 }, boxConfidence: 'yüksek', scale: 'geniş' } });
    const narrow = vc('nr', { subject: { box: { x: 0.35, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } });
    const w = fit(wideSubject, 0, {}, 'story');
    const n = fit(narrow, 0, {}, 'story');
    expect(w.crop!.subject.status).toBe('kısmen_kesilir');
    expect(w.parts.crop!).toBeLessThan(0.5);
    expect(n.crop!.subject.status).toBe('korunur');
    expect(n.parts.crop).toBe(1);
    expect(w.notes.join(' ')).toMatch(/Story 9:16 kırpımında konu kısmen kesiliyor/);
    expect(n.value!).toBeGreaterThan(w.value!);
    // aynı geniş konu 4:5'te korunmayabilir ama Story'dekinden iyidir
    expect(fit(wideSubject, 0, {}, 'feed-4x5').parts.crop!).toBeGreaterThan(w.parts.crop!);
  });

  it('story slotuna plan: konusu kesilen aday yerine korunan aday seçilir', () => {
    const wideSubject = vc('a-ws', { subject: { box: { x: 0.02, y: 0.3, w: 0.96, h: 0.4 }, boxConfidence: 'yüksek', scale: 'geniş' } });
    const narrow = vc('z-nr', { subject: { box: { x: 0.35, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } });
    const out = generate(emptyPlan('story'), ctxOf([wideSubject, narrow])).state;
    expect(out.slots[0]).toBe('z-nr');
  });

  it('kırpımda ağırlık kayması etkin yönü değiştirir ve sütun puanına yansır (konu odaklı kırpım)', () => {
    // Ağırlık "sol" bildirilmiş ama dar kırpımda konu pencerenin ortasına gelir
    const shifted = vc('sh', { weight: { direction: 'sol', reasons: ['büyük_obje'] }, subject: { box: { x: 0.02, y: 0.3, w: 0.25, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }, { dims: { w: 4000, h: 2500 } });
    const r = fit(shifted, 0, {}, 'story');
    expect(r.crop!.weightShift!.dx).toBeGreaterThan(0.12);
    expect(r.parts.column!).toBeGreaterThan(0.45); // 'sol' ağırlık sol sütunda 0.45 olurdu; kırpımda merkeze geldi
  });
});

describe('bilinmeyen uydurulmaz; kapsam/önbellek; Kalsın; model çağrısı yok', () => {
  it('kompozisyon kararı olmayan aday: bileşen null ("bilinmiyor"), toplam puan eski formülle AYNI; açıklamada eksik listelenir', () => {
    const plain = cand('plain', { dims: { w: 2000, h: 2500 } });
    const withGrid = scoreCandidate(plain, 'feed-4x5', [], [], [], gridCtxFor(0, emptyPlan('feed'), { byId: new Map([['plain', plain]]) }));
    const without = scoreCandidate(plain, 'feed-4x5', [], [], []);
    expect(withGrid.parts.composition).toBeNull();
    expect(withGrid.total).toBe(without.total);
    expect(withGrid.missing).toContain(PART_LABEL.composition);
    expect(withGrid.compositionNotes.join(' ')).toMatch(/kayıtlı değil \(bilinmiyor\)/);
  });

  it('komşuda veri yoksa o komşu puanlamaya katılmaz; adayın kendi verisi yine kullanılır', () => {
    const r = fit(vc('x', leanL), 1, { 0: cand('nodata') });
    expect(r.parts.seam).toBeNull();
    expect(r.parts.rhythm).toBeNull();
    expect(r.parts.crop).not.toBeNull();
  });

  it('önbellek: kapsam dışı (başka tenant) analiz kullanılmaz → bilinmiyor; yeniden analiz (yeni anahtar) eski girdiyi atar', () => {
    const cache = new CropEvalCache({ tenantId: 't1', projectId: 'dieci' });
    const own = vc('o');
    const foreign = cand('f', { dims: { w: 2000, h: 2500 }, visual: { decision: visual(), provenance: prov('f', 'k-f', 'tX') } });
    expect(cropOf(own, 'feed-4x5', cache)).not.toBeNull();
    expect(cropOf(foreign, 'feed-4x5', cache)).toBeNull();
    expect(cache.size).toBe(1);
    const state = emptyPlan('feed');
    const r = compositionFit(foreign, 'feed-4x5', gridCtxFor(0, state, { byId: new Map([['f', foreign]]), cropCache: cache }));
    expect(r.value).toBeNull();
    const re = cand('o', { dims: { w: 2000, h: 2500 }, visual: { decision: visual(), provenance: prov('o', 'k-o-2') } });
    cropOf(re, 'feed-4x5', cache);
    expect(cache.size).toBe(1); // k-o girdisi atıldı
  });

  it('KALSIN sert kısıt: kilitli slot kompozisyon "daha iyi" aday olsa da asla değişmez; komşular kilitliyi sabit bağlam sayar', () => {
    const locked = vc('locked', { ...NEAR, ...DARK_DENSE });
    const better = vc('better', { ...WIDE, ...LIGHT_CALM });
    const base = toggleLock(0, planFromIds(['locked'], 'feed'), true).state;
    const out = generate(base, ctxOf([locked, better]), true).state;
    expect(out.slots[0]).toBe('locked');
    const rep = replaceSlot(0, out, ctxOf([locked, better]));
    expect(rep.state.slots[0]).toBe('locked');
    expect(rep.message).toMatch(/Kilitli öğe değiştirilemez/);
  });

  it('GEÇ YANIT / slot sürümü korunur: kompozisyon puanı hesaplanırken sürüm değişmez; eski sürümlü işlem yok sayılır', () => {
    const a = vc('a');
    const base = planFromIds(['a'], 'feed');
    const v0 = base.versions[0];
    const out = generate(base, ctxOf([a, vc('b')]), true).state;
    expect(out.versions[0]).toBeGreaterThanOrEqual(v0);
    const stale = replaceSlot(0, out, ctxOf([a, vc('b')]), v0 - 1 < 0 ? 99 : v0 - 1);
    expect(stale.stale).toBe(true);
  });

  it('plan üretimi hiçbir ağ/model çağrısı yapmaz ve deterministiktir', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cs = Array.from({ length: 12 }, (_, i) => vc(`p${i}`, i % 2 ? { ...NEAR, ...DARK_DENSE } : { ...WIDE, ...LIGHT_CALM }));
    const a = generate(emptyPlan('feed'), ctxOf(cs)).state;
    const b = generate(emptyPlan('feed'), ctxOf(cs)).state;
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(a.slots).toEqual(b.slots);
    expect(a.slots.filter(Boolean)).toHaveLength(FEED_SLOTS);
    // ızgara boyunca komşu çiftlerde ölçek/ton çeşitliliği: yakın-karanlık ile geniş-açık dönüşümlü
    const kinds = a.slots.map((id) => (cs.find((c) => c.id === id)!.visual!.decision.density === 'kalabalık' ? 'K' : 'S'));
    const horizontalSame = [0, 1, 3, 4, 6, 7].filter((i) => kinds[i] === kinds[i + 1]).length;
    expect(horizontalSame).toBeLessThanOrEqual(2);
  });
});
