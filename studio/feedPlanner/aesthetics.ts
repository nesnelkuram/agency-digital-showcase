import type { Aesthetics } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MAX_RGB_DIST = Math.sqrt(3 * 255 * 255);
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * RGBA piksellerinden deterministik ölçüm. Semantik (sahne, çekim ölçeği) burada yoktur;
 * yalnız piksel istatistikleri. Aynı girdi her zaman aynı çıktıyı verir.
 */
export function measurePixels(data: ArrayLike<number>, w: number, h: number): Aesthetics {
  const n = w * h;
  if (n === 0) throw new Error('boş görüntü');
  const L = new Float32Array(n);
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  let sumL = 0;
  let sumL2 = 0;
  let sumWarm = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    L[i] = l;
    sumL += l;
    sumL2 += l * l;
    sumWarm += (r - b) / 255;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  const brightness = sumL / n;
  const contrast = Math.sqrt(Math.max(0, sumL2 / n - brightness * brightness));
  const warmth = sumWarm / n;

  let grad = 0;
  let gcount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) {
        grad += Math.abs(L[i + 1] - L[i]);
        gcount++;
      }
      if (y + 1 < h) {
        grad += Math.abs(L[i + w] - L[i]);
        gcount++;
      }
    }
  }
  const density = clamp((gcount ? grad / gcount : 0) * 4, 0, 1);

  const palette = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((b) => toHex(b.r / b.count, b.g / b.count, b.b / b.count));

  // Boş alan: 8×8 blokların parlaklık sapması düşükse "boş". Konum: üst/orta/alt üçte bir.
  const B = 8;
  const bw = Math.ceil(w / B);
  const bh = Math.ceil(h / B);
  const zoneSum = [0, 0, 0];
  const zoneCount = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const z = Math.min(2, Math.floor((y / h) * 3));
    for (let x = 0; x < w; x++) {
      zoneSum[z] += L[y * w + x];
      zoneCount[z]++;
    }
  }
  const zoneBrightness = zoneSum.map((v, i) => (zoneCount[i] ? v / zoneCount[i] : 0)) as [number, number, number];
  const zoneTotal = [0, 0, 0];
  const zoneBlank = [0, 0, 0];
  let total = 0;
  let blank = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let s = 0;
      let s2 = 0;
      let c = 0;
      for (let y = by * B; y < Math.min(h, by * B + B); y++) {
        for (let x = bx * B; x < Math.min(w, bx * B + B); x++) {
          const l = L[y * w + x];
          s += l;
          s2 += l * l;
          c++;
        }
      }
      const m = s / c;
      const sd = Math.sqrt(Math.max(0, s2 / c - m * m));
      const isBlank = sd < 0.04;
      const zone = Math.min(2, Math.floor(((by + 0.5) / bh) * 3));
      zoneTotal[zone]++;
      total++;
      if (isBlank) {
        zoneBlank[zone]++;
        blank++;
      }
    }
  }
  const negativeSpace = total ? blank / total : 0;
  const zf = zoneTotal.map((t, i) => (t ? zoneBlank[i] / t : 0));
  let negativeZone: Aesthetics['negativeZone'] = 'dağınık';
  if (negativeSpace >= 0.1) {
    const mx = Math.max(...zf);
    const idx = zf.indexOf(mx);
    const others = zf.filter((_, i) => i !== idx);
    if (mx - Math.max(...others) >= 0.15) negativeZone = (['üst', 'orta', 'alt'] as const)[idx];
  }
  return { measured: true, palette, brightness, warmth, contrast, density, negativeSpace, negativeZone, zoneBrightness };
}

function paletteDistance(p: string[], q: string[]): number | null {
  if (!p.length || !q.length) return null;
  const dist = (a: string, b: string) => {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / MAX_RGB_DIST;
  };
  const side = (x: string[], y: string[]) => x.reduce((acc, a) => acc + Math.min(...y.map((b) => dist(a, b))), 0) / x.length;
  return (side(p, q) + side(q, p)) / 2;
}

/** İki ölçülmüş görsel arasındaki görsel benzerlik (0..1). Ölçüm yoksa null: "bilinmiyor". */
export function visualSimilarity(a?: Aesthetics, b?: Aesthetics): number | null {
  if (!a?.measured || !b?.measured) return null;
  const pd = paletteDistance(a.palette, b.palette);
  if (pd === null) return null;
  const dm = Math.abs(a.brightness - b.brightness);
  const dw = Math.abs(a.warmth - b.warmth) / 2;
  const dist = 0.5 * pd + 0.3 * dm + 0.2 * dw;
  return clamp(1 - dist, 0, 1);
}

/** Dieci karakter referansı (sıcak, orta parlaklık) ile uyum. Editoryal sezgisel; kalite ölçüsü değildir. */
export const BRAND_REF = { warmth: 0.08, brightness: 0.5 };
export function brandFit(a?: Aesthetics): number | null {
  if (!a?.measured) return null;
  const d = Math.abs(a.warmth - BRAND_REF.warmth) * 2 + Math.abs(a.brightness - BRAND_REF.brightness);
  return clamp(1 - d, 0, 1);
}
