import type { Candidate, FormatId } from './types';
import { FORMATS } from './types';
import { coverage, ratioOf } from './crop';
import { brandFit, visualSimilarity } from './aesthetics';

/** Sert kısıtlar: önce uygulanır; geçemeyen aday hiç puanlanmaz. */
export type HardReason =
  | 'marka'
  | 'yayımlanmış'
  | 'plan-içi-tekrar'
  | 'reddedildi'
  | 'format'
  | 'hazir-degil'
  | 'video-kapak-yalnız-reels';

export const HARD_LABEL: Record<HardReason, string> = {
  marka: 'marka dışı',
  yayımlanmış: 'yayımlanmış geçmiş',
  'plan-içi-tekrar': 'planda/hikâyede zaten var',
  reddedildi: 'reddedildi',
  format: 'format sığmıyor',
  'hazir-degil': 'Instagram hazırlık denetimi geçmiyor',
  'video-kapak-yalnız-reels': 'video kapağı yalnız Reels',
};

export interface HardCtx {
  brand: string;
  rejected: Set<string>;
  inPlan: Set<string>;
}

/**
 * Fotoğraf her formatta kullanılabilir (Reels kapağı dahil; video üretildi iddiası yok).
 * Video kapağı yalnız Reels kapağında. Yayımlanmış geçmiş ve başka marka havuza girmez.
 */
export function hardCheck(c: Candidate, format: FormatId, ctx: HardCtx): HardReason | null {
  if (c.published) return 'yayımlanmış';
  if (c.brand !== ctx.brand) return 'marka';
  if (ctx.rejected.has(c.id)) return 'reddedildi';
  if (ctx.inPlan.has(c.id)) return 'plan-içi-tekrar';
  if (c.kind === 'video_cover' && FORMATS[format].lane !== 'reels') return 'video-kapak-yalnız-reels';
  if (coverage(c.dims, ratioOf(format)) < 0.5) return 'format';
  // Gerçek medyada canlı hazırlık denetimi (Reels kapağı: canlı şema tek video ister; fotoğraf 'error' olur)
  const type = FORMATS[format].lane === 'feed' ? 'static' : FORMATS[format].lane === 'story' ? 'story' : 'reels';
  if (c.readiness?.[type] === 'error') return 'hazir-degil';
  return null;
}

export const FEED_PURPOSE_GROUPS = ['genel_yemek_tabagi', 'pizza', 'makarna', 'katlanmis_focaccia', 'mekan_atmosfer'];

/** Ağırlıklar toplamı 1. Eksik bileşen hariç ağırlıklı ortalama alınır. */
const WEIGHTS = { brand: 0.15, rhythm: 0.15, harmony: 0.15, repetition: 0.15, diversity: 0.15, purpose: 0.1, format: 0.15 } as const;
export type PartKey = keyof typeof WEIGHTS;

export const PART_LABEL: Record<PartKey, string> = {
  brand: 'marka karakteri',
  rhythm: 'görsel ritim (komşu)',
  harmony: 'uyum (komşu)',
  repetition: 'geçmiş tekrar',
  diversity: 'çeşitlilik',
  purpose: 'içerik amacı',
  format: 'format uyumu',
};

export interface Scored {
  /** 0..100; yalnız ölçülmüş bileşenlerden. */
  total: number;
  known: number;
  parts: Record<PartKey, number | null>;
  missing: string[];
  warnings: string[];
  repetitionNote?: string;
  /** Kesin değil: 'ölçüldü' (piksel), 'nottan' (metin notu) veya 'bilinmiyor' */
  confidence: { pixels: boolean; semantic: Candidate['semantic']['source'] };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Komşu çifti için ritim (doku/yoğunluk/boşluk/çekim ölçeği farkı) ve uyum (renk/parlaklık/sıcaklık benzerliği).
 * Ritim farkı ödüllendirilir, uyum benzerlikte ödüllendirilir: ikisinin dengesi tek bir sabit eşiksiz.
 */
export function neighborPair(a: Candidate, n: Candidate): { rhythm: number; harmony: number } | null {
  const s = visualSimilarity(a.aesthetics, n.aesthetics);
  if (s === null || !a.aesthetics || !n.aesthetics) return null;
  const A = a.aesthetics;
  const B = n.aesthetics;
  const rhythmParts = [clamp01(Math.abs(A.density - B.density) * 2 + Math.abs(A.negativeSpace - B.negativeSpace))];
  if (a.semantic.shotScale !== 'bilinmiyor' && n.semantic.shotScale !== 'bilinmiyor') {
    rhythmParts.push(a.semantic.shotScale === n.semantic.shotScale ? 0 : 1);
  }
  return { rhythm: mean(rhythmParts), harmony: s };
}

export function scoreCandidate(
  c: Candidate,
  format: FormatId,
  neighbors: Candidate[],
  planned: Candidate[],
  published: Candidate[],
): Scored {
  const a = c.aesthetics?.measured ? c.aesthetics : undefined;
  const pairs = neighbors.map((n) => neighborPair(c, n)).filter((p): p is { rhythm: number; harmony: number } => p !== null);
  const rhythm = pairs.length ? mean(pairs.map((p) => p.rhythm)) : null;
  const harmony = pairs.length ? mean(pairs.map((p) => p.harmony)) : null;
  const brand = brandFit(a);
  const pSims = published.map((p) => visualSimilarity(a, p.aesthetics)).filter((s): s is number => s !== null);
  const repetition = a && pSims.length ? 1 - Math.max(...pSims) : null;
  const sameGroup = planned.filter((p) => p.group === c.group).length;
  const sameScale = c.semantic.shotScale === 'bilinmiyor' ? null : planned.filter((p) => p.semantic.shotScale === c.semantic.shotScale).length;
  const diversity = (1 / (1 + sameGroup) + (sameScale === null ? 0.5 : 1 / (1 + sameScale))) / 2;
  const purpose = FEED_PURPOSE_GROUPS.includes(c.group) ? 1 : 0.6;
  const fmt = coverage(c.dims, ratioOf(format));

  const parts: Record<PartKey, number | null> = { brand, rhythm, harmony, repetition, diversity, purpose, format: fmt };
  const missing: string[] = [];
  let wsum = 0;
  let s = 0;
  let known = 0;
  (Object.keys(WEIGHTS) as PartKey[]).forEach((k) => {
    const v = parts[k];
    if (v === null) {
      missing.push(PART_LABEL[k]);
      return;
    }
    known++;
    wsum += WEIGHTS[k];
    s += WEIGHTS[k] * v;
  });

  const warnings: string[] = [];
  if (c.aiMark === 'olası') warnings.push('AI izi olası: insan onayı gerekli');
  else if (c.aiMark === 'belirsiz') warnings.push('AI izi belirsiz');
  if (c.kind === 'video_cover') warnings.push('Video izlenmedi; yalnız kapak. Reels taslağı, video eksik');
  if (FORMATS[format].lane === 'reels') warnings.push('Reels kapağı taslağı: video üretilmedi, görsel yalnız kapak olarak kullanılır');
  if (c.dimsSource === 'önizleme') warnings.push('Gerçek kaynak boyutu yok; kırpma hassasiyeti düşük');
  const repetitionNote = repetition !== null && 1 - repetition > 0.8 ? 'geçmiş yayına çok benzer (sezgisel)' : undefined;
  return {
    total: wsum ? Math.round((s / wsum) * 100) : 0,
    known,
    parts,
    missing,
    warnings,
    repetitionNote,
    confidence: { pixels: !!a, semantic: c.semantic.source },
  };
}

export function explainShortage(eliminated: Partial<Record<HardReason, number>>, pool: number): string {
  const parts = (Object.keys(eliminated) as HardReason[])
    .filter((k) => eliminated[k])
    .map((k) => `${HARD_LABEL[k]}: ${eliminated[k]}`);
  return parts.length ? `Uygun aday yok (havuz ${pool}): ${parts.join(', ')}` : `Uygun aday yok (havuz ${pool})`;
}
