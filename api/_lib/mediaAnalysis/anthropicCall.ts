/**
 * Üretim model çağrısı — resmi Anthropic SDK, yapılandırılmış çıktı (karşılaştırmayla aynı şema/prompt).
 * SDK yeniden denemesi kapalı: yeniden deneme runner'ın deneme sayacıyla, görünür ve sınırlı yapılır.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { CATALOG_SYSTEM_PROMPT, CATALOG_USER_PROMPT, ImageCatalogSchema } from './spec';
import type { ModelCall } from './runner';

export const CATALOG_EFFORT = 'medium' as const;
export const CATALOG_MAX_TOKENS = 8000;
/** Tek istek üst sınırı (SDK yeniden denemesi yok → toplam çağrı süresi de bu) */
export const CATALOG_TIMEOUT_MS = 120_000;

export function anthropicModelCall(client = new Anthropic({ maxRetries: 0, timeout: CATALOG_TIMEOUT_MS })): ModelCall {
  return async ({ model, imageBase64, mediaType }) => {
    const res = await client.messages.parse({
      model,
      max_tokens: CATALOG_MAX_TOKENS,
      system: CATALOG_SYSTEM_PROMPT,
      output_config: { format: zodOutputFormat(ImageCatalogSchema), effort: CATALOG_EFFORT },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: CATALOG_USER_PROMPT },
          ],
        },
      ],
    });
    return { id: res.id, stopReason: res.stop_reason, usage: res.usage, parsed: res.parsed_output ?? null };
  };
}
