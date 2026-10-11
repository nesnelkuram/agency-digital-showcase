/**
 * Planlayıcı metin üretimi — sunucu orkestrasyonu. Şablon fallback YOKTUR: marka sesi paketi yoksa, medya geçersizse,
 * model hata/ret verirse veya çıktı doğrulamadan geçmezse açık hata/ret döner. Model çıktısı ASLA doğrudan kabul
 * edilmez; shared/planner/copyContract.validateCopyOutput'tan geçer.
 */
import { z } from 'zod/v4';
import { isConsistentAsset, type BrandMediaAsset, type MediaSourcePolicy } from '../../../shared/types/brandMedia.js';
import { validateBrandVoiceBundle, type BrandVoiceBundle } from '../../../shared/planner/brandVoice.js';
import {
  buildCopyPrompt, validateCopyOutput, EVIDENCE_BASES, COPY_MODEL, COPY_PROMPT_VERSION,
  type CopyMedia, type CopyRequest, type CopyValidation, type CatalogLite,
} from '../../../shared/planner/copyContract.js';
import { sha256Hex } from '../../../shared/planner/sha256.js';
import { loadEffectiveCatalog } from '../mediaAnalysis/correctionStore.js';

type Db = any;

export const BRAND_VOICE_COLLECTION = 'brand_voice_context';
export const brandVoiceDocId = (tenantId: string, projectId: string) => `${tenantId}_${projectId}`;

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

export async function loadBrandVoice(db: Db, tenantId: string, projectId: string): Promise<BrandVoiceBundle> {
  const s = await db.collection(BRAND_VOICE_COLLECTION).doc(brandVoiceDocId(tenantId, projectId)).get();
  const d = s.exists ? s.data() : null;
  if (!d || d.tenantId !== tenantId || d.projectId !== projectId) {
    throw new CopyError(412, 'brand_voice_missing', 'Bu marka için marka sesi paketi yüklenmemiş; metin üretilemez.');
  }
  const v = validateBrandVoiceBundle(d.bundle, sha256Hex);
  if (!v.ok) throw new CopyError(500, 'brand_voice_invalid', 'Saklanan marka sesi paketi geçersiz.', v.errors.slice(0, 5));
  return v.bundle;
}

const toLite = (c: any): CatalogLite => ({
  subject: String(c.subject ?? ''),
  description: String(c.description ?? ''),
  tags: Array.isArray(c.tags) ? c.tags : [],
  foodCategories: Array.isArray(c.foodCategories) ? c.foodCategories : [],
  visibleObjects: Array.isArray(c.visibleObjects) ? c.visibleObjects : [],
  uncertainties: Array.isArray(c.uncertainties) ? c.uncertainties : [],
  shotType: c.composition?.shotType,
  subjectPlacement: c.composition?.subjectPlacement,
  negativeSpace: !!c.composition?.negativeSpace,
  peoplePresent: !!c.peoplePresent,
});

/** Yalnız bu tenant+proje, aktif, depolama tutarlı medya. Katalog ve doğrulanmış ürün bağlantısı SUNUCUDA yüklenir. */
export async function loadCopyMedia(
  db: Db,
  p: { tenantId: string; projectId: string; ids: string[]; policy: MediaSourcePolicy; bundle: BrandVoiceBundle }
): Promise<{ media: Map<string, CopyMedia>; invalid: Array<{ id: string; reason: string }> }> {
  const media = new Map<string, CopyMedia>();
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
        media.set(id, {
          mediaId: id,
          kind: asset.kind,
          width: asset.storage.width,
          height: asset.storage.height,
          catalog: eff.catalog ? toLite(eff.catalog) : null,
          verifiedProductIds: eff.verifiedProductIds.filter((v: string) => known.has(v)),
        });
      })
    );
  }
  return { media, invalid };
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
}

export async function generateCopy(
  db: Db,
  deps: { callModel: CopyModelCall; policy: MediaSourcePolicy; /** İstenen model kimliği (OpenRouter: sağlayıcı/model); yoksa COPY_MODEL */ model?: string },
  p: { tenantId: string; projectId: string; req: CopyRequest; /** üretimi isteyen kullanıcı ve zaman: üretilen metinler bu kimlikle kaydedilir */ issuedBy?: { uid: string; now: number } }
): Promise<GenerateResult> {
  const bundle = await loadBrandVoice(db, p.tenantId, p.projectId);
  const ids = p.req.items.map((i) => i.mediaId);
  const { media, invalid } = await loadCopyMedia(db, { tenantId: p.tenantId, projectId: p.projectId, ids, policy: deps.policy, bundle });
  if (invalid.length) throw new CopyError(422, 'media_invalid', 'İstekteki medya bu marka kütüphanesinde geçerli değil.', invalid);
  // Story serisi yalnız GERÇEK (insan doğrulamalı) ürün kimliğiyle kurulur; aynı gün olmak seri değildir.
  const unverified = p.req.items.filter((i) => i.lane === 'story' && i.seriesKey && !media.get(i.mediaId)?.verifiedProductIds.includes(i.seriesKey)).map((i) => i.slotKey);
  if (unverified.length) throw new CopyError(422, 'series_unverified', 'Seri kimliği medyanın doğrulanmış ürün bağlantısıyla eşleşmiyor.', unverified);

  const prompt = buildCopyPrompt(bundle, p.req, media);
  const requestedModel = deps.model ?? COPY_MODEL;
  let res: CopyModelResult;
  try {
    res = await deps.callModel({ model: requestedModel, system: prompt.system, user: prompt.user });
  } catch (e: any) {
    console.error('plan-copy model error:', e?.status ?? '', e?.code ?? '');
    throw new CopyError(502, 'model_error', 'Metin üretim modeli çağrısı başarısız; metin üretilmedi.');
  }
  if (res.stopReason === 'refusal') throw new CopyError(422, 'model_refusal', 'Model isteği reddetti; metin üretilmedi.');
  if (res.parsed == null) throw new CopyError(422, 'model_no_output', 'Model geçerli yapılandırılmış çıktı döndürmedi; metin üretilmedi.');
  const v = validateCopyOutput(res.parsed, p.req, { media, bundle, avoidTexts: p.req.avoidTexts });
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
      ...meta, usage,
    });
  }
  return {
    ...v,
    model: res.modelUsed ?? requestedModel,
    ...meta,
    promptVersion: COPY_PROMPT_VERSION,
    responseId: res.id ?? null,
    usage,
  };
}
