/**
 * Tek görsel analizi (OpenRouter: Haiku 5.5 / Sonnet 5.5) — tekrar önleme, durum, sınırlı yeniden deneme, usage/maliyet kaydı.
 * Toplu/geçmiş analiz YOK: çağıran tek bir Studio varlığı için çalıştırır.
 * Model çağrısı dışarıdan verilir (testte sahte; üretimde openrouterVisionCall).
 * Tek yanıt iki AYRI alan taşır: konu kataloğu (`result`) ve kompozisyon kararı (`visual`); ikisi ayrı doğrulanır ve sürümlenir.
 */

import { createHash, randomUUID } from 'crypto';
import {
  ANALYSIS_MAX_DIMENSION,
  ANALYSIS_MAX_RAW_BYTES,
  ANALYSIS_MIME,
  CATALOG_MODEL,
  MEDIA_ANALYSIS_PROMPT_VERSION,
  MEDIA_ANALYSIS_SCHEMA_VERSION,
  CATALOG_FIELDS_SCHEMA_VERSION,
  VISUAL_PROMPT_VERSION,
  VISUAL_SCHEMA_VERSION,
  analysisKey,
  normalizeCatalog,
  type ImageCatalog,
  type SourceQuality,
  type UsageLike,
} from './spec';
import { parseAnalysisOutput } from './visualSpec';
import type { VisualDecision } from '../../../shared/planner/visualDecision';
import type { CopyUsage } from '../planCopy/planCopy';
import {
  BAD_MEDIA_TYPE_MESSAGE,
  CATEGORY_MESSAGES,
  EXHAUSTED_MESSAGE,
  NETWORK_MESSAGE,
  NO_API_KEY_MESSAGE,
  REFUSAL_MESSAGE,
  SCHEMA_INVALID_MESSAGE,
  safeRequestId,
  safeStatus,
  sanitizeStoredError,
  type SafeAnalysisError,
} from '../../../shared/mediaAnalysisError';

export const MAX_ANALYSIS_ATTEMPTS = 3;
/** Model zaman aşımı (120 sn) + kaynak indirme/yazma payı: lease çağrı sürerken düşmez → ikinci çalıştırıcı aynı işi almaz */
export const ANALYSIS_LEASE_MS = 180_000;

export type AnalysisStatus = 'running' | 'done' | 'failed' | 'unsupported';

export interface AnalysisRecord {
  key: string;
  tenantId: string;
  projectId: string;
  sourceKind: 'brand_media';
  sourceId: string;
  sourceQuality: SourceQuality;
  sourcePath: string;
  sourceSha256: string;
  sourceWidth?: number;
  sourceHeight?: number;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  status: AnalysisStatus;
  /** Alan bazında sürümler: katalog (konu/nesne) ve görsel karar (kompozisyon) AYRI sürümlenir */
  catalogSchemaVersion?: string;
  visualSchemaVersion?: string;
  visualPromptVersion?: string;
  attempts: number;
  retryable?: boolean;
  leaseUntil?: number | null;
  /** Bu denemeyi yürüten çalıştırıcı; sonuç yalnız onunla yazılır (fencing) */
  leaseOwner?: string | null;
  result?: ImageCatalog | null;
  /** Kompozisyon kararı (model gözlemi + kutu tahmini). ok: doğrulandı; partial: kutu bilinmiyor/bazı bölgeler düşürüldü, diğer alanlar geçerli (neden visualIssue); invalid: şema doğrulamadan geçmedi; absent: eski kayıt */
  visual?: VisualDecision | null;
  visualStatus?: 'ok' | 'partial' | 'invalid' | 'absent';
  visualIssue?: string | null;
  provider?: 'openrouter' | null;
  /** Sağlayıcının GERÇEKTEN çalıştırdığı model (istenenden farklı olabilir) */
  modelUsed?: string | null;
  requestId?: string | null;
  /** Sağlayıcının bildirdiği usage ve maliyet (USD). Yerel tahmin yoktur; bildirilmediyse null. */
  usageDetail?: CopyUsage | null;
  costUsd?: number | null;
  /** Eski kayıtlar (doğrudan Anthropic) */
  usage?: UsageLike | null;
  estimatedCostUsd?: number | null;
  pricingSnapshot?: unknown;
  stopReason?: string | null;
  responseId?: string | null;
  durationMs?: number | null;
  /** Allowlist'li güvenli hata (shared/mediaAnalysisError): sağlayıcı ham metni/gövdesi ASLA saklanmaz */
  error?: SafeAnalysisError | null;
  createdAt: number;
  updatedAt: number;
}

export interface BrandMediaLike {
  id: string;
  tenantId: string;
  projectId: string;
  kind: 'photo' | 'video';
  status: string;
  storage: { path: string; contentType: string; size: number; width?: number; height?: number; thumbPath?: string };
}

/**
 * Hangi baytlar analiz edilecek? Orijinal API sınırına uyuyorsa orijinal; değilse Studio önizlemesi
 * (thumb.jpg, ~480px) ve bu AÇIKÇA "studio_preview" olarak işaretlenir. Önizleme yoksa desteklenmez.
 * (Sunucuda görüntü küçültme kütüphanesi yok; büyük orijinaller için türev üretimi ayrı karar.)
 */
export function selectAnalysisSource(a: BrandMediaLike): { quality: SourceQuality; path: string; contentType: string } | { unsupported: string } {
  if (a.kind !== 'photo') return { unsupported: 'Yalnız fotoğraf analiz edilir' };
  if (a.status !== 'active') return { unsupported: 'Arşivlenmiş dosya analiz edilmez' };
  const s = a.storage;
  const dimsKnown = !!s.width && !!s.height;
  const fits = ANALYSIS_MIME.has(s.contentType) && s.size > 0 && s.size <= ANALYSIS_MAX_RAW_BYTES && dimsKnown && s.width! <= ANALYSIS_MAX_DIMENSION && s.height! <= ANALYSIS_MAX_DIMENSION;
  if (fits) return { quality: 'original', path: s.path, contentType: s.contentType };
  if (s.thumbPath) return { quality: 'studio_preview', path: s.thumbPath, contentType: 'image/jpeg' };
  return { unsupported: 'Orijinal API sınırını aşıyor ve önizleme yok' };
}

export interface AnalysisStore {
  get(key: string): Promise<AnalysisRecord | null>;
  /** Transaction: koşul sağlanırsa yazar ve true döner */
  claim(key: string, init: AnalysisRecord, now: number): Promise<{ claimed: boolean; record: AnalysisRecord }>;
  /** Fenced: yalnız leaseOwner eşleşirse yazar; değilse false (eski çalıştırıcı sonucu yazamaz) */
  update(key: string, owner: string, patch: Partial<AnalysisRecord>): Promise<boolean>;
  setLatest(tenantId: string, projectId: string, sourceId: string, key: string): Promise<void>;
}

export interface ModelCallResult {
  id: string;
  stopReason: string | null;
  /** Modelin ham JSON çıktısı ({catalog, visual}); doğrulama runner'da (parseAnalysisOutput) */
  parsed: unknown | null;
  provider?: 'openrouter';
  modelUsed?: string | null;
  requestId?: string | null;
  usageDetail?: CopyUsage | null;
}

export type ModelCall = (p: { model: string; imageBase64: string; mediaType: string }) => Promise<ModelCallResult>;

export interface AnalysisDeps {
  store: AnalysisStore;
  readBytes: (path: string) => Promise<Buffer>;
  callModel: ModelCall;
  now?: () => number;
}

/** Hata → yeniden denenebilir mi (429/5xx/bağlantı) */
export function isRetryableModelError(e: any): boolean {
  const status = typeof e?.status === 'number' ? e.status : null;
  if (status === null) return e?.code !== 'no_api_key'; // bağlantı/zaman aşımı; anahtar yokluğu yeniden denemeyle düzelmez
  return status === 408 || status === 429 || status === 529 || status >= 500;
}

/**
 * Fırlatılan hatadan SAKLANACAK güvenli kaydı üretir. e.message ASLA kopyalanmaz (depolama/ağ/SDK hataları yol, kimlik veya
 * içerik taşıyabilir): sağlayıcı hatası adaptörün allowlist'li `failure` alanından, diğerleri sabit iletilerden kurulur.
 */
export function failureOf(e: any): SafeAnalysisError {
  const f = sanitizeStoredError(e?.failure);
  if (f && e?.failure) return f;
  if (e?.code === 'no_api_key') return { code: 'no_api_key', message: NO_API_KEY_MESSAGE };
  if (e?.code === 'bad_media_type') return { code: 'bad_media_type', message: BAD_MEDIA_TYPE_MESSAGE, status: 400 };
  const status = safeStatus(e?.status);
  if (status) {
    // failure taşımayan eski/başka adaptör: yalnız durum → kategori
    const category = status === 401 || status === 403 ? 'auth' : status === 402 ? 'credits' : status === 429 ? 'rate_limit' : status >= 500 ? 'upstream_error' : 'bad_request';
    return { code: `http_${status}`, message: CATEGORY_MESSAGES[category], category, status };
  }
  const timeout = e?.name === 'AbortError';
  return { code: 'network', message: timeout ? CATEGORY_MESSAGES.timeout : NETWORK_MESSAGE, ...(timeout ? { category: 'timeout' as const } : {}) };
}

export async function analyzeBrandMedia(asset: BrandMediaLike, deps: AnalysisDeps, model = CATALOG_MODEL): Promise<AnalysisRecord> {
  const now = deps.now || Date.now;
  const sel = selectAnalysisSource(asset);
  if ('unsupported' in sel) {
    return {
      key: '',
      tenantId: asset.tenantId,
      projectId: asset.projectId,
      sourceKind: 'brand_media',
      sourceId: asset.id,
      sourceQuality: 'original',
      sourcePath: asset.storage.path,
      sourceSha256: '',
      model,
      promptVersion: MEDIA_ANALYSIS_PROMPT_VERSION,
      schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
      status: 'unsupported',
      attempts: 0,
      error: { code: 'unsupported', message: sel.unsupported },
      createdAt: now(),
      updatedAt: now(),
    };
  }
  const bytes = await deps.readBytes(sel.path);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const key = analysisKey({ tenantId: asset.tenantId, projectId: asset.projectId, sourceKind: 'brand_media', sourceId: asset.id, sourceSha256: sha, sourceQuality: sel.quality, model });
  const init: AnalysisRecord = {
    key,
    tenantId: asset.tenantId,
    projectId: asset.projectId,
    sourceKind: 'brand_media',
    sourceId: asset.id,
    sourceQuality: sel.quality,
    sourcePath: sel.path,
    sourceSha256: sha,
    ...(sel.quality === 'original' ? { sourceWidth: asset.storage.width, sourceHeight: asset.storage.height } : {}),
    model,
    promptVersion: MEDIA_ANALYSIS_PROMPT_VERSION,
    schemaVersion: MEDIA_ANALYSIS_SCHEMA_VERSION,
    catalogSchemaVersion: CATALOG_FIELDS_SCHEMA_VERSION,
    visualSchemaVersion: VISUAL_SCHEMA_VERSION,
    visualPromptVersion: VISUAL_PROMPT_VERSION,
    status: 'running',
    attempts: 1,
    leaseUntil: now() + ANALYSIS_LEASE_MS,
    leaseOwner: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  const { claimed, record } = await deps.store.claim(key, init, now());
  if (!claimed) return record; // tamamlanmış, kalıcı hata, deneme sınırı veya başka çalıştırıcı
  const owner = record.leaseOwner!;
  await deps.store.setLatest(asset.tenantId, asset.projectId, asset.id, key);

  const started = now();
  try {
    const res = await deps.callModel({ model, imageBase64: bytes.toString('base64'), mediaType: sel.contentType });
    const base = {
      usageDetail: res.usageDetail ?? null,
      costUsd: res.usageDetail?.costUsd ?? null,
      provider: res.provider ?? null,
      modelUsed: res.modelUsed ?? null,
      requestId: safeRequestId(res.requestId), // kalıcı kayıt doğrulanmamış kimlik saklamaz (safeRequestId şimdilik daima null; fail-closed)
      stopReason: res.stopReason,
      responseId: res.id,
      durationMs: now() - started,
      leaseUntil: null,
      leaseOwner: null,
      updatedAt: now(),
    };
    const out = res.parsed == null ? null : parseAnalysisOutput(res.parsed);
    if (res.stopReason === 'refusal') {
      await deps.store.update(key, owner, { ...base, status: 'failed', retryable: false, result: null, visual: null, error: { code: 'refusal', message: REFUSAL_MESSAGE } });
    } else if (!out || !out.ok) {
      const truncated = res.stopReason === 'max_tokens';
      await deps.store.update(key, owner, { ...base, status: 'failed', retryable: truncated, result: null, visual: null, error: { code: truncated ? 'truncated' : 'schema_invalid', message: SCHEMA_INVALID_MESSAGE } });
    } else {
      await deps.store.update(key, owner, {
        ...base,
        status: 'done',
        retryable: false,
        result: normalizeCatalog(out.catalog),
        visual: out.visual,
        visualStatus: out.visualStatus,
        visualIssue: out.visualIssue,
        error: null,
      });
    }
  } catch (e: any) {
    await deps.store.update(key, owner, {
      status: 'failed',
      retryable: isRetryableModelError(e),
      leaseUntil: null,
      leaseOwner: null,
      durationMs: now() - started,
      error: failureOf(e),
      updatedAt: now(),
    });
  }
  return (await deps.store.get(key))!;
}

/**
 * claim kararı (saf): ne zaman yeni bir ücretli çağrı başlatılabilir.
 * 'exhaust': süresi geçmiş yarım deneme var ama deneme sınırı doldu → çağrı yok, kayıt failed yapılır.
 */
export function decideClaim(existing: AnalysisRecord | null, now: number): 'new' | 'retry' | 'skip' | 'exhaust' {
  if (!existing) return 'new';
  if (existing.status === 'done' || existing.status === 'unsupported') return 'skip';
  if (existing.status === 'running') {
    if ((existing.leaseUntil || 0) > now) return 'skip';
    return existing.attempts < MAX_ANALYSIS_ATTEMPTS ? 'retry' : 'exhaust';
  }
  if (existing.status === 'failed') return existing.retryable && existing.attempts < MAX_ANALYSIS_ATTEMPTS ? 'retry' : 'skip';
  return 'skip';
}

export function firestoreAnalysisStore(db: any): AnalysisStore {
  const ref = (k: string) => db.collection('media_ai_analyses').doc(k);
  return {
    async get(k) {
      const s = await ref(k).get();
      return s.exists ? (s.data() as AnalysisRecord) : null;
    },
    async claim(k, init, now) {
      return db.runTransaction(async (tx: any) => {
        const s = await tx.get(ref(k));
        const existing = s.exists ? (s.data() as AnalysisRecord) : null;
        const d = decideClaim(existing, now);
        if (d === 'skip') return { claimed: false, record: existing! };
        if (d === 'exhaust') {
          const closed = { ...existing!, status: 'failed' as const, retryable: false, leaseUntil: null, leaseOwner: null, error: { code: 'attempts_exhausted', message: EXHAUSTED_MESSAGE }, updatedAt: now };
          tx.set(ref(k), closed);
          return { claimed: false, record: closed };
        }
        const rec = d === 'new' ? init : { ...existing!, status: 'running' as const, attempts: existing!.attempts + 1, leaseUntil: init.leaseUntil, leaseOwner: init.leaseOwner, error: null, updatedAt: now };
        tx.set(ref(k), rec);
        return { claimed: true, record: rec };
      });
    },
    async update(k, owner, patch) {
      return db.runTransaction(async (tx: any) => {
        const s = await tx.get(ref(k));
        if (!s.exists || s.data().leaseOwner !== owner) return false;
        tx.update(ref(k), patch);
        return true;
      });
    },
    async setLatest(tenantId, projectId, sourceId, k) {
      await db.collection('media_ai_analysis_latest').doc(`${tenantId}_${projectId}_${sourceId}`).set({ tenantId, projectId, sourceId, key: k, updatedAt: Date.now() });
    },
  };
}
