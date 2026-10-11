// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { coverage, cropRect, ratioOf } from '@/studio/feedPlanner/crop';
import { measurePixels, visualSimilarity } from '@/studio/feedPlanner/aesthetics';
import { hardCheck, scoreCandidate, neighborPair } from '@/studio/feedPlanner/scorer';
import { aest, cand } from './helpers';

const ctx = (extra: Partial<{ rejected: string[]; inPlan: string[] }> = {}) => ({ brand: 'dieci', rejected: new Set(extra.rejected ?? []), inPlan: new Set(extra.inPlan ?? []) });
const px = (w: number, h: number, f: (x: number, y: number) => [number, number, number]) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = f(x, y); const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  return d;
};

describe('kırpma (gerçek kaynak boyutundan)', () => {
  it('3697×5546 kaynak: 4:5, 1:1 ve 9:16 görünen kesir', () => {
    const d = { w: 3697, h: 5546 };
    expect(coverage(d, ratioOf('feed-4x5'))).toBeCloseTo(0.833, 2);
    expect(coverage(d, ratioOf('feed-1x1'))).toBeCloseTo(0.667, 2);
    expect(coverage(d, ratioOf('story'))).toBeCloseTo(0.844, 2);
    expect(coverage({ w: 3000, h: 1000 }, ratioOf('story'))).toBeLessThan(0.5);
  });
  it('dikdörtgen sınırlar içinde, hedef oranda; odak ve zoom uygulanır', () => {
    const d = { w: 3697, h: 5546 };
    for (const f of ['feed-1x1', 'feed-4x5', 'story'] as const) {
      for (const focus of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }]) {
        const r = cropRect(d, ratioOf(f), focus, 1.5);
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(d.w); expect(r.y + r.h).toBeLessThanOrEqual(d.h);
        expect(r.w / r.h).toBeCloseTo(ratioOf(f), 2);
      }
    }
    const full = cropRect(d, ratioOf('feed-4x5'), { x: 0.5, y: 0.5 }, 1);
    expect(cropRect(d, ratioOf('feed-4x5'), { x: 0.5, y: 0.5 }, 2).w).toBe(Math.round(full.w / 2));
    expect(cropRect(d, ratioOf('feed-4x5'), { x: 0, y: 0.5 }, 2).x).toBe(0);
  });
});

describe('içsel ölçüm (piksel) deterministik ve bağlamdan ayrı', () => {
  it('düz renk: tam boş alan, tek renk; aynı girdi aynı sonuç', () => {
    const d = px(32, 32, () => [200, 100, 50]);
    const a = measurePixels(d, 32, 32);
    expect(a.negativeSpace).toBe(1);
    expect(a.palette[0]).toBe('#c86432');
    expect(a.warmth).toBeGreaterThan(0.5);
    expect(measurePixels(d, 32, 32)).toEqual(a);
  });
  it('dama deseni yoğun, üst yarı boş görselde boşluk "üst"', () => {
    const checker = measurePixels(px(32, 32, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])), 32, 32);
    expect(checker.density).toBeGreaterThan(0.9);
    const top = measurePixels(px(48, 48, (x, y) => (y < 24 ? [240, 240, 240] : (x * 7 + y * 13) % 2 ? [20, 20, 20] : [200, 60, 60])), 48, 48);
    expect(top.negativeZone).toBe('üst');
  });
  it('benzerlik: ölçüm yoksa null (bilinmiyor), aynı görsel 1', () => {
    const a = aest();
    expect(visualSimilarity(a, a)).toBeCloseTo(1, 5);
    expect(visualSimilarity(a, { ...a, measured: false })).toBeNull();
    expect(visualSimilarity(undefined, a)).toBeNull();
  });
});

describe('sert kısıtlar önce', () => {
  it('marka, yayımlanmış, ret, plan içi tekrar, format, video kapağı', () => {
    expect(hardCheck(cand('a'), 'feed-4x5', ctx())).toBeNull();
    expect(hardCheck(cand('a', { brand: 'x' }), 'feed-4x5', ctx())).toBe('marka');
    expect(hardCheck(cand('a', { published: true }), 'feed-4x5', ctx())).toBe('yayımlanmış');
    expect(hardCheck(cand('a'), 'feed-4x5', ctx({ rejected: ['a'] }))).toBe('reddedildi');
    expect(hardCheck(cand('a'), 'feed-4x5', ctx({ inPlan: ['a'] }))).toBe('plan-içi-tekrar');
    expect(hardCheck(cand('a', { dims: { w: 3000, h: 1000 } }), 'story', ctx())).toBe('format');
    expect(hardCheck(cand('v', { kind: 'video_cover' }), 'feed-4x5', ctx())).toBe('video-kapak-yalnız-reels');
    expect(hardCheck(cand('v', { kind: 'video_cover' }), 'reels-cover', ctx())).toBeNull();
  });
  it('Reels kapağında fotoğraf seçilebilir; video iddiası yok, uyarı var', () => {
    expect(hardCheck(cand('p'), 'reels-cover', ctx())).toBeNull();
    const s = scoreCandidate(cand('p'), 'reels-cover', [], [], []);
    expect(s.warnings.join(' ')).toMatch(/video üretilmedi/);
  });
});

describe('bağlamsal puan: ritim + uyum, eksik ölçüm kesin puan değil', () => {
  it('komşu puanı yalnız renk benzerliği değildir: aynı renk + farklı doku ritim kazanır', () => {
    const neighbor = cand('n', { aesthetics: aest({ density: 0.1, negativeSpace: 0.0 }) });
    const sameTexture = cand('a', { aesthetics: aest({ density: 0.1, negativeSpace: 0.0 }) });
    const diffTexture = cand('b', { aesthetics: aest({ density: 0.6, negativeSpace: 0.4 }) });
    const p1 = neighborPair(sameTexture, neighbor)!;
    const p2 = neighborPair(diffTexture, neighbor)!;
    expect(p1.harmony).toBeCloseTo(p2.harmony, 5);
    expect(p2.rhythm).toBeGreaterThan(p1.rhythm);
    const s1 = scoreCandidate(sameTexture, 'feed-4x5', [neighbor], [], []);
    const s2 = scoreCandidate(diffTexture, 'feed-4x5', [neighbor], [], []);
    expect(s2.total).toBeGreaterThan(s1.total);
  });
  it('çekim ölçeği farkı ritme girer; bilinmiyorsa girmez', () => {
    const n = cand('n', { semantic: { shotScale: 'yakın', subjectPos: 'bilinmiyor', source: 'nottan' } });
    const same = cand('a', { semantic: { shotScale: 'yakın', subjectPos: 'bilinmiyor', source: 'nottan' } });
    const diff = cand('b', { semantic: { shotScale: 'geniş', subjectPos: 'bilinmiyor', source: 'nottan' } });
    expect(neighborPair(diff, n)!.rhythm).toBeGreaterThan(neighborPair(same, n)!.rhythm);
    expect(neighborPair(cand('c'), n)!.rhythm).toBeCloseTo(neighborPair(cand('d'), cand('e'))!.rhythm, 5);
  });
  it('ölçümü olmayan aday: eksik bileşenler listelenir, kısmi puan, güven "piksel yok"', () => {
    const c = cand('x', { aesthetics: undefined });
    const s = scoreCandidate(c, 'feed-4x5', [cand('n')], [], []);
    expect(s.known).toBeLessThan(7);
    expect(s.missing.length).toBeGreaterThan(0);
    expect(s.confidence.pixels).toBe(false);
    expect(s.confidence.semantic).toBe('bilinmiyor');
    expect(s.parts.brand).toBeNull();
  });
  it('yayımlanmış geçmişe çok benzer aday tekrar notu alır', () => {
    const past = cand('h', { published: true });
    const s = scoreCandidate(cand('x'), 'feed-4x5', [], [], [past]);
    expect(s.repetitionNote).toMatch(/çok benzer/);
  });
});
