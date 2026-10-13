/**
 * Medya analizi model çağrısı — OpenRouter görsel girişi + yapılandırılmış (strict JSON Schema) yanıt.
 * Plan metin üretimiyle (planCopy/openrouterCopyCall) AYNI sağlayıcı ve ayarlar: tek uç nokta, tek anahtar
 * (OPENROUTER_API_KEY), sessiz sağlayıcı/model yedeği YOK.
 *
 * Doğrulanan resmi kaynaklar (okunma 2026-10-12, yalnız kamuya açık doküman/katalog; çıkarım çağrısı yapılmadı):
 *  - https://openrouter.ai/api/v1/models        anthropic/claude-haiku-5.5 ve anthropic/claude-sonnet-5.5: input_modalities ⊇ [image],
 *                                               supported_parameters ⊇ [response_format, structured_outputs, max_tokens, reasoning]
 *  - https://openrouter.ai/docs/guides/overview/multimodal/image-understanding.md   image_url (URL veya base64 data URL),
 *                                               PNG/JPEG/WebP/GIF; metin önce, görsel sonra önerilir
 *  - https://openrouter.ai/docs/guides/features/structured-outputs.md   response_format json_schema + strict; require_parameters
 * Not: Sonnet 5.5'te akıl yürütme ZORUNLUDUR (katalog: reasoning.mandatory=true) ve çıktı bütçesinden harcanır.
 *
 * Yönlendirme: allow_fallbacks=false, require_parameters=true. Yeniden deneme YOK (çift faturalama riski); yeniden deneme
 * runner/kuyruk sayacıyla görünür ve sınırlı yapılır. Maliyet SAĞLAYICININ bildirdiği usage.cost'tur; yerel tahmin yoktur.
 * Anahtar yalnız Authorization başlığında kullanılır; log/hata/yanıta ASLA yazılmaz. Görsel baytı yalnız bu istek gövdesinde gider.
 */
import { z } from 'zod/v4';
import { OPENROUTER_URL, OpenRouterError, normalizeUsage } from '../planCopy/openrouterCopyCall.js';
import { ANALYSIS_USER_PROMPT, AnalysisOutputSchema, VISUAL_SYSTEM_PROMPT } from './visualSpec.js';
import { CATALOG_SYSTEM_PROMPT } from './spec.js';
import type { ModelCall } from './runner.js';
import { buildProviderFailure, safeRequestId, safeStatus } from '../../../shared/mediaAnalysisError.js';

export const ANALYSIS_SCHEMA_NAME = 'media_analysis_output';
export const ANALYSIS_SYSTEM_PROMPT = `${CATALOG_SYSTEM_PROMPT}\n${VISUAL_SYSTEM_PROMPT}`;
export const CATALOG_REASONING_EFFORT = 'medium' as const;
export const CATALOG_MAX_TOKENS = 12_000;
/** Tek istek üst sınırı (yeniden deneme yok → toplam çağrı süresi de bu) */
export const CATALOG_TIMEOUT_MS = 120_000;

/** zod şemasından (tek doğruluk kaynağı) strict JSON Schema; OpenRouter/OpenAI biçimi: $schema yok */
export function analysisJsonSchema(): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(AnalysisOutputSchema, { target: 'draft-7', reused: 'inline' }) as Record<string, unknown>;
  void $schema;
  return rest;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export interface OpenRouterVisionDeps {
  fetchImpl?: typeof fetch;
  /** Test için; yoksa process.env.OPENROUTER_API_KEY (çağrı anında okunur) */
  apiKey?: string;
  timeoutMs?: number;
  maxTokens?: number;
  referer?: string;
}

function stopReasonOf(choice: any): string | null {
  if (choice?.message?.refusal) return 'refusal';
  switch (choice?.finish_reason) {
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'content_filter': return 'refusal';
    default: return choice?.finish_reason ?? null;
  }
}

export function openrouterVisionCall(deps: OpenRouterVisionDeps = {}): ModelCall {
  const schema = analysisJsonSchema();
  return async ({ model, imageBase64, mediaType }) => {
    const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey || !apiKey.trim()) throw new OpenRouterError('OPENROUTER_API_KEY tanımlı değil', null, 'no_api_key');
    if (!ALLOWED_MIME.has(mediaType)) throw new OpenRouterError('Desteklenmeyen görsel türü', 400, 'bad_media_type');
    const doFetch = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? CATALOG_TIMEOUT_MS);
    try {
      const res = await doFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': deps.referer ?? 'https://intiba.co',
          'X-Title': 'Intiba Studio media analysis',
        },
        body: JSON.stringify({
          model,
          max_tokens: deps.maxTokens ?? CATALOG_MAX_TOKENS,
          reasoning: { effort: CATALOG_REASONING_EFFORT },
          messages: [
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            { role: 'user', content: [{ type: 'text', text: ANALYSIS_USER_PROMPT }, { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } }] },
          ],
          response_format: { type: 'json_schema', json_schema: { name: ANALYSIS_SCHEMA_NAME, strict: true, schema } },
          provider: { allow_fallbacks: false, require_parameters: true },
          usage: { include: true },
        }),
        signal: controller.signal,
      });
      const requestId = res.headers?.get?.('x-request-id') ?? null;
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      // Gövde/serbest sağlayıcı metni (olası hassas içerik) mesaja KOPYALANMAZ ve saklanmaz: yalnız allowlist'li kategori, durum,
      // istek kimliği ve istenen model (shared/mediaAnalysisError). Bilinmeyen/ayrıştırılamayan gövde → genel güvenli açıklama.
      // OpenRouterError'un TÜM sayılabilir alanları (status, code, failure) bounded/exact güvenli değerlerdir: sağlayıcının ham `error.code`
      // değeri (özel/uzun/nested/sır olabilir) hiçbir alana taşınmaz; JSON.stringify(error) de sızdıramaz. Metin sabittir.
      if (!res.ok) {
        const f = buildProviderFailure({ status: res.status, body: data, requestId, model });
        throw new OpenRouterError(`OpenRouter isteği başarısız (${safeStatus(res.status) ?? 'bilinmiyor'})`, safeStatus(res.status), f.code, f);
      }
      if (data?.error) {
        const f = buildProviderFailure({ status: null, body: data, requestId, model, inBody: true });
        throw new OpenRouterError('OpenRouter hata döndürdü', f.status ?? null, f.code, f);
      }
      const choice = data?.choices?.[0];
      let parsed: unknown = null;
      const content = choice?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = null;
        }
      }
      return {
        id: typeof data?.id === 'string' ? data.id : '',
        stopReason: stopReasonOf(choice),
        parsed,
        provider: 'openrouter',
        modelUsed: typeof data?.model === 'string' ? data.model : null,
        requestId: safeRequestId(requestId), // belgeli sözleşme yok → şimdilik daima null (fail-closed); sözleşme kanıtlanırsa safeRequestId genişler
        usageDetail: normalizeUsage(data?.usage),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
