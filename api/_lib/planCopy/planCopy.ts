/**
 * Planlayıcı metin üretimi — sunucu orkestrasyonu. Şablon fallback YOKTUR: marka sesi paketi yoksa, medya geçersizse,
 * model hata/ret verirse veya çıktı doğrulamadan geçmezse açık hata/ret döner. Model çıktısı ASLA doğrudan kabul
 * edilmez; shared/planner/copyContract.validateCopyOutput'tan geçer.
 */
import { z } from 'zod/v4';
import { isConsistentAsset, type BrandMediaAsset, type MediaSourcePolicy } from '../../../shared/types/brandMedia.js';
import { validateBrandVoiceBundle, type BrandVoiceBundle } from '../../../shared/planner/brandVoice.js';
import {
  buildCopyPrompt, buildFallbackPrompt, validateCopyOutput, cleanTonePrompt, EVIDENCE_BASES, COPY_MODEL, COPY_PROMPT_VERSION,
  type CopyMedia, type CopyRequest, type CopyValidation, type CatalogLite, type TempTone, type VoiceMode,
} from '../../../shared/planner/copyContract.js';
import { validateBrandGuide, type BrandGuide } from '../../../shared/planner/brandGuide.js';
import { sha256Hex } from '../../../shared/planner/sha256.js';
import { loadEffectiveCatalog } from '../mediaAnalysis/correctionStore.js';
import { cropVisibility, type VisualDecision } from '../../../shared/planner/visualDecision.js';
import { liteOfEffective } from '../mediaAnalysis/catalogLite.js';

type Db = any;

export const BRAND_VOICE_COLLECTION = 'brand_voice_context';
export const brandVoiceDocId = (tenantId: string, projectId: string) => `${tenantId}_${projectId}`;

/** Konuşmayla kurulup İNSAN onaylı rehber (tek belge/proje; sürümlü). Yalnız sunucu yazar. */
export const BRAND_GUIDE_COLLECTION = 'brand_guides';
export const brandGuideDocId = (tenantId: string, projectId: string) => `${tenantId}_${projectId}`;

export class CopyError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

/** Yapılandırılmış çıktı şeması (shared/planner/copyContract.CopyOutputItem ile aynı alanlar) */
export const CopyOutputSchema = z.object({
  items: z.array(
    z.object({
      slotKey: z.string(),
      caption: z.string().nullable(),
      headline: z.string().nullable(),
      body: z.string().nullable(),
      evidenceBasis: z.enum(EVIDENCE_BASES),
      /** Satırdaki olgulardan sade özet; caption ve rationale'dan AYRI */
      observation: z.string(),
      rationale: z.string(),
    })
  ),
  notes: z.array(z.string()),
});

/** Sağlayıcıdan bağımsız kullanım ve MALİYET kaydı (OpenRouter: usage.cost kredi/USD). Bilinmeyen alan null kalır, uydurulmaz. */
export interface CopyUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
  /** Sağlayıcının bildirdiği toplam maliyet (USD). Sağlayıcı bildirmediyse null: yerel tahmin yapılmaz. */
  costUsd: number | null;
}
export interface CopyModelResult {
  /** Yanıt kimliği (OpenRouter: gen-…) */
  id: string;
  stopReason: string | null;
  parsed: unknown;
  /** Eski biçim (Anthropic SDK); yeni sağlayıcılar `usageDetail` doldurur */
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  provider?: 'openrouter' | 'anthropic';
  /** Sağlayıcının GERÇEKTEN çalıştırdığı model kimliği (istenenden farklı olabilir) */
  modelUsed?: string | null;
  /** İstek/izleme kimliği (yanıt başlığından; yoksa null) */
  requestId?: string | null;
  usageDetail?: CopyUsage | null;
}
export type CopyModelCall = (p: { model: string; system: string; user: string }) => Promise<CopyModelResult>;

/** OpenRouter model kimliği: `sağlayıcı/model`. Çıplak (sağlayıcısız) kimlik OpenRouter'da geçersizdir ve doğrudan Anthropic'e yönlendirme riskini kapatmak için reddedilir. */
export const OPENROUTER_MODEL_RE = /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:+-]*$/;
/** Varsayılan: Sonnet 5.5'in OpenRouter kimliği. DOĞRULANMADI (OpenRouter'a canlı sorgu yapılmadı); farklıysa PLAN_COPY_MODEL ile geçersiz kılın. */
export const DEFAULT_OPENROUTER_COPY_MODEL = 'anthropic/claude-sonnet-5.5';
export function resolveCopyModel(env: Record<string, string | undefined> = process.env): { ok: true; model: string } | { ok: false; reason: string } {
  const raw = env.PLAN_COPY_MODEL?.trim();
  if (!raw) return { ok: true, model: DEFAULT_OPENROUTER_COPY_MODEL };
  return OPENROUTER_MODEL_RE.test(raw) ? { ok: true, model: raw } : { ok: false, reason: 'PLAN_COPY_MODEL geçersiz (biçim: sağlayıcı/model, ör. anthropic/claude-sonnet-5.5).' };
}

/** Yüklü paket yoksa null (hata değil); bozuk paket 500. */
export async function findBrandVoice(db: Db, tenantId: string, projectId: string): Promise<BrandVoiceBundle | null> {
  const s = await db.collection(BRAND_VOICE_COLLECTION).doc(brandVoiceDocId(tenantId, projectId)).get();
  const d = s.exists ? s.data() : null;
  if (!d || d.tenantId !== tenantId || d.projectId !== projectId) return null;
  const v = validateBrandVoiceBundle(d.bundle, sha256Hex);
  if (!v.ok) throw new CopyError(500, 'brand_voice_invalid', 'Saklanan marka sesi paketi geçersiz.', v.errors.slice(0, 5));
  return v.bundle;
}

export async function loadBrandVoice(db: Db, tenantId: string, projectId: string): Promise<BrandVoiceBundle> {
  const b = await findBrandVoice(db, tenantId, projectId);
  if (!b) throw new CopyError(412, 'brand_voice_missing', 'Bu marka için marka sesi paketi yüklenmemiş; metin üretilemez.');
  return b;
}

/** İnsan onaylı konuşmalı rehber (varsa). Bozuksa 500: sessizce geçici tona düşülmez. */
export async function findApprovedGuide(db: Db, tenantId: string, projectId: string): Promise<{ guide: BrandGuide; version: number } | null> {
  const s = await db.collection(BRAND_GUIDE_COLLECTION).doc(brandGuideDocId(tenantId, projectId)).get();
  const d = s.exists ? s.data() : null;
  if (!d || d.tenantId !== tenantId || d.projectId !== projectId) return null;
  const v = validateBrandGuide(d.guide);
  if (!v.ok || !Number.isInteger(d.version)) throw new CopyError(500, 'brand_guide_invalid', 'Saklanan marka rehberi geçersiz.', v.ok ? undefined : v.errors.slice(0, 5));
  return { guide: v.guide, version: d.version };
}

/** Doğrulama için boş marka sesi paketi: rehber/ton modlarında hesap gönderisi, kılavuz veya paket ürün listesi YOKTUR. */
function syntheticBundle(name: string): BrandVoiceBundle {
  return {
    schemaVersion: 1, brand: { name, account: '' }, builtFrom: { evidenceCount: 0, ownerFilter: '', excluded: [] },
    captions: [], guides: { persona: '', languageGuide: '', shareStyles: '' },
    guideHashes: { persona: '', languageGuide: '', shareStyles: '' }, verifiedProducts: [],
  };
}

export type ResolvedVoice =
  | { mode: 'bundle'; bundle: BrandVoiceBundle }
  | { mode: 'guide'; bundle: BrandVoiceBundle; guide: BrandGuide; version: number }
  | { mode: 'tone'; bundle: BrandVoiceBundle; tone: TempTone };

/**
 * Ses kaynağı önceliği (onaylı olan HER ZAMAN öncelikli): 1) yüklü marka sesi paketi, 2) insan onaylı rehber,
 * 3) kullanıcının seçtiği GEÇİCİ ton. Hiçbiri yoksa 412 (model çağrılmaz). Sağlayıcı kapalı (503) bundan AYRIDIR.
 */
export async function resolveVoice(db: Db, tenantId: string, projectId: string, tempTone?: TempTone): Promise<ResolvedVoice> {
  const bundle = await findBrandVoice(db, tenantId, projectId);
  if (bundle) return { mode: 'bundle', bundle };
  const approved = await findApprovedGuide(db, tenantId, projectId);
  if (approved) return { mode: 'guide', bundle: syntheticBundle(approved.guide.brandName), guide: approved.guide, version: approved.version };
  const tone: TempTone | null = tempTone ? { ...(tempTone.label ? { label: tempTone.label } : {}), ...(tempTone.prompt && cleanTonePrompt(tempTone.prompt) ? { prompt: cleanTonePrompt(tempTone.prompt) } : {}) } : null;
  if (tone && (tone.label || tone.prompt)) return { mode: 'tone', bundle: syntheticBundle('Marka'), tone };
  throw new CopyError(412, 'brand_voice_missing', 'Bu marka için onaylı marka dili yok. Geçici bir ton seçin veya marka dilini birlikte oluşturun.', { needs: 'tone_or_guide' });
}

/** Yalnız bu tenant+proje, aktif, depolama tutarlı medya. Katalog ve doğrulanmış ürün bağlantısı SUNUCUDA yüklenir. */
export async function loadCopyMedia(
  db: Db,
  p: { tenantId: string; projectId: string; ids: string[]; policy: MediaSourcePolicy; bundle: BrandVoiceBundle; /** Rehber/ton modunda paket ürün listesi yoktur: insan bağlantıları ADSIZ kimlik olarak korunur (seri doğrulaması için) */ keepUnnamedProducts?: boolean }
): Promise<{ media: Map<string, CopyMedia>; invalid: Array<{ id: string; reason: string }>; visuals: Map<string, VisualDecision | null>; /** Kaynak içerik kimliği (SHA-256) ve analiz anahtarı; analiz yoksa null (önbellek/bayatlık için) */ provenance: Map<string, { analysisKey: string | null; sourceSha256: string | null }> }> {
  const media = new Map<string, CopyMedia>();
  const visuals = new Map<string, VisualDecision | null>();
  const provenance = new Map<string, { analysisKey: string | null; sourceSha256: string | null }>();
  const invalid: Array<{ id: string; reason: string }> = [];
  const known = new Set(p.bundle.verifiedProducts.map((v) => v.id));
  for (let i = 0; i < p.ids.length; i += 10) {
    await Promise.all(
      p.ids.slice(i, i + 10).map(async (id) => {
        const s = await db.collection('brand_media').doc(id).get();
        if (!s.exists) return void invalid.push({ id, reason: 'not_found' });
        const asset = { id, ...s.data() } as BrandMediaAsset;
        if (asset.tenantId !== p.tenantId || asset.projectId !== p.projectId) return void invalid.push({ id, reason: 'not_found' }); // başka marka: varlığı sızdırma
        if (asset.status !== 'active') return void invalid.push({ id, reason: 'archived' });
        if (!isConsistentAsset(asset, p.tenantId, p.projectId, p.policy)) return void invalid.push({ id, reason: 'inconsistent_asset' });
        const eff = await loadEffectiveCatalog(db, p.tenantId, p.projectId, id);
        visuals.set(id, eff.visual?.decision ?? null);
        provenance.set(id, { analysisKey: eff.analysisKey ?? null, sourceSha256: eff.sourceSha256 ?? (eff.visual?.provenance?.sourceSha256 || null) });
        media.set(id, {
          mediaId: id,
          kind: asset.kind,
          width: asset.storage.width,
          height: asset.storage.height,
          catalog: liteOfEffective(eff),
          verifiedProductIds: p.keepUnnamedProducts ? eff.verifiedProductIds : eff.verifiedProductIds.filter((v: string) => known.has(v)),
        });
      })
    );
  }
  return { media, invalid, visuals, provenance };
}

/** Post (4:5) oranı: 1080×1350 */
export const POST_RATIO = 4 / 5;

/**
 * Kırpımda GÖRÜNÜR olgu sınırı (sunucu hesabı; istemci iddiasına güvenilmez). Kırpılmış öğede katalog, kırpımda doğrulanan ana konuya daraltılır;
 * ana konu kırpımda doğrulanamıyorsa katalog ve doğrulanmış ürün bağlantısı düşer (görünür olgu yok). Kırpılmamışsa (tam kare) değişmez.
 * Dönüş: kırpımdan dolayı görünür olgusu KALMAYAN (facts='yok') TÜM mediaId'ler — katalog hiç olmasa da (bilinmeyen kırpım olgusu engellenir;
 * doğrulanmış ürün bağlantısı da düşer). Hangi nedenle (katalog yok / kırpımda görünmüyor) reddedileceğine çağıran karar verir.
 */
export function applyCropVisibility(media: Map<string, CopyMedia>, visuals: Map<string, VisualDecision | null>, items: CopyRequest['items']): Set<string> {
  const blocked = new Set<string>();
  for (const it of items) {
    if (!it.crop) continue;
    const m = media.get(it.mediaId);
    if (!m) continue;
    const dims = m.width && m.height ? { w: m.width, h: m.height } : null;
    const vis = dims ? cropVisibility(visuals.get(it.mediaId) ?? null, dims, POST_RATIO, it.crop.focus, it.crop.zoom) : { cropped: true, windowShare: 0, subject: 'unknown' as const, facts: 'yok' as const };
    m.visibility = { cropped: vis.cropped, facts: vis.facts };
    if (vis.facts === 'yalnız_konu' && m.catalog) {
      m.catalog = {
        ...m.catalog, description: '', tags: [], foodCategories: [], visibleObjects: [],
        uncertainties: [...m.catalog.uncertainties, 'Kırpımda yalnız ana konunun görünür olduğu doğrulandı; diğer nesne/ayrıntıların görünürlüğü doğrulanmadı'],
      };
    } else if (vis.facts === 'yok') {
      blocked.add(it.mediaId);
      m.catalog = null;
      m.verifiedProductIds = [];
    }
  }
  return blocked;
}

/** Sunucunun ürettiği metinlerin kaydı: taslak kaydederken `source:'model'` iddiası bu kayda karşı doğrulanır (yalnız Admin SDK yazar). */
export const COPY_ISSUED = 'planner_copy_issued';
export const copyIssuedDocId = (tenantId: string, projectId: string, responseId: string) => sha256Hex([tenantId, projectId, responseId].join('|')).slice(0, 40);

export interface GenerateResult extends CopyValidation {
  /** Gerçekte çalışan model (sağlayıcı bildirdiyse), yoksa istenen */
  model: string;
  provider: 'openrouter' | 'anthropic' | null;
  requestedModel: string;
  modelUsed: string | null;
  requestId: string | null;
  promptVersion: string;
  responseId: string | null;
  usage: CopyUsage;
  /** Hangi ses kaynağı kullanıldı ve varsayımlar. approved_* her zaman geçici tona üstündür. */
  voice: { source: 'approved_bundle' | 'approved_guide' | 'temporary_tone'; tone: TempTone | null; guideVersion: number | null; assumptions: string[]; tempToneIgnored: boolean };
}
const VOICE_SOURCE = { bundle: 'approved_bundle', guide: 'approved_guide', tone: 'temporary_tone' } as const;

export async function generateCopy(
  db: Db,
  deps: { callModel: CopyModelCall; policy: MediaSourcePolicy; /** İstenen model kimliği (OpenRouter: sağlayıcı/model); yoksa COPY_MODEL */ model?: string },
  p: { tenantId: string; projectId: string; req: CopyRequest; /** üretimi isteyen kullanıcı ve zaman: üretilen metinler bu kimlikle kaydedilir */ issuedBy?: { uid: string; now: number } }
): Promise<GenerateResult> {
  const voice = await resolveVoice(db, p.tenantId, p.projectId, p.req.tempTone);
  const bundle = voice.bundle;
  const mode: VoiceMode = voice.mode;
  const ids = p.req.items.map((i) => i.mediaId);
  const { media, invalid, visuals } = await loadCopyMedia(db, { tenantId: p.tenantId, projectId: p.projectId, ids, policy: deps.policy, bundle, keepUnnamedProducts: mode !== 'bundle' });
  if (invalid.length) throw new CopyError(422, 'media_invalid', 'İstekteki medya bu marka kütüphanesinde geçerli değil.', invalid);
  // Story serisi yalnız GERÇEK (insan doğrulamalı) ürün kimliğiyle kurulur; aynı gün olmak seri değildir.
  const unverified = p.req.items.filter((i) => i.lane === 'story' && i.seriesKey && !media.get(i.mediaId)?.verifiedProductIds.includes(i.seriesKey)).map((i) => i.slotKey);
  if (unverified.length) throw new CopyError(422, 'series_unverified', 'Seri kimliği medyanın doğrulanmış ürün bağlantısıyla eşleşmiyor.', unverified);

  // Post kırpımı: kırpım dışında kalan / görünürlüğü doğrulanamayan olgular katalogdan DÜŞER (görünen gerçek diye taşınmaz)
  const hadCatalog = new Set([...media.values()].filter((m) => m.catalog).map((m) => m.mediaId));
  const cropBlocked = applyCropVisibility(media, visuals, p.req.items);
  /** Ret nedeni: konu açıklaması hiç yoksa semantik, vardı ama kırpımda görünmüyorsa kırpım */
  const blockReason = (id: string) => (hadCatalog.has(id) ? 'kirpimda_gorunur_olgu_yok' : 'semantik_aciklama_yok');
  // Rehber/ton modunda: tek kanıt GERÇEK konu açıklamasıdır (AI gözlemi veya insanın yazdığı açıklama). Ölçülen renk/ışık/kadraj
  // caption kanıtı DEĞİLDİR; semantik açıklama yoksa slot modele GİTMEZ (uydurma yerine dürüst ret, ücret yok).
  const preRejected: Array<{ slotKey: string; reasons: string[] }> = [];
  let modelReq: CopyRequest = p.req;
  let noCatalog = 0;
  const measurementIgnored = p.req.items.some((i) => i.observed);
  if (mode !== 'bundle') {
    const keep: CopyRequest['items'] = [];
    for (const it of p.req.items) {
      const m = media.get(it.mediaId)!;
      if (!m.catalog) { if (!hadCatalog.has(it.mediaId)) noCatalog++; preRejected.push({ slotKey: it.slotKey, reasons: [blockReason(it.mediaId)] }); continue; }
      keep.push(it);
    }
    modelReq = { ...p.req, items: keep };
  } else if (p.req.items.some((i) => i.crop)) {
    // Paket modunda da: post (kırpımlı) öğede görünür olgu yoksa slot modele GİTMEZ (persona/hesap tonuyla görünmeyeni "görünen" diye yazma riski yok)
    const keep: CopyRequest['items'] = [];
    for (const it of p.req.items) {
      if (cropBlocked.has(it.mediaId)) { preRejected.push({ slotKey: it.slotKey, reasons: [blockReason(it.mediaId)] }); continue; }
      if (it.crop && !media.get(it.mediaId)!.catalog) { preRejected.push({ slotKey: it.slotKey, reasons: ['semantik_aciklama_yok'] }); continue; }
      keep.push(it);
    }
    modelReq = { ...p.req, items: keep };
  }
  const tone = voice.mode === 'tone' ? voice.tone : voice.mode === 'bundle' || voice.mode === 'guide' ? null : null;
  const assumptions: string[] = [];
  if (mode === 'tone') {
    assumptions.push('Marka rehberi yok: ton GEÇİCİ plan tonudur, onaylı marka hafızası değildir.');
    assumptions.push('Metin yalnız görselin gerçek konu açıklamasından (AI gözlemi veya insan açıklaması) türetilir; ürün, içerik, fiyat ve saat doğrulanmadı.');
  }
  if (mode !== 'bundle' && noCatalog) assumptions.push(`${noCatalog} görselde konu açıklaması yok (analiz bekliyor/yok); bunlar için metin üretilmedi. Renk/ışık ölçümü caption kanıtı sayılmaz.`);
  const blockedWithCatalog = [...cropBlocked].filter((id) => hadCatalog.has(id)).length;
  if (blockedWithCatalog) assumptions.push(`${blockedWithCatalog} görselde kırpımda ana konunun görünürlüğü doğrulanamadı; kırpım dışında kalan ayrıntılar görünen gerçek sayılmadı ve bu görseller için metin üretilmedi.`);
  if (p.req.items.some((i) => i.crop && media.get(i.mediaId)?.visibility?.facts === 'yalnız_konu')) assumptions.push('4:5 kırpımda yalnız ana konunun görünürlüğü doğrulandı; nesne/ayrıntı görünürlüğü doğrulanmadığı için metne taşınmadı.');
  if (measurementIgnored) assumptions.push('İstemcinin ölçtüğü görsel özellikler (renk, ışık, kadraj) caption kanıtı olarak kullanılmadı.');
  const voiceInfo: GenerateResult['voice'] = {
    source: VOICE_SOURCE[mode], tone, guideVersion: voice.mode === 'guide' ? voice.version : null, assumptions,
    tempToneIgnored: mode !== 'tone' && !!p.req.tempTone,
  };
  const requestedModel = deps.model ?? COPY_MODEL;
  const zeroUsage: CopyUsage = { inputTokens: null, outputTokens: null, totalTokens: null, cachedTokens: null, reasoningTokens: null, costUsd: null };
  if (modelReq.items.length === 0) {
    // Hiçbir slotun konu açıklaması yok: model çağrılmaz (ücret yok)
    return {
      accepted: [], rejected: preRejected, notes: [], model: requestedModel, provider: null, requestedModel, modelUsed: null, requestId: null,
      promptVersion: mode === 'bundle' ? COPY_PROMPT_VERSION : mode === 'tone' ? 'plan-copy-v2-tone' : 'plan-copy-v2-guide', responseId: null, usage: zeroUsage, voice: voiceInfo,
    };
  }

  const prompt = mode === 'bundle'
    ? buildCopyPrompt(bundle, modelReq, media)
    : buildFallbackPrompt(mode, modelReq, media, mode === 'tone' ? { tone: (voice as Extract<ResolvedVoice, { mode: 'tone' }>).tone } : { guide: (voice as Extract<ResolvedVoice, { mode: 'guide' }>).guide });
  let res: CopyModelResult;
  try {
    res = await deps.callModel({ model: requestedModel, system: prompt.system, user: prompt.user });
  } catch (e: any) {
    console.error('plan-copy model error:', e?.status ?? '', e?.code ?? '');
    throw new CopyError(502, 'model_error', 'Metin üretim modeli çağrısı başarısız; metin üretilmedi.');
  }
  if (res.stopReason === 'refusal') throw new CopyError(422, 'model_refusal', 'Model isteği reddetti; metin üretilmedi.');
  if (res.parsed == null) throw new CopyError(422, 'model_no_output', 'Model geçerli yapılandırılmış çıktı döndürmedi; metin üretilmedi.');
  const v = validateCopyOutput(res.parsed, modelReq, {
    media, bundle, avoidTexts: p.req.avoidTexts, mode, guideFacts: voice.mode === 'guide' ? voice.guide.facts : undefined,
  });
  const usage: CopyUsage = res.usageDetail ?? {
    inputTokens: res.usage?.input_tokens ?? null, outputTokens: res.usage?.output_tokens ?? null,
    totalTokens: null, cachedTokens: null, reasoningTokens: null, costUsd: null,
  };
  const meta = { provider: res.provider ?? null, requestedModel, modelUsed: res.modelUsed ?? null, requestId: res.requestId ?? null };
  if (res.id && v.accepted.length && p.issuedBy) {
    const hashes: Record<string, string> = {};
    for (const a of v.accepted) hashes[a.contentHash] = a.mediaId;
    await db.collection(COPY_ISSUED).doc(copyIssuedDocId(p.tenantId, p.projectId, res.id)).set({
      tenantId: p.tenantId, projectId: p.projectId, responseId: res.id, issuedBy: p.issuedBy.uid, hashes, createdAt: p.issuedBy.now,
      ...meta, usage, voiceSource: voiceInfo.source, guideVersion: voiceInfo.guideVersion, toneLabel: tone?.label ?? null,
    });
  }
  return {
    ...v,
    rejected: [...v.rejected, ...preRejected],
    model: res.modelUsed ?? requestedModel,
    ...meta,
    promptVersion: prompt.promptVersion,
    responseId: res.id ?? null,
    usage,
    voice: voiceInfo,
  };
}
