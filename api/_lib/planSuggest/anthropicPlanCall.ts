/**
 * Haftalık plan taslak önerisi — resmi Anthropic SDK, yapılandırılmış çıktı (PlanSuggestionSchema).
 * SDK yeniden denemesi kapalı; çıktı yine de sunucuda validateSuggestion ile doğrulanır.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { PlanSuggestionSchema, type PlanModelCall } from './planSuggest';

export const PLAN_EFFORT = 'medium' as const;
export const PLAN_MAX_TOKENS = 8000;
/** Tek istek üst sınırı; uç nokta maxDuration (180 sn) envanter okuması + bu süreyi karşılar */
export const PLAN_TIMEOUT_MS = 120_000;

export function anthropicPlanCall(client = new Anthropic({ maxRetries: 0, timeout: PLAN_TIMEOUT_MS })): PlanModelCall {
  return async ({ model, system, user }) => {
    const res = await client.messages.parse({
      model,
      max_tokens: PLAN_MAX_TOKENS,
      system,
      output_config: { format: zodOutputFormat(PlanSuggestionSchema), effort: PLAN_EFFORT },
      messages: [{ role: 'user', content: user }],
    });
    return { id: res.id, stopReason: res.stop_reason, parsed: res.parsed_output ?? null, usage: res.usage };
  };
}
