/**
 * Tipli görsel karar adaptörü arayüzü (Clef / Clef-flash için HAZIRLIK). BAĞLI DEĞİLDİR: Cloudflare hesabı/anahtarı yok,
 * ağ çağrısı yok; bu yüzden `connected:false` ve her `decide()` açık hata verir. Çalışıyor gibi sunulmaz.
 *
 * Sınırlar resmi Cloudflare Workers AI model sayfasından (okunma 2026-10-12,
 * https://developers.cloudflare.com/workers-ai/models/clef-flash/): model kimliği `@cf/cloudflare/clef-flash`;
 * isteğe bağlı `images` EN FAZLA 4 (maxItems:4); PNG/JPEG/WebP; uzak URL KABUL EDİLMEZ; görsel başına ≤4 MiB ve ≤16 megapiksel,
 * toplam çözülmüş ≤8 MiB, istek gövdesi ≤13 MiB; bağlam 24.576 token (medya + sorular dahil); 1–64 tipli soru, kimlik ≤100 karakter
 * [A-Za-z0-9_.-]; soru tipleri `noul` | `choice` | `score`; yanıt metin değil, soru kimliğine göre OLASILIK döndürür.
 *
 * JEV — iki AYRI şey (resmi kaynak: https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints ve /api/v1/models, okunma 2026-10-12):
 *  - `typesafe/jev-1.13` (alias `~typesafe/jev-latest`; kanonik uç nokta `typesafe/jev-1.13-20260917`): TypeSafe'in YAPILANDIRILMIŞ KARAR modeli.
 *    modality `text->decisions`, giriş YALNIZ metin, çıkış tipli karar; bağlam 64.000, en çok 32.000 istem tokenı. Görsel adaptörü DEĞİLDİR.
 *  - `typesafe/jev-router`: çok kipli (audio/file/image/text/video girişli, metin çıkışlı) YÖNLENDİRİCİDİR; JEV karar modeli değildir ve burada
 *    kullanılmaz (metin-only diye de tanıtılmaz).
 * Bu dosyadaki JEV adaptörü `typesafe/jev-1.13` içindir: metin girişli karar; görsel içeren istek reddedilir. BAĞLI DEĞİLDİR.
 */

export const CLEF_FLASH_MODEL = '@cf/cloudflare/clef-flash';
/** Doğrulanmış JEV karar modeli (OpenRouter). Alias: ~typesafe/jev-latest. Yönlendirici (typesafe/jev-router) AYRI bir üründür. */
export const JEV_DECISION_MODEL = 'typesafe/jev-1.13';
export const JEV_ROUTER_ID = 'typesafe/jev-router';
export const JEV_LIMITS = { contextTokens: 64_000, maxPromptTokens: 32_000, inputModalities: ['text'] as readonly string[], outputModality: 'decisions' } as const;
export const CLEF_LIMITS = {
  maxImages: 4,
  imageTypes: ['image/png', 'image/jpeg', 'image/webp'] as readonly string[],
  maxImageBytes: 4 * 1024 * 1024,
  maxImagePixels: 16_000_000,
  maxTotalDecodedBytes: 8 * 1024 * 1024,
  maxBodyBytes: 13 * 1024 * 1024,
  contextTokens: 24_576,
  minQuestions: 1,
  maxQuestions: 64,
  maxQuestionIdLength: 100,
  /** Her 32×32 blok 1 token + 3 işaretleyici; görsel başına en çok 1.024 token */
  maxTokensPerImage: 1024,
} as const;

export type QuestionType = 'noul' | 'choice' | 'score';
export interface TypedQuestion {
  id: string;
  type: QuestionType;
  /** choice için izinli seçenekler */
  options?: string[];
}
export interface DecisionImage {
  mediaId: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  /** Uzak URL KABUL EDİLMEZ; baytlar çağıran tarafından (yetkili okuma) verilir */
  remoteUrl?: string;
}
export interface DecisionRequest {
  state: string | Record<string, unknown> | unknown[];
  images: DecisionImage[];
  questions: TypedQuestion[];
}
export interface DecisionAnswer {
  id: string;
  type: QuestionType;
  /** choice: seçenek → olasılık; noul/score: tek olasılık/skor */
  probabilities?: Record<string, number>;
  score?: number;
}
export interface DecisionResult {
  model: string;
  answers: DecisionAnswer[];
}

export class DecisionAdapterError extends Error {
  constructor(public code: 'not_connected' | 'text_only' | 'invalid_request', message: string, public details?: string[]) {
    super(message);
  }
}

export interface DecisionAdapter {
  id: string;
  kind: 'vision_decision' | 'text_decision';
  /** false: gerçek bir uç noktaya bağlı DEĞİL (stub). true yalnız gerçek bağlantı kurulunca. */
  connected: boolean;
  maxImages: number;
  decide(req: DecisionRequest): Promise<DecisionResult>;
}

const ID_RE = /^[A-Za-z0-9_.-]+$/;

/** Saf istek doğrulaması (ağ yok): resmi Clef sınırlarına karşı. */
export function validateDecisionRequest(req: DecisionRequest, limits = CLEF_LIMITS): { ok: true } | { ok: false; errors: string[] } {
  const e: string[] = [];
  if (req.images.length > limits.maxImages) e.push(`en fazla ${limits.maxImages} görsel (verilen ${req.images.length})`);
  let total = 0;
  for (const im of req.images) {
    if (im.remoteUrl) e.push(`${im.mediaId}: uzak URL kabul edilmez`);
    if (!limits.imageTypes.includes(im.mime)) e.push(`${im.mediaId}: tür ${im.mime} desteklenmiyor (PNG/JPEG/WebP)`);
    if (im.bytes > limits.maxImageBytes) e.push(`${im.mediaId}: ${limits.maxImageBytes / 1024 / 1024} MiB sınırını aşıyor`);
    if (im.width * im.height > limits.maxImagePixels) e.push(`${im.mediaId}: 16 megapiksel sınırını aşıyor`);
    total += im.bytes;
  }
  if (total > limits.maxTotalDecodedBytes) e.push('toplam görsel boyutu 8 MiB sınırını aşıyor');
  if (req.questions.length < limits.minQuestions || req.questions.length > limits.maxQuestions) e.push(`soru sayısı ${limits.minQuestions}-${limits.maxQuestions} olmalı`);
  const seen = new Set<string>();
  for (const q of req.questions) {
    if (!q.id || q.id.length > limits.maxQuestionIdLength || !ID_RE.test(q.id)) e.push(`soru kimliği geçersiz: ${q.id.slice(0, 20)}`);
    if (seen.has(q.id)) e.push(`soru kimliği yinelenmiş: ${q.id.slice(0, 20)}`);
    seen.add(q.id);
    if (q.type !== 'noul' && q.type !== 'choice' && q.type !== 'score') e.push(`${q.id}: soru tipi geçersiz`);
    if (q.type === 'choice' && (!q.options || q.options.length < 2)) e.push(`${q.id}: choice için en az 2 seçenek gerekir`);
  }
  return e.length ? { ok: false, errors: e } : { ok: true };
}

/** Clef-flash adaptörü — BAĞLI DEĞİL (stub). Cloudflare hesabı/anahtarı oluşturulmadı. */
export const clefFlashAdapter: DecisionAdapter = {
  id: CLEF_FLASH_MODEL,
  kind: 'vision_decision',
  connected: false,
  maxImages: CLEF_LIMITS.maxImages,
  async decide(req) {
    const v = validateDecisionRequest(req);
    if (!v.ok) throw new DecisionAdapterError('invalid_request', 'İstek Clef sınırlarına uymuyor.', v.errors);
    throw new DecisionAdapterError('not_connected', 'Clef-flash adaptörü bağlı değil (Cloudflare hesabı/anahtarı yok); karar üretilmedi.');
  },
};

/** JEV karar modeli (typesafe/jev-1.13) — METİN girişli yapılandırılmış karar. BAĞLI DEĞİL (stub). Görsel içeren istek reddedilir. */
export const jevDecisionAdapter: DecisionAdapter = {
  id: JEV_DECISION_MODEL,
  kind: 'text_decision',
  connected: false,
  maxImages: 0,
  async decide(req) {
    if (req.images.length) throw new DecisionAdapterError('text_only', 'JEV karar modeli (typesafe/jev-1.13) yalnız metin girişlidir; görsel içeren istek reddedildi.');
    throw new DecisionAdapterError('not_connected', 'JEV adaptörü bağlı değil; karar üretilmedi.');
  },
};
