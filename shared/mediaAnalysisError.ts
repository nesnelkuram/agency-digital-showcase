/**
 * Medya analizi hata tanılaması — GÜVENLİ, allowlist'li hata modeli (bağımlılıksız; sunucu ve istemci aynı kuralı kullanır).
 *
 * İlke (fail-closed): sağlayıcının serbest metni (error.message, metadata, ham gövde) ASLA kopyalanmaz, saklanmaz, gösterilmez.
 * Ham metin yalnız SINIFLANDIRMA için okunur (anahtar sözcük → kategori); çıktı her zaman bu dosyadaki SABİT açıklamadır.
 * Bu yüzden regex ile "sır maskeleme" yoktur: hassas içerik çıktıya zaten geçemez. Bilinmeyen/ayrıştırılamayan hata →
 * `bad_request`/`unknown` genel açıklaması. `code` ve `model` EXACT allowlist'ten (bilinen yerel kodlar + http_100..599; izinli model kimlikleri)
 * geçer; biçim eşleşmesi yeterli sayılmaz. requestId bu sürümde daima OMIT edilir (bkz. safeRequestId, fail-closed); bilinmeyen
 * biçim OMIT edilir, kırpma toleransı yoktur. KATEGORİ bir TANILAMA SINIFLANDIRMASIDIR (anahtar sözcük), kesin kök neden DEĞİLDİR:
 * birden çok kategoriyi çağrıştıran ya da tanınmayan metin `bad_request` (sınıflandırılamadı) olur.
 */

export const FAILURE_CATEGORIES = [
  'schema_unsupported', // yapılandırılmış çıktı (json_schema/response_format) kabul edilmedi
  'schema_too_complex', // şema sağlayıcının derleme/karmaşıklık sınırını aştı
  'parameter_unsupported', // istek parametresi (reasoning/max_tokens/...) desteklenmiyor
  'routing_unavailable', // require_parameters ile uyumlu sağlayıcı/uç nokta yok
  'image_rejected', // görsel türü/boyutu/içeriği kabul edilmedi
  'input_too_large', // bağlam/token sınırı
  'model_unavailable', // model bulunamadı/geçersiz
  'moderation', // içerik politikası
  'auth', // anahtar/yetki
  'credits', // bakiye/kota
  'rate_limit',
  'timeout',
  'upstream_error', // sağlayıcı 5xx
  'bad_request', // 4xx, nedeni sınıflandırılamadı (genel)
  'unknown',
] as const;
export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];
const CATEGORY_SET = new Set<string>(FAILURE_CATEGORIES);

/** Kategori → SABİT, güvenli Türkçe açıklama (sağlayıcı metni içermez). `Olası` ifadeler sınıflandırmanın kesin kök neden olmadığını belirtir */
export const CATEGORY_MESSAGES: Record<FailureCategory, string> = {
  schema_unsupported: 'Olası neden: sağlayıcı yapılandırılmış (JSON şema) çıktı isteğini kabul etmedi',
  schema_too_complex: 'Olası neden: çıktı şeması sağlayıcının karmaşıklık/derleme sınırını aştı',
  parameter_unsupported: 'Olası neden: sağlayıcı isteğin bir parametresini desteklemiyor',
  routing_unavailable: 'Olası neden: istenen parametreleri destekleyen uygun sağlayıcı/uç nokta bulunamadı',
  image_rejected: 'Olası neden: sağlayıcı görseli kabul etmedi (tür, boyut veya içerik)',
  input_too_large: 'Olası neden: istek sağlayıcının bağlam/boyut sınırını aştı',
  model_unavailable: 'Olası neden: istenen model sağlayıcıda kullanılamıyor',
  moderation: 'Olası neden: sağlayıcı isteği içerik politikası nedeniyle reddetti',
  auth: 'Sağlayıcı kimlik doğrulamayı reddetti (anahtar/yetki)',
  credits: 'Sağlayıcı hesabında bakiye/kota yetersiz',
  rate_limit: 'Sağlayıcı istek sınırına ulaştı (çok sık istek)',
  timeout: 'Sağlayıcı zamanında yanıt vermedi',
  upstream_error: 'Sağlayıcı tarafında geçici bir hata oluştu',
  bad_request: 'Sağlayıcı isteği reddetti; neden güvenle sınıflandırılamadı (ayrıntı güvenlik nedeniyle gösterilmiyor)',
  unknown: 'Analiz tamamlanamadı; ayrıntı güvenlik nedeniyle gösterilmiyor',
};

export const NETWORK_MESSAGE = 'Sağlayıcıya ulaşılamadı veya bağlantı zaman aşımına uğradı';
export const SOURCE_ERROR_MESSAGE = 'Kaynak görsel okunamadı veya iş tamamlanamadı';
export const REFUSAL_MESSAGE = 'Model bu görseli işlemeyi reddetti';
export const SCHEMA_INVALID_MESSAGE = 'Yapılandırılmış çıktı alınamadı';
export const EXHAUSTED_MESSAGE = 'Deneme sınırı doldu (yarım kalan çağrı)';
export const NO_API_KEY_MESSAGE = 'OPENROUTER_API_KEY tanımlı değil';
export const BAD_MEDIA_TYPE_MESSAGE = 'Desteklenmeyen görsel türü';
export const PROVIDER_ERROR_BODY_MESSAGE = 'OpenRouter hata döndürdü';
export const QUEUE_SKIP_MESSAGE = 'Varlık analize uygun değil';
export const GENERIC_STORED_MESSAGE = CATEGORY_MESSAGES.unknown;

/** Bu sürümün ve eski kayıtların YAZABİLDİĞİ sabit iletiler; liste dışı serbest metin okuma anında bile gösterilmez */
const KNOWN_MESSAGES = new Set<string>([
  ...Object.values(CATEGORY_MESSAGES),
  NETWORK_MESSAGE, SOURCE_ERROR_MESSAGE, REFUSAL_MESSAGE, SCHEMA_INVALID_MESSAGE, EXHAUSTED_MESSAGE, NO_API_KEY_MESSAGE, BAD_MEDIA_TYPE_MESSAGE,
  PROVIDER_ERROR_BODY_MESSAGE, QUEUE_SKIP_MESSAGE,
  'Yalnız fotoğraf analiz edilir', 'Arşivlenmiş dosya analiz edilmez', 'Orijinal API sınırını aşıyor ve önizleme yok',
]);
const LEGACY_HTTP_MESSAGE = /^OpenRouter isteği başarısız \(\d{3}\)$/;

export interface SafeAnalysisError {
  code: string;
  message: string;
  category?: FailureCategory;
  /** Sağlayıcı HTTP durumu (100–599) */
  status?: number;
  /** Sağlayıcının x-request-id değeri (biçim + boyut doğrulanmış, opak) */
  requestId?: string;
  /** İstenen model kimliği (biçim + boyut doğrulanmış) */
  model?: string;
}

/** Yerel (bu kod tabanının ürettiği) hata kodları — EXACT liste; sağlayıcıdan gelen kod değerleri asla saklanmaz */
export const KNOWN_LOCAL_CODES = [
  'unsupported', 'refusal', 'truncated', 'schema_invalid', 'attempts_exhausted', 'no_api_key', 'bad_media_type', 'network', 'provider_error',
  'source_error', 'feature_disabled', 'asset_mismatch', 'not_active_photo', 'unknown',
] as const;
const LOCAL_CODE_SET = new Set<string>(KNOWN_LOCAL_CODES);
/** Kod allowlist'i: bilinen yerel kodlar + doğrulanmış http_100..599 */
export function safeErrorCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (LOCAL_CODE_SET.has(v)) return v;
  const m = /^http_(\d{3})$/.exec(v);
  return m && safeStatus(m[1]) ? v : null;
}
/** İzinli medya analizi modelleri (api/_lib/mediaAnalysis/spec.ts ALLOWED_MEDIA_MODELS ile birebir; testle doğrulanır) */
export const ALLOWED_ERROR_MODELS = ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5'] as const;
const MODEL_SET = new Set<string>(ALLOWED_ERROR_MODELS);

export function safeStatus(v: unknown): number | null {
  const n = typeof v === 'string' && /^\d{3}$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 100 && n <= 599 ? n : null;
}
/**
 * İstek kimliği — FAIL-CLOSED: bu sürümde HİÇBİR değer kabul edilmez, daima null (alan OMIT edilir).
 * Neden: sağlayıcının `x-request-id` başlığı için belgeli tam biçim/kaynak eşleşmesi BULUNAMADI (OpenRouter dokümanı, okunma 2026-10-13:
 * `x-request-id` belgelenmemiş; belgeli olanlar `X-Generation-Id`/gövde `id` = üretim kimliği `gen-…` ve generation verisindeki
 * `request_id` = `req-…`; bu ikisi bu başlığın biçimi için KANIT DEĞİLDİR). Tahmini allowlist/heuristik (önek, uzunluk, harf dizisi)
 * keyfi özel metni (`req-Alice123`, `req-PRIVATE1`) geçirdiği için KULLANILMAZ. Üretim kimliği (generationId) ayrı bir kavramdır ve
 * requestId'ye KARIŞTIRILMAZ.
 * Gelecekte belgeli bir sözleşme (başlık adı + tam biçim) kanıtlanırsa yalnız bu fonksiyon exact sözleşmeyle genişletilir; çağıranlar
 * (adaptör, runner, uç nokta, hata kaydı) zaten buradan geçtiği için başka değişiklik gerekmez. Kimlik olmadan tanılama kategori +
 * durum + model ile sürer.
 */
export function safeRequestId(_v: unknown): string | null {
  return null;
}
export function safeModelId(v: unknown): string | null {
  return typeof v === 'string' && MODEL_SET.has(v) ? v : null;
}

/**
 * Ham metin → kategori (TANILAMA SINIFLANDIRMASI, kesin kök neden değil). Metin YALNIZ burada okunur, hiçbir yere kopyalanmaz.
 * Yalnız TEK kategoriyi çağrıştıran metin eşlenir; birden çok kategori (ör. "unexpected image in response_format") ya da hiçbiri → null
 * (çağıran `bad_request`: sınıflandırılamadı). Böylece anahtar sözcük çakışması yanlış kesinlik üretmez.
 */
const TEXT_RULES: Array<[FailureCategory, RegExp, boolean]> = [
  // [kategori, desen, zayıf mı]: zayıf kurallar yalnız başka hiçbir (güçlü) kural eşleşmediğinde sayılır
  ['moderation', /moderation|flagged|content[ _-]?policy|safety|prohibited/, false],
  ['routing_unavailable', /no endpoints? found|require_parameters|no allowed providers/, false],
  ['input_too_large', /context[ _-]?(length|window)|too many tokens|maximum context|prompt is too long|token limit/, false],
  ['image_rejected', /image|media[ _-]?type|base64|mime|payload too large|request entity|exceeds? .{0,20}(mb|megabyte|bytes)|too large/, false],
  ['schema_unsupported', /json[ _-]?schema|response[ _-]?format|structured|schema/, false],
  ['model_unavailable', /model.*(not found|not exist|invalid|unavailable|unknown)|invalid model|unknown model/, false],
  ['parameter_unsupported', /parameter|reasoning|max_tokens|unsupported|not supported|temperature|unrecognized/, true],
];
function classifyText(raw: string): FailureCategory | null {
  const t = raw.toLowerCase().slice(0, 4000);
  // Bilinen sağlayıcı ifadeleri ("schema is too complex for compilation", "compiled grammar is too large"): şema kategorisinin özel hâli
  if (/(schema|grammar).{0,40}(too (complex|large|big)|exceed)|too (complex|large).{0,40}(schema|grammar|compil)|union types?/.test(t)) {
    return /image|base64|mime|media[ _-]?type/.test(t) ? null : 'schema_too_complex';
  }
  const strong = TEXT_RULES.filter(([, re, weak]) => !weak && re.test(t)).map(([c]) => c);
  // "No endpoints found … response_format/parameters" yönlendirme hatasının bilinen biçimi: şema/parametre sözcükleri onu bozmaz
  if (strong.includes('routing_unavailable')) return strong.every((c) => c === 'routing_unavailable' || c === 'schema_unsupported') ? 'routing_unavailable' : null;
  if (strong.length) return strong.length === 1 ? strong[0] : null;
  const weak = TEXT_RULES.filter(([, re, w]) => w && re.test(t)).map(([c]) => c);
  return weak.length === 1 ? weak[0] : null;
}

/** OpenRouter'ın BELGELİ `error.metadata.error_type` değerleri (docs: Typed error codes, HTTP 400) → kategori. EXACT eşleşme; başka değer yok sayılır. */
const ERROR_TYPE_CATEGORY: Record<string, FailureCategory> = {
  context_length_exceeded: 'input_too_large',
  max_tokens_exceeded: 'input_too_large',
  token_limit_exceeded: 'input_too_large',
  string_too_long: 'input_too_large',
  invalid_image: 'image_rejected',
  image_too_large: 'image_rejected',
  image_too_small: 'image_rejected',
  unsupported_image_format: 'image_rejected',
  image_download_failed: 'image_rejected',
};

/** Serbest `metadata.raw` (dize ya da nesne) yalnız SINIFLANDIRMA için düzleştirilir; kopyalanmaz, saklanmaz */
function flattenForClassification(v: unknown, depth = 0): string {
  if (typeof v === 'string') return v.slice(0, 2000);
  if (!v || typeof v !== 'object' || depth > 3) return '';
  let out = '';
  for (const x of Object.values(v as Record<string, unknown>).slice(0, 20)) { out += ' ' + flattenForClassification(x, depth + 1); if (out.length > 4000) break; }
  return out;
}

export function classifyProviderFailure(status: number | null, body: unknown): FailureCategory {
  if (status === 401) return 'auth';
  if (status === 402) return 'credits';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'rate_limit';
  if (status !== null && status >= 500) return 'upstream_error';
  // 400/403/404/413/422 ve gövde-içi hatalar: nedeni yalnız sağlayıcı alanlarından SINIFLANDIR (kopyalama yok)
  const err = body && typeof body === 'object' ? (body as any).error : null;
  if (err && typeof err === 'object') {
    const typed = typeof err.metadata?.error_type === 'string' ? ERROR_TYPE_CATEGORY[err.metadata.error_type] : undefined;
    if (typed) return typed;
    const parts = [err.message, err.type, err.param, typeof err.code === 'string' ? err.code : null, err.metadata?.reasons ? 'moderation' : null, flattenForClassification(err.metadata?.raw)]
      .filter((x) => typeof x === 'string')
      .join(' ');
    const c = classifyText(parts);
    if (c) return c;
  }
  if (status === 403) return 'auth';
  if (status === 413) return 'image_rejected';
  return status === null ? 'unknown' : 'bad_request';
}

/** Sağlayıcı yanıtından güvenli hata kaydı üretir (kod `http_<durum>` geriye uyumludur) */
export function buildProviderFailure(p: { status: number | null; body: unknown; requestId?: unknown; model?: unknown; inBody?: boolean }): SafeAnalysisError {
  const status = safeStatus(p.status) ?? (p.inBody && p.body && typeof p.body === 'object' ? safeStatus((p.body as any).error?.code) : null);
  const category = classifyProviderFailure(status, p.body);
  const out: SafeAnalysisError = { code: status ? `http_${status}` : 'provider_error', message: CATEGORY_MESSAGES[category], category };
  if (status) out.status = status;
  const rid = safeRequestId(p.requestId);
  if (rid) out.requestId = rid;
  const model = safeModelId(p.model);
  if (model) out.model = model;
  return out;
}

/**
 * Saklı/yanıtlanacak hatanın allowlist'li izdüşümü: kod/kategori/durum/requestId/model yeniden doğrulanır, iletiler yalnız bilinen
 * sabitlerden geçer; diğer her şey (eski kayıtlardaki serbest metin dahil) genel güvenli açıklamaya düşer. Başka alan taşınmaz.
 */
export function sanitizeStoredError(raw: unknown): SafeAnalysisError | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = safeErrorCode(r.code) ?? 'unknown';
  const category = typeof r.category === 'string' && CATEGORY_SET.has(r.category) ? (r.category as FailureCategory) : undefined;
  const msg = typeof r.message === 'string' ? r.message : '';
  const message = KNOWN_MESSAGES.has(msg) || LEGACY_HTTP_MESSAGE.test(msg) ? msg : category ? CATEGORY_MESSAGES[category] : GENERIC_STORED_MESSAGE;
  const out: SafeAnalysisError = { code, message };
  if (category) out.category = category;
  const status = safeStatus(r.status);
  if (status) out.status = status;
  const rid = safeRequestId(r.requestId);
  if (rid) out.requestId = rid;
  const model = safeModelId(r.model);
  if (model) out.model = model;
  return out;
}

/** İstemci gösterimi: görsel analizi (sağlayıcı) hatası; ham kayıt değil allowlist'li alanlardan kurulur */
export function describeAnalysisFailure(raw: unknown): string {
  const e = sanitizeStoredError(raw);
  if (!e) return 'Görsel analizi tamamlanamadı (ayrıntı kaydedilmemiş).';
  const bits = [e.status ? `HTTP ${e.status}` : null, e.model ? `model ${e.model}` : null, e.requestId ? `istek kimliği ${e.requestId}` : null].filter(Boolean);
  const legacy = !e.category && /^http_\d{3}$/.test(e.code) ? ' Bu kayıt tanılama eklenmeden önce oluştu; nedeni kaydedilmemiş, yeniden analiz edilince ayrıntı görünür.' : '';
  return `Görsel analizi başarısız: ${e.message}${bits.length ? ` (${bits.join(' · ')})` : ''}.${legacy}`;
}
