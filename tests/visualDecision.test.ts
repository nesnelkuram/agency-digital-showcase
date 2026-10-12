// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  CropEvalCache, PLATFORM_SAFE, VISUAL_SCHEMA_VERSION, bestTextZone, boxArea, cropCacheKey, cropResolution, cropWindow, effectiveLean, evaluateCrop, gridCell, intersect, negativeSpaceRatio,
  platformInsets, positionLean, subjectFocus, subjectGeometry,
  type CandidateVisual, type VisualProvenance,
} from '@/shared/planner/visualDecision';
import { cropRect } from '@/studio/feedPlanner/crop';
import { visual } from './helpers/visualFixture';

const prov = (over: Partial<VisualProvenance> = {}): VisualProvenance => ({
  tenantId: 't1', projectId: 'p1', assetId: 'a1', analysisKey: 'key-1', sourceSha256: 'sha-1', analyzedAt: 1000, model: 'anthropic/claude-haiku-5.5', promptVersion: 'media-catalog-v3', schemaVersion: '3',
  visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'visual-decision-prompt-3', sourceQuality: 'original', geometryBasis: 'original', ...over,
});
const cv = (over: Partial<VisualProvenance> = {}, v = visual()): CandidateVisual => ({ decision: v, provenance: prov(over) });
const DIMS = { w: 4000, h: 3000 };

describe('kutu geometrisi (kod hesabı)', () => {
  it('3×3 hücre etiketi kutu merkezinden; alan = w×h; kesişim', () => {
    expect(gridCell({ x: 0.0, y: 0.0, w: 0.2, h: 0.2 }).label).toBe('sol üst');
    expect(gridCell({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }).label).toBe('orta');
    expect(gridCell({ x: 0.8, y: 0.45, w: 0.2, h: 0.1 }).label).toBe('sağ');
    expect(gridCell({ x: 0.4, y: 0.8, w: 0.2, h: 0.2 }).label).toBe('alt');
    expect(boxArea({ x: 0, y: 0, w: 0.5, h: 0.4 })).toBeCloseTo(0.2, 10);
    expect(intersect({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.6, y: 0.6, w: 0.2, h: 0.2 })).toBeNull();
    expect(intersect({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toEqual({ x: 0.25, y: 0.25, w: 0.25, h: 0.25 });
  });

  it('kırpım penceresi studio cropRect ile AYNI (normalize; piksel yuvarlaması farkı ≤1 px)', () => {
    for (const ratio of [1, 4 / 5, 9 / 16]) for (const focus of [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.9 }, { x: 0.8, y: 0.2 }]) for (const zoom of [1, 1.5]) {
      const w = cropWindow(DIMS, ratio, focus, zoom);
      const r = cropRect(DIMS, ratio, focus, zoom);
      expect(Math.abs(w.x * DIMS.w - r.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(w.y * DIMS.h - r.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(w.w * DIMS.w - r.w)).toBeLessThanOrEqual(1);
      expect(Math.abs(w.h * DIMS.h - r.h)).toBeLessThanOrEqual(1);
    }
  });
});

describe('kırpımda konunun korunması ve ağırlığın değişmesi', () => {
  it('yatay kareden Story 9:16: orta konu korunur; kenardaki konu odaksız kırpımda KESİLİR, konu odaklı kırpımda korunur', () => {
    const centered = visual({ subject: { box: { x: 0.4, y: 0.3, w: 0.2, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } });
    expect(evaluateCrop(centered, DIMS, 9 / 16, { x: 0.5, y: 0.5 }).subject.status).toBe('korunur');
    const edge = visual({ subject: { box: { x: 0.02, y: 0.3, w: 0.2, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } });
    const center = evaluateCrop(edge, DIMS, 9 / 16, { x: 0.5, y: 0.5 });
    expect(center.subject.status).toBe('kesilir');
    expect(center.subject.insideShare).toBe(0);
    const f = subjectFocus(edge)!;
    expect(f.x).toBeCloseTo(0.12, 5);
    expect(evaluateCrop(edge, DIMS, 9 / 16, f).subject.status).not.toBe('kesilir');
  });

  it('kısmen kesilen konu: kalan pay hesaplanır; kenara yakın konu "kenarda"', () => {
    const v = visual({ subject: { box: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } });
    const ev = evaluateCrop(v, DIMS, 9 / 16, { x: 0.5, y: 0.5 });
    // 4000x3000 → 9:16 pencere genişliği 3000*9/16/4000 = 0.4219 → x 0.289..0.711, konu 0.3..0.7 içinde
    expect(ev.window.w).toBeCloseTo(0.421875, 5);
    expect(['korunur', 'kenarda']).toContain(ev.subject.status);
    const wide = visual({ subject: { box: { x: 0.2, y: 0.3, w: 0.6, h: 0.4 }, boxConfidence: 'orta', scale: 'geniş' } });
    const e2 = evaluateCrop(wide, DIMS, 9 / 16, { x: 0.5, y: 0.5 });
    expect(e2.subject.status).toBe('kısmen_kesilir');
    expect(e2.subject.insideShare).toBeGreaterThan(0.6);
    expect(e2.subject.insideShare).toBeLessThan(0.8);
  });

  it('ağırlık kayması: konu merkezi kırpımda belirgin kayarsa etkin yön kırpımdan okunur ve "shifted" işaretlenir', () => {
    const left = visual({ weight: { direction: 'sol', reasons: ['büyük_obje'] }, subject: { box: { x: 0.05, y: 0.35, w: 0.3, h: 0.3 }, boxConfidence: 'orta', scale: 'orta' } });
    const same = evaluateCrop(left, { w: 1000, h: 1000 }, 1, { x: 0.5, y: 0.5 });
    expect(effectiveLean(left, same)).toMatchObject({ h: 'sol', shifted: false });
    // dikey karede 9:16'ya kırpım, odak konuya: konu pencerenin ortasına gelir → ağırlık artık 'sol' değil
    const f = subjectFocus(left)!;
    const ev = evaluateCrop(left, { w: 2000, h: 1000 }, 9 / 16, f);
    expect(ev.weightShift!.dx).toBeGreaterThan(0.12);
    const lean = effectiveLean(left, ev);
    expect(lean.shifted).toBe(true);
    expect(lean.h).toBe('merkez');
  });

  it('yazı güvenli alanı: kırpımda görünmeyen veya konuyla çakışan alan düşük puan alır', () => {
    const v = visual({ textSafe: [{ box: { x: 0.0, y: 0.0, w: 0.1, h: 0.1 }, quality: 'iyi' }, { box: { x: 0.3, y: 0.05, w: 0.4, h: 0.15 }, quality: 'orta' }] });
    const ev = evaluateCrop(v, DIMS, 9 / 16, { x: 0.5, y: 0.5 });
    expect(ev.textSafe[0].visibleShare).toBe(0); // sol üst köşe Story kırpımında dışarıda
    const best = bestTextZone(ev)!;
    expect(best.score).toBeGreaterThan(0);
    expect(best.score).toBeCloseTo(0.6, 6); // 'orta' kalite × tam görünür; iyi-ama-görünmeyen alan elendi
    expect(bestTextZone(evaluateCrop(visual({ textSafe: [] }), DIMS, 1, { x: 0.5, y: 0.5 }))).toBeNull();
  });
});

describe('önbellek anahtarı ve geçersizleşme (tenant+proje+varlık+analiz anahtarı+kaynak SHA+model+istem/şema+kaynak boyutu+format+odak+zoom)', () => {
  const key = (p: VisualProvenance, fmt = 'feed-4x5', f = { x: 0.5, y: 0.5 }, z = 1, d = DIMS) => cropCacheKey(p, fmt, f, z, d);
  it('anahtar her bileşen değişince değişir', () => {
    const base = key(prov());
    expect(base).toBe(key(prov()));
    for (const [n, k] of [
      ['tenant', key(prov({ tenantId: 't2' }))], ['proje', key(prov({ projectId: 'p2' }))], ['varlık', key(prov({ assetId: 'a2' }))],
      ['analiz anahtarı', key(prov({ analysisKey: 'key-2' }))], ['kaynak sürümü (SHA)', key(prov({ sourceSha256: 'sha-2' }))], ['model', key(prov({ model: 'anthropic/claude-sonnet-5.5' }))],
      ['istem sürümü', key(prov({ promptVersion: 'media-catalog-v4' }))], ['katalog şeması', key(prov({ schemaVersion: '4' }))], ['kaynak kalitesi', key(prov({ sourceQuality: 'studio_preview' }))],
      ['görsel şema', key(prov({ visualSchemaVersion: 'visual-decision-4' }))], ['görsel istem', key(prov({ visualPromptVersion: 'v3' }))],
      ['kaynak boyutu', key(prov(), 'feed-4x5', { x: 0.5, y: 0.5 }, 1, { w: 2000, h: 1500 })], ['format', key(prov(), 'story')], ['odak', key(prov(), 'feed-4x5', { x: 0.2, y: 0.5 })], ['yakınlaştırma', key(prov(), 'feed-4x5', { x: 0.5, y: 0.5 }, 2)],
    ] as const) expect(k, n).not.toBe(base);
  });

  it('aynı girdi önbellekten gelir; yeniden analiz (daha yeni, farklı anahtar) eski girdileri atar', () => {
    const c = new CropEvalCache({ projectId: 'p1' });
    const a = c.eval(cv(), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })!;
    expect(c.eval(cv(), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).toBe(a);
    expect(c.size).toBe(1);
    c.eval(cv({ analysisKey: 'key-2', analyzedAt: 2000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 });
    expect(c.size).toBe(1); // key-1 girdisi atıldı
  });

  it('ESKİ analiz/yanıt YENİYİ GERİ ALAMAZ: daha yeni analiz görüldükten sonra eski analizKey null döner ve önbelleğe yazılmaz', () => {
    const c = new CropEvalCache({ projectId: 'p1' });
    const newer = c.eval(cv({ analysisKey: 'key-2', analyzedAt: 2000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 });
    expect(newer).not.toBeNull();
    expect(c.eval(cv({ analysisKey: 'key-1', analyzedAt: 1000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).toBeNull(); // geç gelen eski yanıt
    expect(c.size).toBe(1);
    // aynı zaman damgalı ama farklı anahtar da yeniyi geri alamaz (kesin olarak daha yeni gerekir)
    expect(c.eval(cv({ analysisKey: 'key-3', analyzedAt: 2000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).toBeNull();
    expect(c.eval(cv({ analysisKey: 'key-2', analyzedAt: 2000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).toBe(newer);
  });

  it('eski görsel şema sürümü kabul edilmez (önbelleğe girmez)', () => {
    const c = new CropEvalCache({ projectId: 'p1' });
    expect(c.eval(cv({ visualSchemaVersion: 'visual-decision-1' }), DIMS, 'story', 0.5625, { x: 0.5, y: 0.5 })).toBeNull();
    expect(c.size).toBe(0);
  });

  it('kapsam dışı (başka proje veya tenant) analiz ASLA kullanılmaz', () => {
    const c = new CropEvalCache({ tenantId: 't1', projectId: 'p1' });
    expect(c.eval(cv({ projectId: 'p2' }), DIMS, 'story', 0.5625, { x: 0.5, y: 0.5 })).toBeNull();
    expect(c.eval(cv({ tenantId: 't2' }), DIMS, 'story', 0.5625, { x: 0.5, y: 0.5 })).toBeNull();
    expect(c.size).toBe(0);
  });

  it('ZEHİRLENME YOK: tenant belirtilmemişken önce yabancı tenant+proje kaydı reddedilir ve tenant BENİMSENMEZ; ardından doğru kayıt kabul edilir', () => {
    const c = new CropEvalCache({ projectId: 'p1' });
    expect(c.eval(cv({ tenantId: 'yabanci', projectId: 'yabanci' }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).toBeNull();
    expect(c.size).toBe(0);
    expect(c.eval(cv(), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).not.toBeNull(); // doğru kayıt reddedilmez
    // tenant artık ilk DOĞRULANAN kayıttan benimsendi: aynı projeyi taşıyan başka tenant kaydı reddedilir
    expect(c.eval(cv({ tenantId: 't2', assetId: 'a2', analysisKey: 'k-x' }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).toBeNull();
    expect(c.size).toBe(1);
  });

  it('proje uyuşmayan kayıt, durumu (en yeni analiz sırası dahil) hiçbir koşulda DEĞİŞTİRMEZ', () => {
    const c = new CropEvalCache({ tenantId: 't1', projectId: 'p1' });
    c.eval(cv({ analysisKey: 'key-1', analyzedAt: 1000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 });
    c.eval(cv({ projectId: 'pX', analysisKey: 'zzz', analyzedAt: 9999 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 });
    // yabancı kayıt "daha yeni" sayılmadı: yerel key-1 hâlâ kabul edilir
    expect(c.eval(cv({ analysisKey: 'key-1', analyzedAt: 1000 }), DIMS, 'feed-4x5', 0.8, { x: 0.5, y: 0.5 })).not.toBeNull();
    expect(c.size).toBe(1);
  });
});

describe('bilinmeyen kutu ve platform güvenli kenarları (kod)', () => {
  it('kutu null: konum/alan/odak/kayma bilinmiyor; kırpım bilinmiyor; merkez UYDURULMAZ', () => {
    const v = visual({ subject: { box: null, boxConfidence: 'belirsiz', scale: 'belirsiz' } });
    expect(subjectGeometry(v).cell).toMatchObject({ value: null, source: 'unknown' });
    expect(subjectGeometry(v).areaShare.value).toBeNull();
    expect(subjectFocus(v)).toBeNull();
    const ev = evaluateCrop(v, DIMS, 9 / 16, { x: 0.5, y: 0.5 });
    expect(ev.subject).toMatchObject({ status: 'bilinmiyor', insideShare: null, centerInCrop: null, areaShareInCrop: null });
    expect(ev.weightShift).toBeNull();
    expect(positionLean(ev)).toBeNull();
    // yazı alanı yine hesaplanır (kutudan bağımsız) ama konuyla çakışma BİLİNMİYOR
    expect(ev.textSafe[0].overlapsSubject).toBeNull();
    expect(bestTextZone(evaluateCrop(v, DIMS, 1, { x: 0.5, y: 0.5 }))).toMatchObject({ overlapKnown: false });
  });

  it('effectiveLean: belirsiz ağırlık merkeze ÇEVRİLMEZ (null); yalnız bildirilen eksen bilinen sayılır; konum eğilimi AYRI fonksiyon', () => {
    const ev = evaluateCrop(visual(), { w: 1000, h: 1000 }, 1, { x: 0.5, y: 0.5 });
    expect(effectiveLean(visual({ weight: { direction: 'belirsiz', reasons: [] } }), ev)).toEqual({ h: null, v: null, shifted: false });
    expect(effectiveLean(visual({ weight: { direction: 'sol', reasons: [] } }), ev)).toMatchObject({ h: 'sol', v: null });
    expect(effectiveLean(visual({ weight: { direction: 'alt', reasons: [] } }), ev)).toMatchObject({ h: null, v: 'alt' });
    expect(effectiveLean(visual({ weight: { direction: 'dengeli', reasons: [] } }), ev)).toMatchObject({ h: 'merkez', v: 'merkez' });
    expect(positionLean(ev)).toEqual({ h: 'merkez', v: 'merkez' });
  });

  it('negatif alan oranı: piksel ölçümü öncelikli (pixels); yoksa modelin bölgelerinden KOD (code); ikisi de yoksa bilinmiyor; amount bandı oran SAYILMAZ', () => {
    const v = visual({ negativeSpace: { zone: 'üst', amount: 'geniş', regions: [{ x: 0, y: 0, w: 1, h: 0.25 }] } });
    expect(negativeSpaceRatio(v, 0.4)).toMatchObject({ value: 0.4, source: 'pixels' });
    const code = negativeSpaceRatio(v, null);
    expect(code.source).toBe('code');
    expect(code.value).toBeCloseTo(0.25, 2);
    // örtüşen bölgeler çift sayılmaz
    expect(negativeSpaceRatio(visual({ negativeSpace: { zone: 'çevre', amount: 'orta', regions: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }] } }), null).value).toBeCloseTo(0.4375, 2);
    expect(negativeSpaceRatio(visual({ negativeSpace: { zone: 'üst', amount: 'geniş', regions: [] } }), null)).toMatchObject({ value: null, source: 'unknown' });
    expect(negativeSpaceRatio(null, null).value).toBeNull();
    expect(negativeSpaceRatio(v, 1.5).source).toBe('code'); // geçersiz piksel oranı yok sayılır
  });

  it('platform güvenli kenarları: Story üst/alt %13 dışındaki yazı alanı elenir; feed için kenar yok; varsayım DOĞRULANMADI olarak işaretli', () => {
    expect(PLATFORM_SAFE.story.verified).toBe(false);
    expect(platformInsets('story')).toMatchObject({ top: 0.13, bottom: 0.13 });
    expect(platformInsets('feed-4x5')).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    const topStrip = visual({ textSafe: [{ box: { x: 0.1, y: 0.0, w: 0.8, h: 0.1 }, quality: 'iyi' }] });
    const story = evaluateCrop(topStrip, { w: 1080, h: 1920 }, 9 / 16, { x: 0.5, y: 0.5 }, 1, platformInsets('story'));
    expect(story.textSafe[0].visibleShare).toBeCloseTo(1, 5);
    expect(story.textSafe[0].safeShare).toBeLessThan(0.05); // tamamı üst %13 bandında
    expect(bestTextZone(story)).toBeNull();
    const feed = evaluateCrop(topStrip, { w: 1080, h: 1350 }, 4 / 5, { x: 0.5, y: 0.5 }, 1, platformInsets('feed-4x5'));
    expect(bestTextZone(feed)).not.toBeNull();
    const mid = evaluateCrop(visual({ textSafe: [{ box: { x: 0.1, y: 0.4, w: 0.8, h: 0.1 }, quality: 'iyi' }] }), { w: 1080, h: 1920 }, 9 / 16, { x: 0.5, y: 0.5 }, 1, platformInsets('story'));
    expect(bestTextZone(mid)).not.toBeNull();
  });

  it('kırpım sonrası çözünürlük (kod): küçük kaynak Story hedefine büyütme gerektirir', () => {
    const small = cropResolution({ w: 600, h: 800 }, cropWindow({ w: 600, h: 800 }, 9 / 16, { x: 0.5, y: 0.5 }), 'story')!;
    expect(small.scale).toBeLessThan(0.5);
    expect(small.sourcePx.w).toBeLessThan(small.targetPx.w);
    const big = cropResolution({ w: 4000, h: 6000 }, cropWindow({ w: 4000, h: 6000 }, 4 / 5, { x: 0.5, y: 0.5 }), 'feed-4x5')!;
    expect(big.scale).toBeGreaterThan(1);
    expect(cropResolution({ w: 100, h: 100 }, { x: 0, y: 0, w: 1, h: 1 }, 'bilinmeyen-format')).toBeNull();
  });
});
