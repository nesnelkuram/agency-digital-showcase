import type { Candidate, FormatId } from './types';
import { FORMATS } from './types';
import { ratioOf } from './crop';
import { FULL_FRAME_EPS, type VisualDecision as VisualDecisionLike } from '../../shared/planner/visualDecision';
import { colorName } from '../../shared/planner/copyContract';
import {
  bestTextZone, cropResolution, effectiveLean, evaluateCrop, platformInsets, positionLean, subjectFocus, type CropEvalCache, type CropEvaluation, type Lean, type VLean,
} from '../../shared/planner/visualDecision';

/**
 * Kompozisyon uyumu: kayıtlı görsel karar (model gözlemi + kutu tahmini) ve kodla hesaplanan kırpım/komşuluk geometrisi.
 * SAF ve deterministik: görsel/ağ/model çağrısı YOKTUR; aynı girdi aynı sonucu verir.
 *
 * BİLİNMEYEN UYDURULMAZ: 'belirsiz' alanlar, bilinmeyen kutu ve veri olmayan komşular hiçbir bileşenin pay veya paydasına girmez
 * (o bileşen/çift/boyut dışarıda kalır); hiçbir bileşen bilinmiyorsa sonuç null'dur ("bilinmiyor"), iyi puan DEĞİL. Bilinen
 * geometrik türetmeler (kutudan konum, kırpım) ayrı kaynakla ('code') etiketlenir ve model ağırlığının yerine geçmez.
 * Sonuç bir ÖNERİ sezgisidir; estetik doğruluk iddiası değildir.
 */

export const GRID_COLS_FIT = 3;

export interface Placed {
  c: Candidate;
  format: FormatId;
}

/** Görünen/kilitli ETKİN kırpım (manuel veya varsayılan): puanlama bununla yapılır */
export interface EffectiveCrop {
  focus: { x: number; y: number };
  zoom: number;
}

export interface GridCtx {
  slot: number;
  lane: 'feed' | 'story';
  /** Yerleşmiş diğer slotlar (kilitliler dahil: sabit bağlam). Aday kendi slotunda DEĞİLDİR. */
  placed: Map<number, Placed>;
  /** 4 yönlü komşu slotlar (Story'de önceki/sonraki) */
  neighborSlots: number[];
  slotCount: number;
  /** İsteğe bağlı kırpım önbelleği (kapsam/analiz anahtarı denetimli) */
  cache?: CropEvalCache;
  /**
   * Post (nihai 4:5) değerlendirmesi: kırpım kareyi gerçekten kesiyorsa TAM-KAYNAK model yorumları (ışık, renk, yoğunluk, çevre, denge, çizgi,
   * odak rekabeti, ışık yönü…) kırpılmış görünüme YEREL olarak doğrulanamaz: bilinmiyor sayılır ya da son kırpımın piksel ölçümünden türetilir.
   * Konum/kutu kırpım hesabı koddan gelir. Kırpılmamışsa (tam kare) model alanları aynen geçerlidir. Story/yerel inceleme davranışı değişmez (false).
   */
  finalCropOnly?: boolean;
  /** Adayın etkin kırpımı (manuel odak+yakınlaştırma varsa o). Yoksa varsayılan (konu merkezli) odak, zoom 1. Aday, komşular, satır ve ızgara için AYNI kaynak. */
  cropFor?: (c: Candidate) => EffectiveCrop | null | undefined;
}

export type FitPart = 'crop' | 'placement' | 'column' | 'seam' | 'flow' | 'light' | 'context' | 'accent' | 'rhythm' | 'row' | 'grid' | 'repetition' | 'text' | 'quality';
export type FitSource = 'model' | 'code' | 'model+code';

export interface FitResult {
  /** 0..1; görsel karardan türeyen hiçbir bileşen bilinmiyorsa null */
  value: number | null;
  parts: Partial<Record<FitPart, number | null>>;
  /** Bilinen bileşenin dayandığı kaynak: model gözlemi, kod hesabı (modelin kutu tahmininden/kaynak boyutundan) veya ikisi */
  sources: Partial<Record<FitPart, FitSource>>;
  /** Bilinmeyen (puana katılmayan) bileşenler */
  unknown: FitPart[];
  notes: string[];
  crop: CropEvaluation | null;
}

const W: Record<FitPart, number> = { crop: 0.15, placement: 0.05, column: 0.08, seam: 0.17, flow: 0.05, light: 0.04, context: 0.05, accent: 0.03, rhythm: 0.13, row: 0.12, grid: 0.1, repetition: 0.09, text: 0.05, quality: 0.06 };
/** Görsel kararın KENDİSİNE dayanan bileşenler: hepsi bilinmiyorsa kompozisyon bilinmiyordur (quality yalnız kaynak boyutundan gelir, tek başına yetmez) */
const VISUAL_PARTS: FitPart[] = ['crop', 'placement', 'column', 'seam', 'flow', 'light', 'context', 'accent', 'rhythm', 'row', 'grid', 'repetition', 'text'];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Önerilen kırpım odağı: kayıtlı konu kutusunun merkezi (kod hesabı); yoksa semantik konum, o da yoksa merkez (kutu bilinmiyorsa konu merkezli odak İDDİA EDİLMEZ) */
export const FOCUS_BY_SUBJECT_POS: Record<string, { x: number; y: number }> = {
  merkez: { x: 0.5, y: 0.5 }, sol: { x: 0.3, y: 0.5 }, sağ: { x: 0.7, y: 0.5 }, üst: { x: 0.5, y: 0.3 }, alt: { x: 0.5, y: 0.7 },
};
export function defaultFocusOf(c: Candidate): { x: number; y: number } {
  return subjectFocus(c.visual?.decision) ?? FOCUS_BY_SUBJECT_POS[c.semantic.subjectPos] ?? { x: 0.5, y: 0.5 };
}

const cropFrom = (c: Candidate, g?: Pick<GridCtx, 'cropFor'>): EffectiveCrop => {
  const e = g?.cropFor?.(c);
  return e && e.focus ? { focus: e.focus, zoom: Math.max(1, e.zoom || 1) } : { focus: defaultFocusOf(c), zoom: 1 };
};

/** Adayın verilen formattaki kırpım değerlendirmesi (yalnız kayıtlı görsel karar varsa). `crop` verilmezse varsayılan odak, zoom 1. */
export function cropOf(c: Candidate, format: FormatId, cache?: CropEvalCache, crop?: EffectiveCrop): CropEvaluation | null {
  if (!c.visual) return null;
  const e = crop ?? { focus: defaultFocusOf(c), zoom: 1 };
  return cache
    ? cache.eval(c.visual, c.dims, format, ratioOf(format), e.focus, e.zoom)
    : evaluateCrop(c.visual.decision, c.dims, ratioOf(format), e.focus, e.zoom, platformInsets(format));
}

interface View {
  c: Candidate;
  /** Değerlendirmede KULLANILAN karar: tam kare ise kayıtlı karar; Post'ta kırpılmışsa son kırpıma yerelleştirilmiş karar */
  d: VisualDecisionLike;
  format: FormatId;
  ev: CropEvaluation;
  /** Model AĞIRLIK yönü (kırpım sonrası); null = bilinmiyor */
  h: Lean | null;
  v: VLean | null;
}
const viewOf = (c: Candidate, format: FormatId, g: GridCtx): View | null => {
  let ev = cropOf(c, format, g.cache, cropFrom(c, g));
  if (!ev || !c.visual) return null;
  // Model kutu güveni 'belirsiz' ise kutu GÜVENİLİR sayılmaz: geometri türevleri bilinmiyor (kutu varmış gibi kullanılmaz)
  if (c.visual.decision.subject.boxConfidence === 'belirsiz' && ev.subject.status !== 'bilinmiyor') {
    ev = { ...ev, subject: { status: 'bilinmiyor', insideShare: null, centerInCrop: null, areaShareInCrop: null }, weightShift: null };
  }
  const cropped = ev.window.w * ev.window.h < 1 - FULL_FRAME_EPS;
  const d = g.finalCropOnly && cropped ? finalCropDecision(c, ev) : c.visual.decision;
  const l = effectiveLean(d, ev);
  return { c, d, format, ev, h: l.h, v: l.v };
};

/**
 * Son 4:5 kırpım için karar: yerelleştirilemeyen tam-kaynak yorumlar 'belirsiz'; piksel bazlı olanlar SON KIRPIMIN ölçümünden (aesthetics) türetilir.
 * Ağırlık yönü: ana konu kırpımda görünürse konumundan (kod), değilse bilinmiyor. Ölçüm yoksa türetilenler de bilinmiyor.
 */
export function finalCropDecision(c: Candidate, ev: CropEvaluation): VisualDecisionLike {
  const d = c.visual!.decision;
  const a = c.aesthetics?.measured ? c.aesthetics : null;
  const subjectIn = ev.subject.status === 'korunur' || ev.subject.status === 'kenarda';
  const names = a ? [...new Set(a.palette.map(colorName))] : [];
  const pl = positionLean(ev);
  return {
    ...d,
    subject: { ...d.subject, scale: 'belirsiz' },
    surroundings: { relation: 'belirsiz', setting: 'belirsiz' },
    weight: { direction: subjectIn && pl ? (pl.h === 'merkez' ? 'merkez' : pl.h) : 'belirsiz', reasons: [] },
    negativeSpace: {
      zone: a && (a.negativeZone === 'üst' || a.negativeZone === 'alt') ? a.negativeZone : 'belirsiz',
      amount: a ? (a.negativeSpace >= 0.25 ? 'geniş' : a.negativeSpace >= 0.1 ? 'orta' : a.negativeSpace >= 0.02 ? 'az' : 'yok') : 'belirsiz',
      regions: [],
    },
    focus: { competition: 'belirsiz', competingElements: [] },
    directions: { gaze: subjectIn ? d.directions.gaze : 'belirsiz', motion: subjectIn ? d.directions.motion : 'belirsiz', leadingLines: 'belirsiz' },
    balance: 'belirsiz',
    color: { main: names[0] ?? '', accents: names.slice(1, 3), attention: 'belirsiz', temperature: a ? (a.warmth > 0.05 ? 'sıcak' : a.warmth < -0.05 ? 'soğuk' : 'nötr') : 'belirsiz' },
    tone: {
      light: a ? (a.brightness < 0.4 ? 'koyu' : a.brightness > 0.6 ? 'açık' : 'orta') : 'belirsiz',
      contrast: a ? (a.contrast < 0.12 ? 'düşük' : a.contrast > 0.25 ? 'yüksek' : 'orta') : 'belirsiz',
      detail: a ? (a.density < 0.2 ? 'sade' : a.density > 0.5 ? 'yoğun' : 'orta') : 'belirsiz',
      subjectSeparation: 'belirsiz',
    },
    lighting: { direction: 'belirsiz', brightZone: 'belirsiz', darkZone: 'belirsiz', blownHighlights: 'belirsiz', crushedShadows: 'belirsiz' },
    density: a ? (a.density < 0.2 ? 'sakin' : a.density > 0.5 ? 'kalabalık' : 'dengeli') : 'belirsiz',
  };
}

const SCALE_ORD: Record<string, number> = { yakın: 0, orta: 1, geniş: 2 };
const LIGHT_ORD: Record<string, number> = { koyu: 0, orta: 1, açık: 2 };
const CROWD_ORD: Record<string, number> = { sakin: 0, dengeli: 1, kalabalık: 2 };
const CONTRAST_ORD: Record<string, number> = { düşük: 0, orta: 1, yüksek: 2 };
/** Kategorik fark: ikisi de BİLİNİYORSA farklıysa 1, aynıysa 0; biri bilinmiyorsa null */
const catDiff = (a: string, b: string): number | null => (a === 'belirsiz' || b === 'belirsiz' ? null : a === b ? 0 : 1);
const BIG = new Set(['orta', 'geniş']);
const NEG_KNOWN = new Set(['sol', 'sağ', 'üst', 'alt', 'çevre', 'yok']);
const NEG_AMOUNT_KNOWN = new Set(['yok', 'az', 'orta', 'geniş']);

const ordDist = (a: string, b: string, ord: Record<string, number>): number | null => (a in ord && b in ord ? Math.abs(ord[a] - ord[b]) / 2 : null);
function rhythmPair(a: View, b: View): number | null {
  const A = a.d;
  const B = b.d;
  const ds = [ordDist(A.subject.scale, B.subject.scale, SCALE_ORD), ordDist(A.tone.light, B.tone.light, LIGHT_ORD), ordDist(A.density, B.density, CROWD_ORD), ordDist(A.tone.contrast, B.tone.contrast, CONTRAST_ORD)].filter((x): x is number => x !== null);
  return ds.length ? Math.min(1, mean(ds) * 1.6) : null;
}

/**
 * İki bitişik karenin dikiş (sınır) cezası 0..1 ve nedeni. Yalnız BİLİNEN bileşenler değerlendirilir; hiçbiri bilinmiyorsa null (çift dışarıda).
 * Ağırlık yığılması/boşluğu modelin ağırlık yönünden, boş alan buluşması modelin boş alan bölgesi/miktarından gelir.
 */
function seamPair(first: View, second: View, axis: 'h' | 'v'): { penalty: number; note: string | null } | null {
  let penalty = 0;
  let note: string | null = null;
  let known = false;
  const set = (p: number, n: string) => {
    if (p > penalty) {
      penalty = p;
      note = n;
    }
  };
  const A = first.d;
  const B = second.d;
  const a = axis === 'h' ? first.h : first.v;
  const b = axis === 'h' ? second.h : second.v;
  if (a !== null && b !== null) {
    known = true;
    if (axis === 'h') {
      if (a === 'sağ' && b === 'sol') set(0.5, 'görsel ağırlıklar yan yana dikişte yığılıyor');
      else if (a === 'sol' && b === 'sağ') set(0.25, 'ağırlıklar dışa kaçıp aradaki dikişte boşluk bırakıyor');
    } else if (a === 'alt' && b === 'üst') set(0.5, 'görsel ağırlıklar alt alta dikişte yığılıyor');
    else if (a === 'üst' && b === 'alt') set(0.25, 'ağırlıklar dışa kaçıp aradaki dikişte boşluk bırakıyor');
  }
  const zoneA = A.negativeSpace.zone;
  const zoneB = B.negativeSpace.zone;
  if (NEG_KNOWN.has(zoneA) && NEG_KNOWN.has(zoneB) && NEG_AMOUNT_KNOWN.has(A.negativeSpace.amount) && NEG_AMOUNT_KNOWN.has(B.negativeSpace.amount)) {
    known = true;
    const [fz, sz] = axis === 'h' ? ['sağ', 'sol'] : ['alt', 'üst'];
    if ((zoneA === fz || zoneA === 'çevre') && (zoneB === sz || zoneB === 'çevre') && BIG.has(A.negativeSpace.amount) && BIG.has(B.negativeSpace.amount)) {
      set(0.3, axis === 'h' ? 'iki karenin boş alanı yan yana büyük bir boşluk yaratıyor' : 'alt alta iki boş alan büyük bir boşluk yaratıyor');
    }
  }
  return known ? { penalty, note } : null;
}

const rowOf = (slot: number) => Math.floor(slot / GRID_COLS_FIT);
const knownScale = (v: View) => (v.d.subject.scale !== 'belirsiz' ? v.d.subject.scale : null);
const knownDensity = (v: View) => (v.d.density !== 'belirsiz' ? v.d.density : null);
const colorMain = (v: View) => {
  const m = v.d.color.main.trim().toLocaleLowerCase('tr');
  return m && m !== 'belirsiz' ? m : null;
};

export function compositionFit(c: Candidate, format: FormatId, g: GridCtx): FitResult {
  const parts: FitResult['parts'] = {};
  const sources: FitResult['sources'] = {};
  const notes: string[] = [];
  const me = viewOf(c, format, g);
  if (!me) return { value: null, parts, sources, unknown: [], notes: ['kompozisyon kararı kayıtlı değil (bilinmiyor)'], crop: null };
  const D = me.d;
  const geometryNote = c.visual!.provenance.geometryBasis === 'preview_assumed_same_aspect' ? 'kutu önizlemeden tahmin; kare oranı aynı varsayıldı' : null;
  const lane = FORMATS[format].lane;

  // Kırpım: konu korunuyor mu (kod; girdi modelin kutu tahmini). Kutu bilinmiyorsa bilinmiyor.
  const status = me.ev.subject.status;
  if (status === 'bilinmiyor') parts.crop = null;
  else {
    parts.crop = status === 'korunur' ? 1 : status === 'kenarda' ? 0.75 : status === 'kısmen_kesilir' ? 0.3 : 0.05;
    sources.crop = 'code';
    if (status === 'kısmen_kesilir' || status === 'kesilir') notes.push(`${FORMATS[format].label} kırpımında konu ${status === 'kesilir' ? 'büyük ölçüde dışarıda kalıyor' : `kısmen kesiliyor (%${Math.round((me.ev.subject.insideShare ?? 0) * 100)} kalıyor)`}`);
    else if (status === 'kenarda') notes.push(`${FORMATS[format].label} kırpımında konu kenara çok yakın`);
    if (geometryNote && status !== 'korunur') notes.push(geometryNote);
  }

  // Komşular
  const nbViews: Array<{ v: View; slot: number }> = [];
  for (const j of g.neighborSlots) {
    const p = g.placed.get(j);
    if (!p) continue;
    const v = viewOf(p.c, p.format, g);
    if (v) nbViews.push({ v, slot: j });
  }

  // Konum (kod, kutudan) — ağırlık DEĞİLDİR; sütuna göre konu yerleşimi
  const pl = g.lane === 'feed' ? positionLean(me.ev) : null;
  if (pl) {
    const col = g.slot % GRID_COLS_FIT;
    parts.placement = col === 1 ? (pl.h === 'merkez' ? 1 : 0.75) : pl.h === 'merkez' ? 0.85 : pl.h === (col === 0 ? 'sol' : 'sağ') ? 0.5 : 1;
    sources.placement = 'code';
  } else parts.placement = null;

  // Sütun: yalnız MODEL ağırlığı bilinirse (belirsiz → bilinmiyor; merkeze çevrilmez)
  if (g.lane === 'feed' && me.h !== null) {
    const col = g.slot % GRID_COLS_FIT;
    if (col === 1) parts.column = me.h === 'merkez' ? 1 : 0.7;
    else {
      const outward: Lean = col === 0 ? 'sol' : 'sağ';
      parts.column = me.h === outward ? 0.45 : me.h === 'merkez' ? 0.85 : 1;
      if (me.h === outward) notes.push(`${col === 0 ? 'sol' : 'sağ'} sütunda ağırlık kenara doğru`);
    }
    sources.column = 'model';
  } else parts.column = null;

  // Dikiş (yalnız ızgara). Bilinmeyen çiftler dışarıda.
  if (g.lane === 'feed' && nbViews.length) {
    const pens: number[] = [];
    for (const { v, slot } of nbViews) {
      const sameRow = rowOf(slot) === rowOf(g.slot);
      const r = sameRow ? (slot < g.slot ? seamPair(v, me, 'h') : seamPair(me, v, 'h')) : slot < g.slot ? seamPair(v, me, 'v') : seamPair(me, v, 'v');
      if (!r) continue;
      pens.push(r.penalty);
      if (r.note && r.penalty >= 0.25) notes.push(r.note);
    }
    if (pens.length) {
      parts.seam = clamp01(1 - mean(pens) * 1.4);
      sources.seam = 'model';
    } else parts.seam = null;
  } else parts.seam = null;

  // Yön akışı (bakış/hareket): yalnız sol/sağ yönü AÇIK bildirilenler. Izgara dışına bakış cezalı; komşu çift birbirine bakıyorsa iyi, sırt sırta kötü.
  if (g.lane === 'feed') {
    const horiz = (v: View): 'sol' | 'sağ' | null => {
      const d = v.d.directions;
      const x = d.gaze === 'sol' || d.gaze === 'sağ' ? d.gaze : d.motion === 'sol' || d.motion === 'sağ' ? d.motion : null;
      return x;
    };
    const fl: number[] = [];
    const mine = horiz(me);
    const col = g.slot % GRID_COLS_FIT;
    if (mine) {
      if (col === 0 && mine === 'sol') { fl.push(0.6); notes.push('sol sütunda bakış/hareket ızgaranın dışına gidiyor'); }
      else if (col === 2 && mine === 'sağ') { fl.push(0.6); notes.push('sağ sütunda bakış/hareket ızgaranın dışına gidiyor'); }
      else fl.push(1);
    }
    for (const { v, slot } of nbViews) {
      if (rowOf(slot) !== rowOf(g.slot)) continue;
      const theirs = horiz(v);
      if (!mine || !theirs) continue;
      const [a, b] = slot < g.slot ? [theirs, mine] : [mine, theirs]; // a: soldaki kare, b: sağdaki kare
      if (a === 'sağ' && b === 'sol') fl.push(1);
      else if (a === 'sol' && b === 'sağ') { fl.push(0.5); notes.push('komşu kareler sırt sırta bakıyor/hareket ediyor'); }
      else fl.push(0.8);
    }
    if (fl.length) {
      parts.flow = mean(fl);
      sources.flow = 'model';
    } else parts.flow = null;
  } else parts.flow = null;

  // Işık yönü (komşu çiftler): zıt yönden gelen ışık yan yana sert kopukluk; yalnız iki tarafta da BİLİNEN yön
  if (g.lane === 'feed' && nbViews.length) {
    const OPP: Record<string, string> = { sol: 'sağ', sağ: 'sol', üst: 'alt', alt: 'üst' };
    const lv: number[] = [];
    for (const { v } of nbViews) {
      const a = D.lighting.direction;
      const b = v.d.lighting.direction;
      if (a === 'belirsiz' || b === 'belirsiz') continue;
      if (a === b) lv.push(1);
      else if (OPP[a] === b) { lv.push(0.55); notes.push('komşuyla ışık zıt yönden geliyor'); }
      else lv.push(0.85);
    }
    if (lv.length) { parts.light = mean(lv); sources.light = 'model'; } else parts.light = null;
  } else parts.light = null;

  // Konu–çevre ilişkisi ve çizgi akışı: komşu çiftlerde BİLİNEN farkların çeşitliliği (aynı ilişki/çevre/çizgi tekrarı düz akış)
  if (nbViews.length) {
    const cv: number[] = [];
    for (const { v } of nbViews) {
      const B = v.d;
      const comps = [
        catDiff(D.surroundings?.relation ?? 'belirsiz', B.surroundings?.relation ?? 'belirsiz'),
        catDiff(D.surroundings?.setting ?? 'belirsiz', B.surroundings?.setting ?? 'belirsiz'),
        D.directions.leadingLines === 'yok' && B.directions.leadingLines === 'yok' ? null : catDiff(D.directions.leadingLines, B.directions.leadingLines),
      ].filter((x): x is number => x !== null);
      if (comps.length) cv.push(Math.min(1, mean(comps) * 1.5));
    }
    if (cv.length) {
      parts.context = mean(cv);
      sources.context = 'model';
      if (mean(cv) < 0.15) notes.push('komşularla aynı konu–çevre ilişkisi/çizgi akışı');
    } else parts.context = null;
  } else parts.context = null;

  // Vurgu rengi bağı: komşu çiftlerden biriyle AYNI vurgu/dikkat rengi (renk tekrarı = bağ); hiçbiri paylaşmıyorsa daha düşük. Yalnız adı bilinenler.
  if (nbViews.length) {
    const norm = (x: string) => x.trim().toLocaleLowerCase('tr');
    const set = (d: VisualDecisionLike) => new Set([d.color.attention ?? '', ...(d.color.accents ?? [])].map(norm).filter((x) => x && x !== 'belirsiz'));
    const mine = set(D);
    const av: number[] = [];
    if (mine.size) for (const { v } of nbViews) {
      const theirs = set(v.d);
      if (!theirs.size) continue;
      av.push([...mine].some((x) => theirs.has(x)) ? 1 : 0.6);
    }
    if (av.length) { parts.accent = mean(av); sources.accent = 'model'; } else parts.accent = null;
  } else parts.accent = null;

  // Ritim (yakın-geniş, açık-koyu, sakin-yoğun, kontrast): yalnız her iki tarafta bilinen boyutlar
  const rp = nbViews.map(({ v }) => rhythmPair(me, v)).filter((x): x is number => x !== null);
  if (rp.length) {
    parts.rhythm = mean(rp);
    sources.rhythm = 'model';
    if (mean(rp) < 0.15) notes.push('komşularla aynı ölçek/ton/yoğunlukta: ritim düz');
  } else parts.rhythm = null;

  // Satır üçlüsü (Story'de 3 ardışık kare penceresi). Her alt bileşen yalnız YETERLİ bilinen üyeyle hesaplanır.
  const rowMembers: View[] = [me];
  const rowSlots: number[] =
    g.lane === 'feed'
      ? [0, 1, 2].map((k) => rowOf(g.slot) * GRID_COLS_FIT + k).filter((s) => s !== g.slot && s < g.slotCount)
      : [g.slot - 1, g.slot + 1].filter((s) => s >= 0 && s < g.slotCount);
  for (const s of rowSlots) {
    const p = g.placed.get(s);
    const v = p ? viewOf(p.c, p.format, g) : null;
    if (v) rowMembers.push(v);
  }
  if (rowMembers.length >= 2) {
    const rp2: number[] = [];
    const scales = rowMembers.map(knownScale).filter((x): x is NonNullable<typeof x> => x !== null);
    if (scales.length >= 2) rp2.push(new Set(scales).size / Math.min(scales.length, 3));
    // "Yoğun" kare: kalabalık kompozisyon VEYA odak rekabeti; yalnız en az biri bilinen üyeler sayılır
    const busyOf = (m: View): boolean | null => {
      const d = m.d;
      if (d.density === 'kalabalık' || d.focus.competition === 'rekabet') return true;
      return d.density === 'belirsiz' && d.focus.competition === 'belirsiz' ? null : false;
    };
    const busy = rowMembers.map(busyOf).filter((x): x is boolean => x !== null);
    if (busy.length >= 2) {
      const crowd = busy.filter(Boolean).length;
      rp2.push(crowd >= 2 ? 0.3 : 1);
      if (crowd >= 2) notes.push('aynı satırda iki kalabalık/odak yarışan kare');
    }
    // Denge: aynı satırda iki 'asimetrik_ağır' kare ağır küme oluşturur (bilinenler üzerinden)
    const bal = rowMembers.map((m) => m.d.balance).filter((x) => x !== 'belirsiz');
    if (bal.length >= 2) {
      const heavyN = bal.filter((x) => x === 'asimetrik_ağır').length;
      rp2.push(heavyN >= 2 ? 0.4 : 1);
      if (heavyN >= 2) notes.push('aynı satırda iki asimetrik-ağır kare');
    }
    const dens = rowMembers.map(knownDensity).filter((x): x is NonNullable<typeof x> => x !== null);
    const leans = rowMembers.map((m) => m.h).filter((l): l is Lean => l !== null);
    if (rowMembers.length >= 3 && leans.length >= 3) {
      if (leans.every((l) => l === 'sol') || leans.every((l) => l === 'sağ')) {
        rp2.push(0.4);
        notes.push('satırdaki üç karenin ağırlığı aynı yöne akıyor');
      } else rp2.push(1);
    }
    if (rowMembers.length >= 3 && dens.length >= 3) rp2.push(dens.some((d) => d === 'sakin') ? 1 : 0.6);
    if (rp2.length) {
      parts.row = mean(rp2);
      sources.row = 'model';
    } else parts.row = null;
  } else parts.row = null;

  // Tüm ızgara dengesi: her boyut yalnız BİLİNEN üyelerle (≥3) hesaplanır; bilinmeyen payda dışı
  const all: View[] = [me];
  for (const [s, p] of g.placed) {
    if (s === g.slot) continue;
    const v = viewOf(p.c, p.format, g);
    if (v) all.push(v);
  }
  const dimImbalance = (vals: Array<string | null>, a: string, b: string): number | null => {
    const known = vals.filter((x): x is string => x !== null);
    if (known.length < 3) return null;
    return Math.abs(known.filter((x) => x === a).length - known.filter((x) => x === b).length) / known.length;
  };
  const imb = [
    dimImbalance(all.map((m) => m.h), 'sol', 'sağ'),
    dimImbalance(all.map((m) => (m.d.tone.light === 'belirsiz' ? null : m.d.tone.light)), 'koyu', 'açık'),
    dimImbalance(all.map((m) => (m.d.color.temperature === 'belirsiz' ? null : m.d.color.temperature)), 'sıcak', 'soğuk'),
    dimImbalance(all.map((m) => knownScale(m)), 'yakın', 'geniş'),
    // Genel kontrast: yüksek/düşük kontrastlı karelerin dağılımı
    dimImbalance(all.map((m) => (m.d.tone.contrast === 'belirsiz' ? null : m.d.tone.contrast)), 'yüksek', 'düşük'),
    // Denge: asimetrik-ağır karelerin payı (bilinenler arasında) bir eşiği aşarsa ızgara ağırlaşır
    (() => {
      const known = all.map((m) => m.d.balance).filter((x) => x !== 'belirsiz');
      if (known.length < 3) return null;
      return Math.min(1, Math.max(0, (known.filter((x) => x === 'asimetrik_ağır').length / known.length - 0.34) * 1.5));
    })(),
  ];
  const imbKnown = imb.filter((x): x is number => x !== null);
  if (imbKnown.length) {
    parts.grid = clamp01(1 - mean(imbKnown));
    sources.grid = 'model';
    if (imb[0] !== null && imb[0] > 0.5) notes.push('ızgarada ağırlık tek yana kayıyor');
  } else parts.grid = null;

  // Tekrar (konu hücresi + ölçek + ana renk): yalnız iki tarafta da bilinen bileşenler karşılaştırılır
  const others = [...nbViews.map((x) => x.v), ...rowMembers.filter((m) => m !== me)];
  const sims: number[] = [];
  for (const o of others) {
    let comparable = 0;
    let matched = 0;
    if (me.ev.subject.centerInCrop && o.ev.subject.centerInCrop) {
      const cell = (ev: CropEvaluation) => `${Math.min(2, Math.floor(ev.subject.centerInCrop!.x * 3))}${Math.min(2, Math.floor(ev.subject.centerInCrop!.y * 3))}`;
      comparable += 0.4;
      if (cell(me.ev) === cell(o.ev)) matched += 0.4;
    }
    const sa = knownScale(me);
    const sb = knownScale(o);
    if (sa && sb) {
      comparable += 0.3;
      if (sa === sb) matched += 0.3;
    }
    const ca = colorMain(me);
    const cb = colorMain(o);
    if (ca && cb) {
      comparable += 0.3;
      if (ca === cb) matched += 0.3;
    }
    const ra = D.surroundings;
    const rb = o.d.surroundings;
    if (ra && rb && ra.setting !== 'belirsiz' && rb.setting !== 'belirsiz' && ra.relation !== 'belirsiz' && rb.relation !== 'belirsiz') {
      comparable += 0.2;
      if (ra.setting === rb.setting && ra.relation === rb.relation) matched += 0.2;
    }
    if (comparable > 0) sims.push((matched / comparable) * Math.min(1, comparable / 0.7));
  }
  if (sims.length) {
    const worst = Math.max(...sims);
    parts.repetition = 1 - worst;
    sources.repetition = 'model+code';
    if (worst >= 0.7) notes.push('komşu/satırdakiyle konu konumu, ölçek ve ana renk tekrarı');
  } else parts.repetition = null;

  // Yazı için güvenli alan (Story / Reels kapağı): platform güvenli kenarları dahil. Model "güven: belirsiz" ve alan vermediyse bilinmiyor.
  if (lane !== 'feed') {
    const tz = bestTextZone(me.ev);
    if (tz) {
      parts.text = 0.4 + 0.6 * tz.score;
      sources.text = 'model+code';
    } else if (D.textSafe.length) {
      parts.text = 0.2;
      sources.text = 'model+code';
      notes.push('yazı için güvenli alan yok: kırpımda kayboluyor, konuyla çakışıyor veya platform güvenli kenarlarının dışında');
    } else if (D.fieldConfidence.textSafe === 'belirsiz') parts.text = null;
    else {
      parts.text = 0.15;
      sources.text = 'model';
      notes.push('model yazı için güvenli alan önermedi');
    }
  } else parts.text = null;

  // Kırpım sonrası çözünürlük (kod; yalnız kaynak boyutu + hedef boyut). Büyütme gerekiyorsa kalite riski.
  const res = cropResolution(c.dims, me.ev.window, format);
  // Model teknik kalite gözlemi: yalnız BİLİNEN alanlardan (netlik, gürültü, sıkıştırma, pozlama, patlama/ezilme, konu ayrışması); bilinmeyen dışarıda
  const T = D.technical;
  const techVals: number[] = [];
  const pick = (v: string, m: Record<string, number>) => { if (v in m) techVals.push(m[v]); };
  pick(T.sharpness, { net: 1, hafif_bulanık: 0.7, bulanık: 0.3 });
  pick(T.noise, { yok: 1, hafif: 0.85, belirgin: 0.5 });
  pick(T.compression, { yok: 1, hafif: 0.85, belirgin: 0.5 });
  pick(T.exposure, { dengeli: 1, karanlık: 0.6, parlak: 0.6 });
  pick(D.lighting.blownHighlights, { yok: 1, var: 0.6 });
  pick(D.lighting.crushedShadows, { yok: 1, var: 0.6 });
  pick(D.tone.subjectSeparation, { iyi: 1, orta: 0.8, zayıf: 0.6 });
  const tech = techVals.length ? mean(techVals) : null;
  const resScore = res && Number.isFinite(res.scale) && res.scale > 0 ? clamp01(res.scale) : null;
  const qs = [resScore, tech].filter((x): x is number => x !== null);
  if (qs.length) {
    parts.quality = mean(qs);
    sources.quality = resScore !== null && tech !== null ? 'model+code' : resScore !== null ? 'code' : 'model';
    if (resScore !== null && res && res.scale < 0.9) notes.push(`kırpım sonrası ${res.sourcePx.w}×${res.sourcePx.h} px; hedef ${res.targetPx.w}×${res.targetPx.h} için büyütme gerekiyor`);
    if (tech !== null && tech < 0.75) notes.push('model teknik kalite sorunu bildirdi (netlik/gürültü/sıkıştırma/pozlama)');
  } else parts.quality = null;

  const unknown: FitPart[] = [];
  let wsum = 0;
  let s = 0;
  for (const k of Object.keys(W) as FitPart[]) {
    const v = parts[k];
    if (v === null || v === undefined) {
      if (!(k === 'text' && lane === 'feed') && !(k === 'column' && g.lane !== 'feed') && !(k === 'placement' && g.lane !== 'feed') && !(k === 'seam' && g.lane !== 'feed') && !(k === 'flow' && g.lane !== 'feed') && !(k === 'light' && g.lane !== 'feed')) unknown.push(k);
      continue;
    }
    wsum += W[k];
    s += W[k] * v;
  }
  const anyVisual = VISUAL_PARTS.some((k) => parts[k] !== null && parts[k] !== undefined);
  if (!anyVisual || !wsum) {
    return { value: null, parts, sources, unknown, notes: [...notes, 'kompozisyon alanları belirsiz/eksik: puana katılmadı (bilinmiyor)'], crop: me.ev };
  }
  return { value: clamp01(s / wsum), parts, sources, unknown, notes: [...new Set(notes)], crop: me.ev };
}
