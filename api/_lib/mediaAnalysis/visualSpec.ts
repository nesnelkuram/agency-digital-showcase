/**
 * Görsel karar (kompozisyon) çıktı şeması, istemi ve doğrulaması. Tek model çağrısı İKİ ayrı alan döndürür:
 *  - catalog : gerçek konu/nesne/kimlik belirsizliği (ImageCatalogSchema, spec.ts)
 *  - visual  : kompozisyon kararı (burada). Kayıtta AYRI saklanır ve AYRI sürümlenir (VISUAL_SCHEMA_VERSION).
 * Strict JSON Schema sınırlarına uymak için sayı aralıkları şemada YOK; kutu aralıkları model çıktısından SONRA kodla
 * doğrulanır. Geçersiz kutu = görsel karar yok (kutu uydurulmaz/kırpılıp "düzeltilmez"); katalog yine saklanır.
 */
import { z } from 'zod/v4';
import {
  BALANCE, COMPETITION, CONFIDENCE, CONFIDENCE4, CONTRAST, CROWD, DETAIL, EXPOSURE, FIELD_KEYS, GAZE_MOTION, LEADING_LINES, LEVEL4, LIGHT, LIGHT_DIRECTIONS,
  LIGHT_ZONES, NEG_AMOUNTS, NEG_ZONES, PRESENCE, PURPOSES, SAFE_QUALITY, SCALES, SEPARATION, SHARPNESS, SURROUND_RELATION, SURROUND_SETTING, TEMPERATURE, WEIGHT_DIRECTIONS, WEIGHT_REASONS,
  type Box, type VisualDecision,
} from '../../../shared/planner/visualDecision.js';
import { ImageCatalogSchema, type ImageCatalog } from './spec.js';

const BoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const Conf4 = z.enum(CONFIDENCE4);

export const VisualDecisionSchema = z.object({
  subject: z.object({
    box: BoxSchema.nullable().describe('Ana konunun sınır kutusu: 0-1, sol-üst orijin, TÜM kare çerçevesine göre (tahmin). Konuyu net sınırlayamıyorsan null (BİLİNMİYOR); koordinat uydurma'),
    boxConfidence: Conf4,
    scale: z.enum(SCALES).describe('Konunun kadrajdaki ölçeği: yakın/orta/geniş'),
  }),
  surroundings: z.object({
    relation: z.enum(SURROUND_RELATION).describe('Konunun çevresinden ayrışma niteliği: izole (temiz/sade zemin), ayrışan (net ayrışan arka plan), bağlam_içinde (çevre konuyu açıklıyor), iç_içe (konu çevreyle karışıyor); emin değilsen belirsiz'),
    setting: z.enum(SURROUND_SETTING).describe('Görünen çevrenin GENEL türü; belirli mekan/marka/yer adı verme; görünmüyorsa belirsiz'),
  }),
  weight: z.object({
    direction: z.enum(WEIGHT_DIRECTIONS).describe('Görsel ağırlığın çekildiği yön'),
    reasons: z.array(z.enum(WEIGHT_REASONS)).describe('Ağırlığın nedenleri (en fazla 4)'),
  }),
  negativeSpace: z.object({
    zone: z.enum(NEG_ZONES),
    amount: z.enum(NEG_AMOUNTS),
    regions: z.array(BoxSchema).describe('Boş (düz, sakin) alan bölgeleri (en fazla 3; yoksa veya emin değilsen boş liste). Oran bunlardan kodla hesaplanır'),
  }),
  focus: z.object({
    competition: z.enum(COMPETITION).describe('Birden çok odak noktası göz için yarışıyor mu'),
    competingElements: z.array(z.string()).describe('Ana konuyla rekabet eden unsurlar (kısa ad, en fazla 3; yoksa boş)'),
  }),
  directions: z.object({ gaze: z.enum(GAZE_MOTION), motion: z.enum(GAZE_MOTION), leadingLines: z.enum(LEADING_LINES) }),
  balance: z.enum(BALANCE),
  color: z.object({
    main: z.string().describe('En çok alan kaplayan renk adı (Türkçe, kısa); hex yazma'),
    accents: z.array(z.string()).describe('Vurgu renk adları (en fazla 3)'),
    attention: z.string().describe('Dikkati en çok çeken renk adı; ayırt edilemiyorsa "belirsiz"'),
    temperature: z.enum(TEMPERATURE),
  }),
  tone: z.object({
    light: z.enum(LIGHT),
    contrast: z.enum(CONTRAST),
    detail: z.enum(DETAIL),
    subjectSeparation: z.enum(SEPARATION).describe('Konu arka plandan kontrastla ne kadar ayrışıyor'),
  }),
  lighting: z.object({
    direction: z.enum(LIGHT_DIRECTIONS).describe('Işığın geldiği yön'),
    brightZone: z.enum(LIGHT_ZONES).describe('En aydınlık bölge'),
    darkZone: z.enum(LIGHT_ZONES).describe('En karanlık bölge'),
    blownHighlights: z.enum(PRESENCE).describe('Patlamış (detay kaybolmuş) parlak bölge var mı'),
    crushedShadows: z.enum(PRESENCE).describe('Ezilmiş (detay kaybolmuş) koyu bölge var mı'),
  }),
  density: z.enum(CROWD).describe('Kompozisyon sakin mi kalabalık mı'),
  textSafe: z.array(z.object({ box: BoxSchema, quality: z.enum(SAFE_QUALITY) })).describe('Üzerine yazı konabilecek alanlar (en fazla 3; yoksa boş)'),
  technical: z.object({
    sharpness: z.enum(SHARPNESS),
    exposure: z.enum(EXPOSURE),
    noise: z.enum(LEVEL4),
    compression: z.enum(LEVEL4).describe('Sıkıştırma artefaktı (blok, halka)'),
    issues: z.array(z.string()).describe('Diğer teknik kalite sorunları (kısa)'),
  }),
  purpose: z.array(z.enum(PURPOSES)).describe('Görselin içerik amacına uygunluğu'),
  confidence: z.enum(CONFIDENCE),
  fieldConfidence: z.object({
    subject: Conf4, scale: Conf4, context: Conf4, weight: Conf4, negativeSpace: Conf4, focus: Conf4, directions: Conf4, balance: Conf4, color: Conf4, tone: Conf4,
    lighting: Conf4, density: Conf4, textSafe: Conf4, technical: Conf4, purpose: Conf4,
  }).describe('Alan bazında güven; bilmiyorsan "belirsiz"'),
  fieldNotes: z.array(z.object({ field: z.enum(FIELD_KEYS), note: z.string() })).describe('Alan bazında kısa belirsizlik/kanıt notu (ör. hareket yönünün kanıtı); en fazla 10'),
  uncertainties: z.array(z.string()).describe('Emin olunamayan genel kompozisyon noktaları'),
});

/** Modelin tek yanıtı: iki AYRI alan */
export const AnalysisOutputSchema = z.object({ catalog: ImageCatalogSchema, visual: VisualDecisionSchema });
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

export const VISUAL_SYSTEM_PROMPT = [
  'Ek görev: kompozisyon kararı ("visual" alanı). Bu bölüm ANLAMSAL YARGI ve KUTU TAHMİNİDİR; kesin ölçüm değildir.',
  '- Bilmediğin veya göremediğin her alanda "belirsiz" seç; tahmin yürütme, uydurma. Bilinmeyeni başka bir değere (ör. "merkez", "dengeli") ÇEVİRME. Alan bazında güveni fieldConfidence ile, kanıtı/belirsizliği fieldNotes ile bildir.',
  '- Kutular (subject.box, negativeSpace.regions[], textSafe[].box): 0 ile 1 arası, sol-üst köşe orijin, TÜM görüntü çerçevesine göre; x+w ≤ 1 ve y+h ≤ 1. Piksel yazma. Ana konuyu net sınırlayamıyorsan subject.box = null ve boxConfidence = "belirsiz" (koordinat uydurma).',
  '- negativeSpace.regions: yalnız gerçekten düz ve sakin bölgeler (en fazla 3); emin değilsen boş liste. Oranı SEN yazma; kodla hesaplanır.',
  '- textSafe: üzerine metin konduğunda ana konuyu kapatmayan, düz ve sakin alanlar; en fazla 3, yoksa boş liste.',
  '- Renkleri yalnız kısa Türkçe ad ile ver (hex veya sayı yok). Sayısal renk/parlaklık ölçümü kod tarafında yapılır.',
  '- weight.direction: göz önce nereye gidiyor (büyük/koyu/parlak/doygun/yüksek kontrastlı/insan/yazı). Nedenleri en fazla 4 seç.',
  '- lighting: ışığın yönü, en aydınlık/karanlık bölge, patlamış/ezilmiş bölge var mı; göremiyorsan "belirsiz". Hareket ve bakış yönünü yalnız açıkça görünen kanıt varsa ver (kanıtı fieldNotes alanına yaz).',
  '- surroundings: konu–çevre ilişkisini YALNIZ görüntüde açıkça görünenden belirle (izole/ayrışan/bağlam_içinde/iç_içe) ve çevrenin genel türünü ver. Mekan, işletme, şehir, marka veya kişi adı/kimliği ÇIKARMA; çevre görünmüyor veya belirsizse "belirsiz" seç ve fieldNotes (context) alanına nedenini yaz.',
  '- Pazarlama dili, caption veya ürün adı yazma; "catalog" alanındaki kurallar burada da geçerlidir (kimlik tahmini yok).',
].join('\n');

export const ANALYSIS_USER_PROMPT = 'Bu görseli şemaya göre katalogla (catalog) ve kompozisyon kararını ver (visual).';

const okUnit = (n: number) => Number.isFinite(n) && n >= -0.001 && n <= 1.001;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const MIN_SIDE = 0.02;

/** Kutu aralık doğrulaması; küçük taşmalar (≤0.001) 0..1'e yuvarlanır, anlamlı taşma/geçersiz kutu null döner */
export function checkBox(b: Box): Box | null {
  if (![b.x, b.y, b.w, b.h].every(okUnit)) return null;
  const x = clamp01(b.x);
  const y = clamp01(b.y);
  const w = clamp01(b.w);
  const h = clamp01(b.h);
  if (w < MIN_SIDE || h < MIN_SIDE) return null;
  if (x + w > 1.002 || y + h > 1.002) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

const short = (v: string, n: number) => v.replace(/\s+/g, ' ').trim().slice(0, n);
const uniq = <T,>(a: T[], n: number) => [...new Set(a)].slice(0, n);

/**
 * ok     : tüm geometri geçerli.
 * partial: kutu BİLİNMİYOR (model null verdi veya kutu geçersizdi → null'a çevrildi) ve/veya bazı bölge/yazı alanı düşürüldü.
 *          Diğer geçerli alanlar KAYBOLMAZ; geometri UYDURULMAZ.
 */
export type VisualCheck = { ok: true; visual: VisualDecision; status: 'ok' | 'partial'; issues: string[] } | { ok: false; issue: string };

/** Zod'dan geçmiş görsel kararı kodla doğrular ve normalleştirir. Geçersiz kutu = bilinmiyor (null); gerisi korunur. */
export function validateVisual(v: z.infer<typeof VisualDecisionSchema>): VisualCheck {
  const issues: string[] = [];
  let box: Box | null = null;
  let boxConfidence = v.subject.boxConfidence;
  if (v.subject.box === null) issues.push('konu_kutusu_bilinmiyor');
  else {
    box = checkBox(v.subject.box);
    if (!box) {
      issues.push('konu_kutusu_geçersiz_bilinmiyor_sayıldı');
      boxConfidence = 'belirsiz';
    }
  }
  const regionsRaw = v.negativeSpace.regions.map((r) => checkBox(r));
  const regions = regionsRaw.filter((r): r is Box => !!r).slice(0, 3);
  if (regionsRaw.length !== regions.length) issues.push(`boş_alan_bölgesi_düşürüldü:${regionsRaw.length - regions.length}`);
  const safe = v.textSafe.map((t) => ({ box: checkBox(t.box), quality: t.quality }));
  const textSafe = safe.filter((t): t is { box: Box; quality: (typeof SAFE_QUALITY)[number] } => !!t.box).slice(0, 3);
  if (safe.length !== textSafe.length) issues.push(`yazı_alanı_düşürüldü:${safe.length - textSafe.length}`);
  const visual: VisualDecision = {
    ...v,
    subject: { box, boxConfidence, scale: v.subject.scale },
    weight: { direction: v.weight.direction, reasons: uniq(v.weight.reasons, 4) },
    negativeSpace: { zone: v.negativeSpace.zone, amount: v.negativeSpace.amount, regions },
    focus: { competition: v.focus.competition, competingElements: uniq(v.focus.competingElements.map((s) => short(s, 60)).filter(Boolean), 3) },
    color: { main: short(v.color.main, 40), accents: uniq(v.color.accents.map((a) => short(a, 40)).filter(Boolean), 3), attention: short(v.color.attention, 40), temperature: v.color.temperature },
    textSafe,
    technical: { ...v.technical, issues: uniq(v.technical.issues.map((s) => short(s, 120)).filter(Boolean), 6) },
    purpose: uniq(v.purpose, 6),
    fieldNotes: v.fieldNotes.map((n) => ({ field: n.field, note: short(n.note, 160) })).filter((n) => n.note).slice(0, 10),
    uncertainties: uniq(v.uncertainties.map((s) => short(s, 200)).filter(Boolean), 8),
  };
  return { ok: true, visual, status: issues.length ? 'partial' : 'ok', issues };
}

export type ParsedAnalysis =
  | { ok: true; catalog: ImageCatalog; visual: VisualDecision | null; visualStatus: 'ok' | 'partial' | 'invalid'; visualIssue: string | null }
  | { ok: false; issue: string };

/**
 * Model yanıtını (JSON nesnesi) iki AYRI alana böler ve ayrı doğrular. Katalog geçerli, görsel karar şeması geçersizse katalog
 * saklanır, visual=null + neden döner (kısmi başarı dürüstçe işaretlenir). Kutu geçersiz/bilinmiyorsa görsel karar KORUNUR
 * (visualStatus 'partial'; kutu null). Katalog geçersizse bütün çıktı reddedilir.
 */
export function parseAnalysisOutput(raw: unknown): ParsedAnalysis {
  if (typeof raw !== 'object' || raw === null) return { ok: false, issue: 'çıktı_nesne_değil' };
  const r = raw as Record<string, unknown>;
  const cat = ImageCatalogSchema.safeParse(r.catalog);
  if (!cat.success) return { ok: false, issue: 'katalog_geçersiz' };
  const vis = VisualDecisionSchema.safeParse(r.visual);
  if (!vis.success) return { ok: true, catalog: cat.data, visual: null, visualStatus: 'invalid', visualIssue: 'görsel_karar_şeması_geçersiz' };
  const chk = validateVisual(vis.data);
  if (!chk.ok) return { ok: true, catalog: cat.data, visual: null, visualStatus: 'invalid', visualIssue: chk.issue };
  return { ok: true, catalog: cat.data, visual: chk.visual, visualStatus: chk.status, visualIssue: chk.issues.length ? chk.issues.join(',') : null };
}
