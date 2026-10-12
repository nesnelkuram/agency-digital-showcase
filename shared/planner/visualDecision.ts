/**
 * Görsel karar (kompozisyon) sözleşmesi — sunucu (analiz kaydı) ve istemci (plan motoru) ORTAK, saf, bağımlılıksız.
 *
 * Kaynak ayrımı (hiçbiri "doğrulanmış" değildir, ayrım açıktır):
 *  - model gözlemi : `VisualDecision` içindeki her alan (anlamsal yargı ve KUTU TAHMİNİ). Kesin ölçüm DEĞİLDİR.
 *  - kod hesabı    : kutudan türetilen konum/alan/oran, kırpım hesapları, ağırlık kayması (bu dosya). Girdi yine modelin
 *                    kutu tahminidir; `Derived.source` bunu söyler. Tarayıcıda ölçülen piksel istatistikleri 'pixels' kaynağıdır.
 *  - insan         : yalnız media_catalog_corrections (konu/açıklama/kullanım önerisi vb.); görsel karar alanları için insan düzeltmesi YOKTUR.
 * Bilinmeyen 'belirsiz' ile gösterilir; kutu bilinmiyorsa `subject.box === null`. Bilinmeyen alan puana/oranlara KATILMAZ ve
 * başka bir değere (ör. merkez) çevrilmez. Alan bazında güven `fieldConfidence`, alan bazında not `fieldNotes` ile taşınır.
 */

/**
 * v2: kutu bilinmeyebilir (null), alan bazında güven/not, ışık (yön/bölge/patlama-ezilme), negatif alan bölgeleri, odak rakipleri, gürültü/sıkıştırma
 * v3: `surroundings` (konu–çevre ilişkisinin niteliği) + `fieldConfidence.context`. Sürüm değişimi analysisKey'i ve istemci önbelleğini
 * ayırır; v2 ve öncesi kayıtlar bu alanı taşımaz → uydurulmaz: "eski şema" olarak gösterilmez/planda kullanılmaz (yeniden analiz otomatik başlatılmaz).
 */
export const VISUAL_SCHEMA_VERSION = 'visual-decision-3';
export const VISUAL_PROMPT_VERSION = 'visual-decision-prompt-3';

export const SCALES = ['yakın', 'orta', 'geniş', 'belirsiz'] as const;
export const WEIGHT_DIRECTIONS = ['sol', 'sağ', 'üst', 'alt', 'merkez', 'dengeli', 'belirsiz'] as const;
export const WEIGHT_REASONS = ['büyük_obje', 'koyu_ton', 'parlak_nokta', 'doygun_renk', 'yüksek_kontrast', 'insan_figürü', 'yazı_logo', 'keskin_odak'] as const;
export const NEG_ZONES = ['sol', 'sağ', 'üst', 'alt', 'çevre', 'yok', 'belirsiz'] as const;
export const NEG_AMOUNTS = ['yok', 'az', 'orta', 'geniş', 'belirsiz'] as const;
export const COMPETITION = ['tek_odak', 'ikincil_odak', 'rekabet', 'belirsiz'] as const;
export const GAZE_MOTION = ['sol', 'sağ', 'yukarı', 'aşağı', 'kameraya', 'yok', 'belirsiz'] as const;
export const LEADING_LINES = ['yok', 'yatay', 'dikey', 'çapraz', 'kıvrımlı', 'belirsiz'] as const;
export const BALANCE = ['simetrik', 'asimetrik_dengeli', 'asimetrik_ağır', 'belirsiz'] as const;
export const TEMPERATURE = ['sıcak', 'soğuk', 'nötr', 'karışık', 'belirsiz'] as const;
export const LIGHT = ['koyu', 'orta', 'açık', 'belirsiz'] as const;
export const CONTRAST = ['düşük', 'orta', 'yüksek', 'belirsiz'] as const;
export const DETAIL = ['sade', 'orta', 'yoğun', 'belirsiz'] as const;
export const CROWD = ['sakin', 'dengeli', 'kalabalık', 'belirsiz'] as const;
export const SHARPNESS = ['net', 'hafif_bulanık', 'bulanık', 'belirsiz'] as const;
export const EXPOSURE = ['dengeli', 'karanlık', 'parlak', 'belirsiz'] as const;
export const LEVEL4 = ['yok', 'hafif', 'belirgin', 'belirsiz'] as const;
export const SEPARATION = ['iyi', 'orta', 'zayıf', 'belirsiz'] as const;
export const LIGHT_DIRECTIONS = ['sol', 'sağ', 'üst', 'alt', 'önden', 'arkadan', 'dağınık', 'belirsiz'] as const;
export const LIGHT_ZONES = ['sol', 'sağ', 'üst', 'alt', 'merkez', 'dağınık', 'yok', 'belirsiz'] as const;
export const PRESENCE = ['yok', 'var', 'belirsiz'] as const;
/** Konu–çevre ilişkisi: konunun çevresinden nasıl ayrıştığı / çevreyle nasıl ilişkilendiği (YALNIZ görünen; çevre/mekan/kimlik adı değil) */
export const SURROUND_RELATION = ['izole', 'ayrışan', 'bağlam_içinde', 'iç_içe', 'belirsiz'] as const;
/** Görünen çevrenin GENEL türü (kaba kategori; belirli mekan/marka/yer adı yok). Görünmüyorsa veya emin değilse 'belirsiz' */
export const SURROUND_SETTING = ['düz_zemin', 'masa_yüzeyi', 'iç_mekan', 'dış_mekan', 'belirsiz'] as const;
export const PURPOSES = ['ürün', 'atmosfer', 'mekan', 'insan', 'detay', 'arka_plan'] as const;
/** Genel güven (üç kademe) ve alan bazında güven (bilinmeyen için 'belirsiz') */
export const CONFIDENCE = ['düşük', 'orta', 'yüksek'] as const;
export const CONFIDENCE4 = ['düşük', 'orta', 'yüksek', 'belirsiz'] as const;
export const SAFE_QUALITY = ['iyi', 'orta', 'zayıf'] as const;
/** Alan bazında güven/not anahtarları — 26 karar sorusundaki model alanlarıyla birebir (bkz. docs/media-visual-analysis.md) */
export const FIELD_KEYS = ['subject', 'scale', 'context', 'weight', 'negativeSpace', 'focus', 'directions', 'balance', 'color', 'tone', 'lighting', 'density', 'textSafe', 'technical', 'purpose'] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

type E<T extends readonly string[]> = T[number];

/** 0..1, sol-üst orijin, ANALİZ EDİLEN tam kare çerçevesine göre */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisualDecision {
  /** box === null: kutu BİLİNMİYOR (uydurulmaz); konum/alan/kırpım türevleri de bilinmiyor kalır */
  subject: { box: Box | null; boxConfidence: E<typeof CONFIDENCE4>; scale: E<typeof SCALES> };
  /** Konu–çevre ilişkisinin niteliği (model gözlemi). Eski kayıtlarda (v2-) alan YOKTUR ve uydurulmaz. */
  surroundings: { relation: E<typeof SURROUND_RELATION>; setting: E<typeof SURROUND_SETTING> };
  weight: { direction: E<typeof WEIGHT_DIRECTIONS>; reasons: Array<E<typeof WEIGHT_REASONS>> };
  /** regions: boş alan bölgeleri (model kutu tahmini; oran bunlardan KOD ile hesaplanır) */
  negativeSpace: { zone: E<typeof NEG_ZONES>; amount: E<typeof NEG_AMOUNTS>; regions: Box[] };
  focus: { competition: E<typeof COMPETITION>; competingElements: string[] };
  directions: { gaze: E<typeof GAZE_MOTION>; motion: E<typeof GAZE_MOTION>; leadingLines: E<typeof LEADING_LINES> };
  balance: E<typeof BALANCE>;
  color: { main: string; accents: string[]; attention: string; temperature: E<typeof TEMPERATURE> };
  tone: { light: E<typeof LIGHT>; contrast: E<typeof CONTRAST>; detail: E<typeof DETAIL>; subjectSeparation: E<typeof SEPARATION> };
  lighting: { direction: E<typeof LIGHT_DIRECTIONS>; brightZone: E<typeof LIGHT_ZONES>; darkZone: E<typeof LIGHT_ZONES>; blownHighlights: E<typeof PRESENCE>; crushedShadows: E<typeof PRESENCE> };
  density: E<typeof CROWD>;
  textSafe: Array<{ box: Box; quality: E<typeof SAFE_QUALITY> }>;
  technical: { sharpness: E<typeof SHARPNESS>; exposure: E<typeof EXPOSURE>; noise: E<typeof LEVEL4>; compression: E<typeof LEVEL4>; issues: string[] };
  purpose: Array<E<typeof PURPOSES>>;
  confidence: E<typeof CONFIDENCE>;
  /** Alan bazında güven (model beyanı); 'belirsiz' = model güveni de bilmiyor */
  fieldConfidence: Record<FieldKey, E<typeof CONFIDENCE4>>;
  /** Alan bazında kısa belirsizlik/kanıt notu (ör. hareket yönünün kanıtı) */
  fieldNotes: Array<{ field: FieldKey; note: string }>;
  uncertainties: string[];
}

// ── Türetilmiş (kod) değerler ve kaynakları ──

export type DerivedSource = 'code' | 'pixels' | 'model' | 'unknown';
/** value === null → bilinmiyor (source 'unknown'). basis: değerin hangi girdiden hesaplandığı (kısa Türkçe) */
export interface Derived<T> {
  value: T | null;
  source: DerivedSource;
  basis: string;
}
export const unknownDerived = <T,>(why: string): Derived<T> => ({ value: null, source: 'unknown', basis: why });

// ── Kutu geometrisi (KOD hesabı; girdi modelin kutu tahmini) ──

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const boxCenter = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const boxArea = (b: Box) => b.w * b.h;

export function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const t = Math.min(a.y + a.h, b.y + b.h);
  return r > x && t > y ? { x, y, w: r - x, h: t - y } : null;
}

const COL = ['sol', 'orta', 'sağ'] as const;
const ROW = ['üst', 'orta', 'alt'] as const;
/** 3×3 ızgarada kutu merkezinin bulunduğu hücre ("sol üst", "orta"…) */
export function gridCell(b: Box): { col: 0 | 1 | 2; row: 0 | 1 | 2; label: string } {
  const c = boxCenter(b);
  const col = Math.min(2, Math.floor(clamp(c.x, 0, 0.9999) * 3)) as 0 | 1 | 2;
  const row = Math.min(2, Math.floor(clamp(c.y, 0, 0.9999) * 3)) as 0 | 1 | 2;
  const label = col === 1 && row === 1 ? 'orta' : col === 1 ? ROW[row] : row === 1 ? COL[col] : `${COL[col]} ${ROW[row]}`;
  return { col, row, label };
}

/** Ana obje konumu ve kapladığı alan (kod; kutu bilinmiyorsa bilinmiyor) */
export function subjectGeometry(v: VisualDecision): { cell: Derived<string>; areaShare: Derived<number> } {
  const b = v.subject.box;
  if (!b) return { cell: unknownDerived('konu kutusu bilinmiyor'), areaShare: unknownDerived('konu kutusu bilinmiyor') };
  return {
    cell: { value: gridCell(b).label, source: 'code', basis: 'modelin kutu tahmininden' },
    areaShare: { value: boxArea(b), source: 'code', basis: 'modelin kutu tahmininden' },
  };
}

/**
 * Negatif alan oranı: tarayıcıda ölçülen piksel oranı VARSA o ('pixels'); yoksa modelin boş alan bölgelerinden kod ile
 * (birleşim alanı, 40×40 örnekleme; 'code'); ikisi de yoksa bilinmiyor. Modelin 'amount' bandı oran DEĞİLDİR, burada kullanılmaz.
 */
export function negativeSpaceRatio(v: VisualDecision | null, pixelRatio?: number | null): Derived<number> {
  if (typeof pixelRatio === 'number' && Number.isFinite(pixelRatio) && pixelRatio >= 0 && pixelRatio <= 1) return { value: pixelRatio, source: 'pixels', basis: 'piksel ölçümü (düz blok oranı)' };
  const regions = v?.negativeSpace.regions ?? [];
  if (!regions.length) return unknownDerived(v && v.negativeSpace.amount === 'yok' ? 'model boş alan yok dedi; bölge verilmedi (oran ölçülmedi)' : 'boş alan bölgesi/piksel ölçümü yok');
  const N = 40;
  let hit = 0;
  for (let i = 0; i < N; i++) {
    const y = (i + 0.5) / N;
    for (let j = 0; j < N; j++) {
      const x = (j + 0.5) / N;
      if (regions.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) hit++;
    }
  }
  return { value: hit / (N * N), source: 'code', basis: 'modelin boş alan bölgesi tahminlerinden' };
}

/** Kaynak çerçevesinde (normalize) kırpım penceresi; studio/feedPlanner/crop.cropRect ile aynı formül, yuvarlama yok */
export function cropWindow(dims: { w: number; h: number }, ratio: number, focus: { x: number; y: number }, zoom = 1): Box {
  const z = Math.max(1, zoom);
  const sr = dims.w / dims.h;
  let bw: number;
  let bh: number;
  if (sr > ratio) {
    bh = dims.h;
    bw = dims.h * ratio;
  } else {
    bw = dims.w;
    bh = dims.w / ratio;
  }
  const w = bw / z / dims.w;
  const h = bh / z / dims.h;
  const x = clamp(clamp(focus.x, 0, 1) - w / 2, 0, 1 - w);
  const y = clamp(clamp(focus.y, 0, 1) - h / 2, 0, 1 - h);
  return { x, y, w, h };
}

/**
 * Platform güvenli kenarları (kırpım çerçevesine göre oran). Story/Reels kapağı için üst/alt ≈ 250/1920 px ≈ %13: YALNIZ üçüncü taraf
 * kılavuzlara dayanan VARSAYIMDIR; Meta'nın resmi belgesiyle DOĞRULANMADI (`verified:false`). Feed için kenar payı tanımlı değildir.
 */
export interface SafeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export const NO_INSETS: SafeInsets = { top: 0, bottom: 0, left: 0, right: 0 };
export const PLATFORM_SAFE = {
  story: { insets: { top: 0.13, bottom: 0.13, left: 0, right: 0 } as SafeInsets, verified: false, basis: 'üçüncü taraf kılavuzlar (~250/1920 px); Meta resmi belgesiyle doğrulanmadı' },
  'reels-cover': { insets: { top: 0.13, bottom: 0.13, left: 0, right: 0 } as SafeInsets, verified: false, basis: 'Story ile aynı varsayım; doğrulanmadı' },
  feed: { insets: NO_INSETS, verified: false, basis: 'feed için kenar payı tanımlı değil' },
} as const;
export function platformInsets(format: string): SafeInsets {
  if (format === 'story') return PLATFORM_SAFE.story.insets;
  if (format === 'reels-cover') return PLATFORM_SAFE['reels-cover'].insets;
  return PLATFORM_SAFE.feed.insets;
}

export type SubjectCropStatus = 'korunur' | 'kenarda' | 'kısmen_kesilir' | 'kesilir' | 'bilinmiyor';

export interface CropEvaluation {
  window: Box;
  subject: {
    status: SubjectCropStatus;
    /** Konu alanının pencerede kalan kesri (0..1); kutu bilinmiyorsa null */
    insideShare: number | null;
    /** Konu merkezinin KIRPIM çerçevesindeki konumu (0..1); konu tamamen dışındaysa veya kutu bilinmiyorsa null */
    centerInCrop: { x: number; y: number } | null;
    /** Konunun kırpımda görünen alanının kırpım alanına oranı; bilinmiyorsa null */
    areaShareInCrop: number | null;
  };
  /** Konu merkezinin kırpımdaki konumu − kaynaktaki konumu (ağırlık kayması göstergesi); bilinmiyorsa null */
  weightShift: { dx: number; dy: number } | null;
  textSafe: Array<{
    box: Box;
    /** Alanın kırpımda görünen kesri */
    visibleShare: number;
    /** Görünen kısmın platform güvenli kenarları İÇİNDE kalan kesri (kenar tanımı yoksa 1) */
    safeShare: number;
    /** Konuyla çakışıyor mu; konu kutusu bilinmiyorsa null (bilinmiyor) */
    overlapsSubject: boolean | null;
    quality: E<typeof SAFE_QUALITY>;
  }>;
}

const toCrop = (b: Box, win: Box): Box => ({ x: (b.x - win.x) / win.w, y: (b.y - win.y) / win.h, w: b.w / win.w, h: b.h / win.h });

/** Modelin kutu tahminini verilen kırpıma uygular. Saf ve deterministik: görsel/ağ çağrısı yok. */
export function evaluateCrop(v: VisualDecision, dims: { w: number; h: number }, ratio: number, focus: { x: number; y: number }, zoom = 1, insets: SafeInsets = NO_INSETS): CropEvaluation {
  const win = cropWindow(dims, ratio, focus, zoom);
  const s = v.subject.box;
  const safeRect: Box = { x: insets.left, y: insets.top, w: 1 - insets.left - insets.right, h: 1 - insets.top - insets.bottom };
  const textSafe = v.textSafe.map((t) => {
    const ti = intersect(t.box, win);
    const inCrop = ti ? toCrop(ti, win) : null;
    const safe = inCrop ? intersect(inCrop, safeRect) : null;
    let overlap: boolean | null = null;
    if (s) {
      const o = ti ? intersect(ti, s) : null;
      overlap = !!ti && !!o && boxArea(o) / Math.max(boxArea(ti), 1e-9) > 0.2;
    }
    return {
      box: inCrop ?? { x: 0, y: 0, w: 0, h: 0 },
      visibleShare: ti ? boxArea(ti) / Math.max(boxArea(t.box), 1e-9) : 0,
      safeShare: inCrop && safe ? boxArea(safe) / Math.max(boxArea(inCrop), 1e-9) : 0,
      overlapsSubject: overlap,
      quality: t.quality,
    };
  });
  if (!s) {
    return { window: win, subject: { status: 'bilinmiyor', insideShare: null, centerInCrop: null, areaShareInCrop: null }, weightShift: null, textSafe };
  }
  const inter = intersect(s, win);
  const insideShare = inter ? boxArea(inter) / Math.max(boxArea(s), 1e-9) : 0;
  const sc = toCrop(s, win);
  let status: SubjectCropStatus;
  if (insideShare >= 0.98) {
    const margin = Math.min(sc.x, sc.y, 1 - (sc.x + sc.w), 1 - (sc.y + sc.h));
    status = margin < 0.03 ? 'kenarda' : 'korunur';
  } else status = insideShare >= 0.7 ? 'kısmen_kesilir' : 'kesilir';
  const c0 = boxCenter(s);
  const centerInCrop = inter ? boxCenter(toCrop(inter, win)) : null;
  const weightShift = centerInCrop ? { dx: centerInCrop.x - c0.x, dy: centerInCrop.y - c0.y } : null;
  return { window: win, subject: { status, insideShare, centerInCrop, areaShareInCrop: inter ? boxArea(toCrop(inter, win)) : 0 }, weightShift, textSafe };
}

/** Konu merkezine odaklı kırpım odağı (kod hesabı; kırpımda konunun korunmasını önceler). Kutu bilinmiyorsa null (merkez UYDURULMAZ). */
export function subjectFocus(v: VisualDecision | null | undefined): { x: number; y: number } | null {
  if (!v || !v.subject.box) return null;
  const c = boxCenter(v.subject.box);
  return { x: clamp(c.x, 0, 1), y: clamp(c.y, 0, 1) };
}

/**
 * Kırpım sonrası çıkarılabilen çözünürlük kanıtı (KOD): kırpılan pencerenin kaynak pikseli ile hedef boyut. oran < 1 → hedefe büyütme
 * gerekir (kalite riski). Kaynak boyutu bilinmiyorsa çağrılmaz.
 */
export const TARGET_PX: Record<string, { w: number; h: number }> = { 'feed-1x1': { w: 1080, h: 1080 }, 'feed-4x5': { w: 1080, h: 1350 }, 'reels-cover': { w: 1080, h: 1920 }, story: { w: 1080, h: 1920 } };
export function cropResolution(dims: { w: number; h: number }, window: Box, format: string): { sourcePx: { w: number; h: number }; targetPx: { w: number; h: number }; scale: number } | null {
  const t = TARGET_PX[format];
  if (!t) return null;
  const sw = window.w * dims.w;
  const sh = window.h * dims.h;
  return { sourcePx: { w: Math.round(sw), h: Math.round(sh) }, targetPx: t, scale: Math.min(sw / t.w, sh / t.h) };
}

/**
 * Kırpımda GÖRÜNÜR olgular (kod; sunucuda ve istemcide aynı hesap). Orijinal analiz tam kare içindir; kırpım karenin bir kısmını gösteriyorsa
 * yalnız konusu kutusu kırpım içinde (korunur/kenarda) doğrulanan ANA KONU görünür sayılır. Kırpım dışında kalan veya görünürlüğü
 * doğrulanamayan (kutu bilinmiyor / güven belirsiz / kısmen kesik) hiçbir ayrıntı caption için "görünen gerçek" sayılamaz.
 *  - tam          : kırpım karenin TAMAMINI gösteriyor (pencere alanı = 1; yalnız sayısal tolerans) → katalog olguları görünür; kesilen en dar kenar bile tam kare DEĞİLDİR
 *  - yalnız_konu  : kırpılmış ve ana konu kırpımda tam görünür → yalnız ana konu; nesne/açıklama/etiket görünürlüğü DOĞRULANMADI
 *  - yok          : kırpılmış ve ana konu kısmen/tamamen dışarıda veya bilinmiyor → görünür olgu YOK
 */
export interface CropVisibility {
  cropped: boolean;
  /** pencere alanı / kaynak alanı */
  windowShare: number;
  subject: 'visible' | 'partial' | 'outside' | 'unknown';
  facts: 'tam' | 'yalnız_konu' | 'yok';
}
/** Yalnız sayısal tolerans (kayan nokta): pencere kareyi GERÇEKTEN tam kaplıyorsa tam kare. %2 gibi kesilen kenar tam kare SAYILMAZ. */
export const FULL_FRAME_EPS = 1e-6;
export function cropVisibility(v: VisualDecision | null | undefined, dims: { w: number; h: number }, ratio: number, focus: { x: number; y: number }, zoom = 1): CropVisibility {
  const win = cropWindow(dims, ratio, focus, zoom);
  const share = win.w * win.h;
  const cropped = share < 1 - FULL_FRAME_EPS;
  if (!cropped) return { cropped: false, windowShare: share, subject: 'visible', facts: 'tam' };
  if (!v || !v.subject.box || v.subject.boxConfidence === 'belirsiz') return { cropped: true, windowShare: share, subject: 'unknown', facts: 'yok' };
  const ev = evaluateCrop(v, dims, ratio, focus, zoom);
  const st = ev.subject.status;
  if (st === 'korunur' || st === 'kenarda') return { cropped: true, windowShare: share, subject: 'visible', facts: 'yalnız_konu' };
  return { cropped: true, windowShare: share, subject: st === 'kısmen_kesilir' ? 'partial' : st === 'kesilir' ? 'outside' : 'unknown', facts: 'yok' };
}

export type Lean = 'sol' | 'sağ' | 'merkez';
export type VLean = 'üst' | 'alt' | 'merkez';

/**
 * Kırpımdan SONRAKİ etkin görsel AĞIRLIK yönü. Yalnız modelin bildirdiği yön bilinen eksenlerde (null = bilinmiyor) kullanılır;
 * 'belirsiz' ASLA merkeze çevrilmez. Konu merkezi kırpımda belirgin (>0.12) kaydıysa (kutu bilinirse) yön konumdan yeniden okunur
 * ve `shifted` işaretlenir. Konum eğilimi (kutudan) ayrı `positionLean` ile verilir.
 */
export function effectiveLean(v: VisualDecision, ev: CropEvaluation): { h: Lean | null; v: VLean | null; shifted: boolean } {
  const d = v.weight.direction;
  let h: Lean | null = d === 'sol' ? 'sol' : d === 'sağ' ? 'sağ' : d === 'merkez' || d === 'dengeli' ? 'merkez' : null;
  let vv: VLean | null = d === 'üst' ? 'üst' : d === 'alt' ? 'alt' : d === 'merkez' || d === 'dengeli' ? 'merkez' : null;
  const ci = ev.subject.centerInCrop;
  let shifted = false;
  if (ci && ev.weightShift) {
    if (h !== null && Math.abs(ev.weightShift.dx) > 0.12) {
      shifted = true;
      h = ci.x < 0.4 ? 'sol' : ci.x > 0.6 ? 'sağ' : 'merkez';
    }
    if (vv !== null && Math.abs(ev.weightShift.dy) > 0.12) {
      shifted = true;
      vv = ci.y < 0.4 ? 'üst' : ci.y > 0.6 ? 'alt' : 'merkez';
    }
  }
  return { h, v: vv, shifted };
}

/** Konunun kırpım çerçevesindeki KONUM eğilimi (kod; ağırlık değildir). Kutu/konum bilinmiyorsa null. */
export function positionLean(ev: CropEvaluation): { h: Lean; v: VLean } | null {
  const c = ev.subject.centerInCrop;
  if (!c) return null;
  return { h: c.x < 0.4 ? 'sol' : c.x > 0.6 ? 'sağ' : 'merkez', v: c.y < 0.4 ? 'üst' : c.y > 0.6 ? 'alt' : 'merkez' };
}

/**
 * Yazı için en iyi güvenli alan: kırpımda görünen pay × platform güvenli kenarları içinde kalan pay × kalite × (konuyla çakışma cezası).
 * Çakışma bilgisi yoksa (kutu bilinmiyor) ceza uygulanmaz ve `overlapKnown:false` döner.
 */
export function bestTextZone(ev: CropEvaluation): { score: number; box: Box; overlapKnown: boolean } | null {
  let best: { score: number; box: Box; overlapKnown: boolean } | null = null;
  for (const t of ev.textSafe) {
    if (t.visibleShare < 0.6 || t.safeShare < 0.6) continue;
    const q = t.quality === 'iyi' ? 1 : t.quality === 'orta' ? 0.6 : 0.25;
    const score = q * t.visibleShare * t.safeShare * (t.overlapsSubject ? 0.4 : 1);
    if (!best || score > best.score) best = { score, box: t.box, overlapKnown: t.overlapsSubject !== null };
  }
  return best;
}

// ── Aday tarafı taşıyıcı ──

/** Analiz kaydının kimliği: önbellek/kapsam denetimi için istemciye taşınır */
export interface VisualProvenance {
  tenantId: string;
  projectId: string;
  assetId: string;
  analysisKey: string;
  /** Kaynak içeriği sürümü (SHA-256) */
  sourceSha256: string;
  /** Kaydın güncellenme zamanı (ms): eski yanıtın yeni veriyi geri almasını önlemek için sıralama */
  analyzedAt: number;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  visualSchemaVersion: string;
  visualPromptVersion: string;
  sourceQuality: string;
  /** original: kutu, asıl boyut oranıyla aynı çerçevede. studio_preview: oran AYNI VARSAYILIR (doğrulanamadı) */
  geometryBasis: 'original' | 'preview_assumed_same_aspect';
}

export interface CandidateVisual {
  decision: VisualDecision;
  provenance: VisualProvenance;
}

/**
 * İstemci önbelleği anahtarı: tenant+proje+varlık+analiz anahtarı+kaynak sürümü(SHA)+model+istem/şema sürümleri+kaynak kalitesi+
 * kaynak boyutu+format+odak+yakınlaştırma. Bileşenlerden biri değişince anahtar değişir.
 */
export function cropCacheKey(p: VisualProvenance, format: string, focus: { x: number; y: number }, zoom = 1, dims?: { w: number; h: number }): string {
  const f = (n: number) => n.toFixed(3);
  return [
    p.tenantId, p.projectId, p.assetId, p.analysisKey, p.sourceSha256, p.model, p.promptVersion, p.schemaVersion, p.visualSchemaVersion, p.visualPromptVersion, p.sourceQuality,
    dims ? `${dims.w}x${dims.h}` : 'dims?', format, f(focus.x), f(focus.y), f(zoom),
  ].join('|');
}

export class CropEvalCache {
  private m = new Map<string, CropEvaluation>();
  /** Varlık başına görülen en yeni analiz: eski (daha önce üretilmiş) bir yanıt yenisini GERİ ALAMAZ ve önbelleğe yazılamaz */
  private latest = new Map<string, { key: string; at: number }>();
  private tenant: string | null;
  /**
   * tenantId verilirse (tercih edilen) yalnız o tenant. Verilmezse, proje denetimi GEÇEN ilk analizin tenant'ı benimsenir;
   * proje uyuşmayan kayıt hiçbir durumda tenant'ı belirlemez (önbellek zehirlenmez).
   */
  constructor(private scope: { tenantId?: string; projectId: string }) {
    this.tenant = scope.tenantId ?? null;
  }
  get size() {
    return this.m.size;
  }
  eval(v: CandidateVisual, dims: { w: number; h: number }, format: string, ratio: number, focus: { x: number; y: number }, zoom = 1): CropEvaluation | null {
    const p = v.provenance;
    // 1) Kapsam: ÖNCE doğrula, sonra (gerekirse) benimse. Reddedilen kayıt hiçbir durumu DEĞİŞTİRMEZ.
    if (p.projectId !== this.scope.projectId) return null;
    if (this.tenant !== null && p.tenantId !== this.tenant) return null;
    if (p.visualSchemaVersion !== VISUAL_SCHEMA_VERSION) return null;
    // 2) Sürüm sırası: daha eski analiz, bilinen daha yeni olanın yerine geçemez
    const assetKey = `${p.tenantId}|${p.projectId}|${p.assetId}`;
    const known = this.latest.get(assetKey);
    if (known && known.key !== p.analysisKey && p.analyzedAt <= known.at) return null;
    // 3) Kabul: tenant benimse, yeni analizse eski girdileri at
    if (this.tenant === null) this.tenant = p.tenantId;
    if (!known || known.key !== p.analysisKey) {
      if (known) for (const k of [...this.m.keys()]) if (k.startsWith(`${assetKey}|${known.key}|`)) this.m.delete(k);
      this.latest.set(assetKey, { key: p.analysisKey, at: p.analyzedAt });
    }
    const key = cropCacheKey(p, format, focus, zoom, dims);
    let hit = this.m.get(key);
    if (!hit) {
      hit = evaluateCrop(v.decision, dims, ratio, focus, zoom, platformInsets(format));
      this.m.set(key, hit);
    }
    return hit;
  }
}
