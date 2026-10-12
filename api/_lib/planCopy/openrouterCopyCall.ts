/**
 * Planlayıcı metin üretimi — OpenRouter adaptörü (CopyModelCall). Bu akışta doğrudan Anthropic çağrısı ve Anthropic'e
 * ücretli yedekleme YOKTUR: tek uç nokta OPENROUTER_URL, tek anahtar sunucudaki OPENROUTER_API_KEY.
 *
 * Korunanlar (ai-router.callOpenRouter yalnız metin döndürür; burada kaybolmaz):
 *  - yapılandırılmış çıktı: JSON Schema (strict) istenir, dönen içerik YİNE de CopyOutputSchema ile sunucuda doğrulanır
 *  - yanıt kimliği (gen-…), isteğe bağlı istek başlığı kimliği, GERÇEKTEN çalışan model
 *  - usage ve sağlayıcının bildirdiği maliyet (usage.cost); yerel maliyet tahmini YAPILMAZ
 * Yönlendirme: allow_fallbacks=false (başka sağlayıcıya sessiz geçiş yok), require_parameters=true (json_schema'yı
 * desteklemeyen sağlayıcıya düşme yok), `models` yedek listesi gönderilmez. Yeniden deneme YOK (çift faturalama riski).
 * Anahtar yalnız Authorization başlığında kullanılır; log/hata/yanıta ASLA yazılmaz.
 */
import { z } from 'zod/v4';
import { CopyOutputSchema, type CopyModelCall, type CopyUsage } from './planCopy.js';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const COPY_MAX_TOKENS = 6000;
/** vercel.json plan-copy maxDuration=120 sn; model çağrısı bunun altında bitmeli ki istemci JSON hata alsın */
export const COPY_TIMEOUT_MS = 100_000;
export const COPY_SCHEMA_NAME = 'plan_copy_output';

/** zod şemasından (tek doğruluk kaynağı) strict JSON Schema; OpenRouter/OpenAI biçimi: $schema yok */
export function copyJsonSchema(): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(CopyOutputSchema, { target: 'draft-7' }) as Record<string, unknown>;
  void $schema;
  return rest;
}

export class OpenRouterError extends Error {
  constructor(message: string, public status: number | null, public code: string | null) {
    super(message);
  }
}

export interface OpenRouterDeps {
  /** Başka bir yapılandırılmış çıktı için (ör. marka rehberi taslağı); yoksa plan-copy çıktı şeması */
  schema?: z.ZodType;
  schemaName?: string;
  /** Test için; yoksa küresel fetch */
  fetchImpl?: typeof fetch;
  /** Test için; yoksa process.env.OPENROUTER_API_KEY (çağrı anında okunur) */
  apiKey?: string;
  timeoutMs?: number;
  maxTokens?: number;
  referer?: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function normalizeUsage(u: any): CopyUsage {
  const input = num(u?.prompt_tokens);
  const output = num(u?.completion_tokens);
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: num(u?.total_tokens) ?? (input !== null && output !== null ? input + output : null),
    cachedTokens: num(u?.prompt_tokens_details?.cached_tokens),
    reasoningTokens: num(u?.completion_tokens_details?.reasoning_tokens),
    costUsd: num(u?.cost),
  };
}

/** OpenRouter finish_reason → sunucunun anladığı durdurma nedeni */
function stopReasonOf(choice: any): string | null {
  if (choice?.message?.refusal) return 'refusal';
  switch (choice?.finish_reason) {
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'content_filter': return 'refusal';
    case 'tool_calls': return 'tool_use';
    default: return choice?.finish_reason ?? null;
  }
}

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
  void $schema;
  return rest;
}

export function openrouterCopyCall(deps: OpenRouterDeps = {}): CopyModelCall {
  const outSchema: z.ZodType = deps.schema ?? CopyOutputSchema;
  const schemaName = deps.schemaName ?? COPY_SCHEMA_NAME;
  const jsonSchema = deps.schema ? jsonSchemaOf(deps.schema) : copyJsonSchema();
  return async ({ model, system, user }) => {
    const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey || !apiKey.trim()) throw new OpenRouterError('OPENROUTER_API_KEY tanımlı değil', null, 'no_api_key');
    const doFetch = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? COPY_TIMEOUT_MS);
    try {
      const res = await doFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': deps.referer ?? 'https://intiba.co',
          'X-Title': 'Intiba Studio plan-copy',
        },
        body: JSON.stringify({
          model,
          max_tokens: deps.maxTokens ?? COPY_MAX_TOKENS,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema: jsonSchema } },
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
      // Gövde (olası hassas içerik) mesaja KOPYALANMAZ; yalnız durum ve sağlayıcı hata kodu
      if (!res.ok) throw new OpenRouterError(`OpenRouter isteği başarısız (${res.status})`, res.status, data?.error?.code != null ? String(data.error.code) : null);
      if (data?.error) throw new OpenRouterError('OpenRouter hata döndürdü', num(data.error.code), data.error.code != null ? String(data.error.code) : null);
      const choice = data?.choices?.[0];
      let parsed: unknown = null;
      const content = choice?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        try {
          const check = outSchema.safeParse(JSON.parse(content));
          parsed = check.success ? check.data : null;
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
        requestId,
        usageDetail: normalizeUsage(data?.usage),
        usage: { input_tokens: num(data?.usage?.prompt_tokens) ?? undefined, output_tokens: num(data?.usage?.completion_tokens) ?? undefined },
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
