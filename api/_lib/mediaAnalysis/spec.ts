/**
 * Medya görsel kataloglama — şema, prompt, sürümler ve resmi fiyat anlık görüntüsü.
 * Üretim analizi ve model karşılaştırması AYNI şema/prompt'u kullanır.
 *
 * Kaynaklar (okunma 2026-10-10):
 *  - https://platform.claude.com/docs/en/models/haiku-5-5/overview
 *  - https://platform.claude.com/docs/en/models/sonnet-5-5/overview
 *  - https://platform.claude.com/docs/en/build-with-claude/vision (10 MB base64/görsel, 8000x8000 px; JPEG/PNG/GIF/WebP)
 */

import { createHash } from 'crypto';
import { z } from 'zod/v4';
import { VISUAL_PROMPT_VERSION, VISUAL_SCHEMA_VERSION } from '../../../shared/planner/visualDecision.js';

/**
 * v3: OpenRouter üzerinden TEK çağrıda iki ayrı alan — `catalog` (konu/nesne/kimlik belirsizliği; ImageCatalog şema 2) ve
 * `visual` (kompozisyon kararı; shared/planner/visualDecision). Her alan kendi sürümünü kayıtta taşır.
 * v1/v2 kayıtları (doğrudan Anthropic) geçerli kalır ve gösterilir; anahtar sürümü içerdiği için YENİDEN analiz tetiklemez.
 */
export const MEDIA_ANALYSIS_PROMPT_VERSION = 'media-catalog-v3';
export const MEDIA_ANALYSIS_SCHEMA_VERSION = '3';
/** ImageCatalog alan şeması sürümü (v2'den beri değişmedi); görsel karar sürümü shared/planner/visualDecision'da */
export const CATALOG_FIELDS_SCHEMA_VERSION = '2';
export { VISUAL_PROMPT_VERSION, VISUAL_SCHEMA_VERSION };

/**
 * Üretim kataloglama modeli — OpenRouter model kimliği (sağlayıcı/model, noktalı sürüm). Resmi katalogdan (openrouter.ai/api/v1/models,
 * okunma 2026-10-12) doğrulandı: `anthropic/claude-haiku-5.5` ve `anthropic/claude-sonnet-5.5` giriş=[text,image,file],
 * supported_parameters ⊇ [response_format, structured_outputs, max_tokens]. Kullanıcı yalnız bu ikisine izin verdi.
 * Haiku 5.5 'claude-haiku-5-5' (tireli) kimliği OpenRouter'da GEÇERSİZDİR.
 */
export const CATALOG_MODEL = 'anthropic/claude-haiku-5.5';
export const ALLOWED_MEDIA_MODELS = ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5'] as const;
export function resolveMediaModel(env: Record<string, string | undefined> = process.env): { ok: true; model: string } | { ok: false; reason: string } {
  const raw = env.MEDIA_AI_MODEL?.trim();
  if (!raw) return { ok: true, model: CATALOG_MODEL };
  return (ALLOWED_MEDIA_MODELS as readonly string[]).includes(raw)
    ? { ok: true, model: raw }
    : { ok: false, reason: `MEDIA_AI_MODEL geçersiz (izinli: ${ALLOWED_MEDIA_MODELS.join(', ')}). Başka modele sessiz geçiş yapılmaz.` };
}

export const USAGE_SUGGESTIONS = ['feed', 'carousel', 'story', 'reels_kapak', 'ürün_tanıtımı', 'mekan_tanıtımı', 'atmosfer', 'arka_plan'] as const;
export const PRODUCT_IDENTITY_STATUS = ['ürün_yok', 'belirsiz', 'genel_kategori', 'okunaklı_etiket'] as const;

export const ImageCatalogSchema = z.object({
  subject: z.string().describe('Görselin ana konusu, kısa (ör. "masada tatlı tabağı", "mekan iç mekân genel görünüm")'),
  description: z.string().describe('Görselde açıkça görüneni anlatan 1-2 Türkçe cümle'),
  tags: z.array(z.string()).describe('Arama için kısa Türkçe etiketler (küçük harf)'),
  visibleObjects: z.array(z.string()).describe('Açıkça görünen nesneler'),
  foodCategories: z.array(z.string()).describe('Yalnız açıkça görünen yiyecek/içecek için GENEL kategori; yoksa boş'),
  composition: z.object({
    shotType: z.enum(['yakın_çekim', 'orta_plan', 'genel_plan', 'üstten', 'ürün_odaklı', 'mekan', 'diğer']),
    orientation: z.enum(['dikey', 'yatay', 'kare']),
    hasTextOverlay: z.boolean().describe('Görselin üzerinde okunabilir yazı/logo var mı'),
    subjectPlacement: z.enum(['merkez', 'sol', 'sağ', 'üst', 'alt', 'dağınık']).describe('Ana konunun kadrajdaki yeri'),
    negativeSpace: z.boolean().describe('Metin/yazı eklemeye uygun boş alan var mı'),
  }),
  productIdentity: z
    .object({
      status: z.enum(PRODUCT_IDENTITY_STATUS),
      note: z.string().describe('Neden bu durum; okunaklı etiket varsa yalnız görünen yazı. Ürün adı TAHMİN EDİLMEZ'),
    })
    .describe('Ürün kimliği görüntüden belirlenebiliyor mu (eşleştirme yalnız insan onayıyla yapılır)'),
  usageSuggestions: z.array(z.enum(USAGE_SUGGESTIONS)).describe('Görünen kadraja göre uygun kullanım biçimleri'),
  peoplePresent: z.boolean().describe('İnsan görünüyor mu (kimlik, yaş, köken TAHMİN EDİLMEZ)'),
  uncertainties: z.array(z.string()).describe('Emin olunamayan noktalar (ör. "tatlının içeriği görünmüyor")'),
  planningNotes: z.array(z.string()).describe('Sosyal medya planı için görünen olgulara dayalı kısa kullanım notları'),
  overallConfidence: z.enum(['düşük', 'orta', 'yüksek']),
});

export type ImageCatalog = z.infer<typeof ImageCatalogSchema>;

export const CATALOG_SYSTEM_PROMPT = [
  'Bir markanın sosyal medya görsel arşivini kataloglayan dikkatli bir asistansın.',
  'Kurallar:',
  '- Yalnız görüntüde açıkça GÖRÜNEN olguları yaz. Tahmin, varsayım veya pazarlama dili ekleme.',
  '- Ürün, menü kalemi, yemek adı, tarif veya malzeme UYDURMA. Bir yiyecek görünüyorsa yalnız genel kategori ver (ör. "tatlı", "içecek", "ana yemek"); içerik/malzeme emin değilsen "uncertainties" alanına yaz.',
  '- İnsanları tanımlamaya çalışma: isim, yaş, köken, kimlik veya ünlü tahmini yapma. Yalnız insan görünüp görünmediğini belirt.',
  '- Marka, logo veya yazı ancak okunaklıysa ve görselde açıkça varsa an; okunmuyorsa "uncertainties" alanına yaz.',
  '- Etiketler kısa, Türkçe ve küçük harf olsun; en fazla 15.',
  '- planningNotes yalnız görünen olgulara dayansın (ör. "dikey kadraj hikâyeye uygun", "metin alanı boş"); ürün iddiası içermesin.',
  '- productIdentity: hangi ürün/menü kalemi olduğu görüntüden kesin değilse "belirsiz" veya "genel_kategori" seç; yalnız okunaklı ambalaj/etiket yazısı varsa "okunaklı_etiket" ve yalnız o yazıyı not et. Ürün adı uydurma.',
  '- usageSuggestions yalnız kadraja dayansın (ör. dikey ve boş alan → story).',
].join('\n');

export const CATALOG_USER_PROMPT = 'Bu görseli şemaya göre katalogla.';

/** Çıktı sınırlaması (model şemaya uysa da uzunlukları kırp) */
export function normalizeCatalog(c: ImageCatalog): ImageCatalog {
  const s = (v: string, n: number) => v.trim().slice(0, n);
  const arr = (a: string[], n: number, len = 80) => [...new Set(a.map((x) => s(x, len)).filter(Boolean))].slice(0, n);
  return {
    ...c,
    subject: s(c.subject, 120),
    description: s(c.description, 400),
    productIdentity: { status: c.productIdentity.status, note: s(c.productIdentity.note, 200) },
    usageSuggestions: [...new Set(c.usageSuggestions)],
    tags: arr(c.tags.map((t) => t.toLocaleLowerCase('tr')), 15, 40),
    visibleObjects: arr(c.visibleObjects, 20),
    foodCategories: arr(c.foodCategories, 10, 40),
    uncertainties: arr(c.uncertainties, 10, 200),
    planningNotes: arr(c.planningNotes, 8, 200),
  };
}

// ── Fiyat (USD / milyon token) — resmi sayfalardan, 2026-10-10 ──

export interface ModelPricing {
  model: string;
  source: string;
  checkedOn: string;
  /** Giriş token eşiği; aşılırsa "above" fiyatları (Haiku 5.5: 100K) */
  tierThresholdTokens?: number;
  base: { input: number; output: number; cacheWrite5m: number; cacheRead: number };
  above?: { input: number; output: number; cacheWrite5m: number; cacheRead: number };
}

export const PRICING: Record<string, ModelPricing> = {
  'claude-haiku-5-5': {
    model: 'claude-haiku-5-5',
    source: 'https://platform.claude.com/docs/en/models/haiku-5-5/overview',
    checkedOn: '2026-10-10',
    tierThresholdTokens: 100_000,
    base: { input: 0.1, output: 0.5, cacheWrite5m: 0.125, cacheRead: 0.01 },
    above: { input: 0.5, output: 2.5, cacheWrite5m: 0.625, cacheRead: 0.05 },
  },
  'claude-sonnet-5-5': {
    model: 'claude-sonnet-5-5',
    source: 'https://platform.claude.com/docs/en/models/sonnet-5-5/overview',
    checkedOn: '2026-10-10',
    base: { input: 2, output: 10, cacheWrite5m: 2.5, cacheRead: 0.1 },
  },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Gerçek usage'tan USD maliyet (standart, batch değil) */
export function estimateCostUsd(model: string, u: UsageLike): { usd: number; tier: 'base' | 'above'; pricing: ModelPricing } {
  const p = PRICING[model];
  if (!p) throw new Error(`Fiyat bilgisi yok: ${model}`);
  const cw = u.cache_creation_input_tokens || 0;
  const cr = u.cache_read_input_tokens || 0;
  const promptTokens = u.input_tokens + cw + cr;
  const tier = p.tierThresholdTokens && p.above && promptTokens > p.tierThresholdTokens ? 'above' : 'base';
  const r = tier === 'above' ? p.above! : p.base;
  const usd = (u.input_tokens * r.input + u.output_tokens * r.output + cw * r.cacheWrite5m + cr * r.cacheRead) / 1_000_000;
  return { usd: Math.round(usd * 1e8) / 1e8, tier, pricing: p };
}

// ── Kaynak ve tekrar önleme ──

/**
 * Görsel başına base64 sınırı: doğrudan Claude API 10 MB, ama Amazon Bedrock ve Google Cloud 5 MB
 * (https://platform.claude.com/docs/en/build-with-claude/vision, okunma 2026-10-13). OpenRouter modeli bu sağlayıcılardan birine
 * yönlendirebildiği için sınır EN DAR değere göre seçilir: base64 = ⌈ham/3⌉·4 → ham ≤ 3,5 MB ⇒ base64 ≈ 4,67 MB < 5 MB.
 * Daha büyük orijinaller Studio önizlemesine (studio_preview, açıkça işaretli) düşer; önizleme yoksa "desteklenmiyor" der.
 * (Eski değer 7 MB ham ≈ 9,3 MB base64 idi: Bedrock/Vertex'e düşen büyük orijinaller 400 ile reddedilebilir.)
 */
export const ANALYSIS_MAX_RAW_BYTES = 3_500_000;
export const ANALYSIS_MAX_DIMENSION = 8000;
export const ANALYSIS_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type SourceQuality = 'original' | 'derived_resize' | 'studio_preview' | 'canva_preview';

export function analysisKey(p: {
  tenantId: string;
  projectId: string;
  sourceKind: string;
  sourceId: string;
  sourceSha256: string;
  sourceQuality: SourceQuality;
  model: string;
  /** Analiz edilen kırpım. Model tam kareyi görür ('full'); kırpıma özel analiz eklenirse anahtar ayrışır. */
  crop?: string;
}): string {
  return createHash('sha256')
    .update([p.tenantId, p.projectId, p.sourceKind, p.sourceId, p.sourceSha256, p.sourceQuality, p.crop ?? 'full', p.model, MEDIA_ANALYSIS_PROMPT_VERSION, MEDIA_ANALYSIS_SCHEMA_VERSION, VISUAL_PROMPT_VERSION, VISUAL_SCHEMA_VERSION].join('|'))
    .digest('hex')
    .slice(0, 40);
}

// ── İnsan düzeltmesi (otorite) ──

/**
 * İnsan katalog düzeltmesi (onay kapısı DEĞİL): `media_catalog_corrections/{tenant}_{project}_{asset}`. AI analizi bu belgeye
 * HİÇ yazmaz; yeniden analiz yalnız `media_ai_analyses` kaydı üretir. Etkin katalog = AI sonucu + insan alanları
 * (insan alanı varsa her zaman kazanır). verifiedProductIds yalnız buradan gelir.
 */
export const CatalogOverridesSchema = z
  .object({
    subject: z.string().max(120),
    description: z.string().max(400),
    tags: z.array(z.string().max(40)).max(15),
    foodCategories: z.array(z.string().max(40)).max(10),
    productIdentity: z.object({ status: z.enum(PRODUCT_IDENTITY_STATUS), note: z.string().max(200) }),
    usageSuggestions: z.array(z.enum(USAGE_SUGGESTIONS)).max(USAGE_SUGGESTIONS.length),
    shotType: ImageCatalogSchema.shape.composition.shape.shotType,
    peoplePresent: z.boolean(),
  })
  .partial()
  .strict();

export type CatalogOverrides = z.infer<typeof CatalogOverridesSchema>;

export const CatalogCorrectionInputSchema = z
  .object({
    overrides: CatalogOverridesSchema.optional(),
    verifiedProductIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(10).optional(),
    note: z.string().max(300).optional(),
  })
  .strict();

export interface MediaCatalogCorrection {
  tenantId: string;
  projectId: string;
  assetId: string;
  overrides?: CatalogOverrides;
  verifiedProductIds?: string[];
  note?: string;
  /** Düzeltme sırasında görülen AI kaydı (bilgi amaçlı; etkin katalogu değiştirmez) */
  basedOnAnalysisKey?: string | null;
  correctedBy: string;
  correctedAt: number;
}

export const correctionDocId = (tenantId: string, projectId: string, assetId: string) => `${tenantId}_${projectId}_${assetId}`;

export type FieldSource = 'human' | 'ai';

export interface EffectiveCatalog {
  catalog: ImageCatalog | null;
  /** Alan bazında kaynak: insan alanları yeniden analizde korunur */
  sources: Partial<Record<keyof CatalogOverrides, FieldSource>>;
  verifiedProductIds: string[];
}

/** AI sonucu + insan düzeltmesi → etkin katalog (saf). AI yoksa insan alanlarıyla kısmi katalog kurulmaz. */
export function effectiveCatalog(ai: ImageCatalog | null, correction: Pick<MediaCatalogCorrection, 'overrides' | 'verifiedProductIds'> | null): EffectiveCatalog {
  const o = correction?.overrides || {};
  const sources: EffectiveCatalog['sources'] = {};
  for (const k of Object.keys(o) as Array<keyof CatalogOverrides>) if (o[k] !== undefined) sources[k] = 'human';
  let catalog: ImageCatalog | null = null;
  if (ai) {
    catalog = {
      ...ai,
      ...(o.subject !== undefined ? { subject: o.subject } : {}),
      ...(o.description !== undefined ? { description: o.description } : {}),
      ...(o.tags !== undefined ? { tags: o.tags.map((t) => t.toLocaleLowerCase('tr')) } : {}),
      ...(o.foodCategories !== undefined ? { foodCategories: o.foodCategories } : {}),
      ...(o.productIdentity !== undefined ? { productIdentity: o.productIdentity } : {}),
      ...(o.usageSuggestions !== undefined ? { usageSuggestions: o.usageSuggestions } : {}),
      ...(o.peoplePresent !== undefined ? { peoplePresent: o.peoplePresent } : {}),
      composition: { ...ai.composition, ...(o.shotType !== undefined ? { shotType: o.shotType } : {}) },
    };
  }
  return { catalog, sources, verifiedProductIds: correction?.verifiedProductIds || [] };
}

// ── Haftalık plan taslak önerisi bağlantısı (api/_lib/planSuggest) ──

export interface PlannerCatalogInput {
  mediaId: string;
  tenantId: string;
  projectId: string;
  kind: 'photo' | 'video';
  width?: number;
  height?: number;
  sourceQuality: SourceQuality;
  catalog: ImageCatalog | null;
  /** Yalnız insan onayıyla kurulan bağlantılar; modelden gelmez */
  verifiedProductIds: string[];
  usedInPostCount: number | null;
  /**
   * Onay bağlamı YALNIZ mevcut post durumlarından: onaylı (approved/scheduled/published) ve onay sürecindeki
   * post'larda kullanım. Medyanın kendisinde onay alanı yoktur; kullanılmamış medya onaylı SAYILMAZ.
   */
  approvedUseCount?: number | null;
  pendingUseCount?: number | null;
  /** İnsan katalog düzeltmesi var mı (alan kaynağı human) */
  humanCorrected?: boolean;
  lastUsedAt?: string | null;
  archived: boolean;
}

/**
 * Planlayıcıya (ör. Sonnet) giden kısa, olgusal katalog satırı. Uydurma eşleştirme yok:
 * ürün bağlantısı yalnız verifiedProductIds'ten gelir; belirsizlik ve kaynak kalitesi açıkça taşınır.
 */
export function toPlannerLine(m: PlannerCatalogInput): string | null {
  if (m.archived) return null;
  // Serbest metin tek satır ve ayırıcısız (satır biçimi ve talimat enjeksiyonuna karşı)
  const clean = (v: string, n = 80) => v.replace(/[\r\n|]+/g, ' ').trim().slice(0, n);
  const parts = [`media:${m.mediaId}`, m.kind === 'video' ? 'video' : 'foto'];
  if (m.width && m.height) parts.push(`${m.width}x${m.height}`);
  parts.push(`kaynak:${m.sourceQuality}`);
  if (m.catalog) {
    if (m.catalog.subject) parts.push(`konu:${clean(m.catalog.subject)}`);
    parts.push(`çekim:${m.catalog.composition.shotType}`, `yön:${m.catalog.composition.orientation}`);
    if (m.catalog.composition.negativeSpace) parts.push('boş_alan');
    if (m.catalog.usageSuggestions?.length) parts.push(`öneri:${m.catalog.usageSuggestions.join(',')}`);
    if (m.catalog.productIdentity) parts.push(`ürün_kimliği:${m.catalog.productIdentity.status}`);
    if (m.catalog.foodCategories.length) parts.push(`kategori:${clean(m.catalog.foodCategories.join('/'))}`);
    if (m.catalog.tags.length) parts.push(`etiket:${clean(m.catalog.tags.slice(0, 8).join(','), 160)}`);
    parts.push(`güven:${m.catalog.overallConfidence}`);
    if (m.catalog.uncertainties.length) parts.push(`belirsiz:${m.catalog.uncertainties.length}`);
  } else {
    parts.push('katalog:yok');
  }
  parts.push(m.verifiedProductIds.length ? `ürün:${m.verifiedProductIds.join(',')}` : 'ürün:doğrulanmamış');
  parts.push(m.usedInPostCount === null ? 'kullanım:bilinmiyor' : `kullanım:${m.usedInPostCount}`);
  if (m.approvedUseCount || m.pendingUseCount) {
    if (m.approvedUseCount) parts.push(`onaylı_postta:${m.approvedUseCount}`);
    if (m.pendingUseCount) parts.push(`onay_sürecinde:${m.pendingUseCount}`);
  } else {
    parts.push('onay_bağlamı:henüz_yok');
  }
  if (m.humanCorrected) parts.push('katalog:insan_düzeltmeli');
  return parts.join(' | ');
}
