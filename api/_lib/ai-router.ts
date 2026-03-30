/**
 * AI Fallback Chain — Multi-provider routing with retry and fallback
 *
 * Routing chain: Gemini Flash → Gemini Pro → Claude Sonnet
 * OpenRouter tiers: openrouter_claude, openrouter_gpt4o (for multi-model consensus)
 * Each provider gets maxRetries attempts before falling through.
 *
 * Usage:
 *   const result = await aiRouter.generate({ prompt, tier: 'flash' });
 *   const result = await aiRouter.generate({ prompt, tier: 'openrouter_claude' });
 */

import { GoogleGenAI } from '@google/genai';
import type { Result } from '../../shared/types/result.js';

// ============================================
// Types
// ============================================

export type AITier = 'flash' | 'pro' | 'claude' | 'openrouter_claude' | 'openrouter_gpt4o';

export interface AIProviderConfig {
  tier: AITier;
  model: string;
  apiKey: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface GenerateOptions {
  prompt: string | any[];       // string or Gemini contents array
  systemInstruction?: string;
  tier?: AITier;                // Starting tier (default: flash)
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];                // Gemini function declarations
  responseMimeType?: string;    // e.g. 'application/json'
  maxRetries?: number;
  fallback?: boolean;           // Enable fallback chain (default: true)
}

export interface AIResponse {
  text: string;
  provider: AITier;
  model: string;
  latencyMs: number;
  retries: number;
  fallbacks: number;
}

// ============================================
// Provider Registry
// ============================================

const PROVIDER_CHAIN: AITier[] = ['flash', 'pro', 'claude'];

const MODEL_MAP: Record<AITier, string> = {
  flash: 'gemini-3.1-flash-lite-preview',
  pro: 'gemini-3.1-pro-preview',
  claude: 'claude-opus-4-6',
  openrouter_claude: 'anthropic/claude-opus-4-6',
  openrouter_gpt4o: 'openai/gpt-4o',
};

const TIMEOUT_MAP: Record<AITier, number> = {
  flash: 15_000,
  pro: 30_000,
  claude: 30_000,
  openrouter_claude: 30_000,
  openrouter_gpt4o: 30_000,
};

// ============================================
// Gemini Provider
// ============================================

let _geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!_geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    _geminiClient = new GoogleGenAI({ apiKey });
  }
  return _geminiClient;
}

async function callGemini(
  model: string,
  opts: GenerateOptions,
  timeoutMs: number
): Promise<string> {
  const client = getGeminiClient();

  const contents = typeof opts.prompt === 'string'
    ? [{ role: 'user' as const, parts: [{ text: opts.prompt }] }]
    : opts.prompt;

  const config: Record<string, any> = {
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
  };

  if (opts.systemInstruction) {
    config.systemInstruction = opts.systemInstruction;
  }
  if (opts.tools) {
    config.tools = opts.tools;
  }
  if (opts.responseMimeType) {
    config.responseMimeType = opts.responseMimeType;
  }

  // Pro model requires thinking mode
  if (!model.includes('pro')) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await client.models.generateContent({
      model,
      contents,
      config,
    });

    return result.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// Claude Provider (Anthropic)
// ============================================

async function callClaude(
  model: string,
  opts: GenerateOptions,
  timeoutMs: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const messages: any[] = [];

  if (typeof opts.prompt === 'string') {
    messages.push({ role: 'user', content: opts.prompt });
  } else if (Array.isArray(opts.prompt)) {
    // Convert Gemini format to Claude format
    for (const entry of opts.prompt) {
      const role = entry.role === 'model' ? 'assistant' : 'user';
      const textParts = (entry.parts || [])
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join('\n');
      if (textParts) {
        messages.push({ role, content: textParts });
      }
    }
  }

  const body: Record<string, any> = {
    model,
    max_tokens: opts.maxOutputTokens ?? 4096,
    messages,
  };

  if (opts.systemInstruction) {
    body.system = opts.systemInstruction;
  }
  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Claude API ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// OpenRouter Provider (Claude, GPT-4o, etc.)
// ============================================

async function callOpenRouter(
  model: string,
  opts: GenerateOptions,
  timeoutMs: number
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const messages: any[] = [];

  if (opts.systemInstruction) {
    messages.push({ role: 'system', content: opts.systemInstruction });
  }

  if (typeof opts.prompt === 'string') {
    messages.push({ role: 'user', content: opts.prompt });
  } else if (Array.isArray(opts.prompt)) {
    for (const entry of opts.prompt) {
      const role = entry.role === 'model' ? 'assistant' : 'user';
      const textParts = (entry.parts || [])
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join('\n');
      if (textParts) {
        messages.push({ role, content: textParts });
      }
    }
  }

  const body: Record<string, any> = {
    model,
    max_tokens: opts.maxOutputTokens ?? 4096,
    messages,
  };

  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }

  if (opts.responseMimeType === 'application/json') {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://intiba.co',
        'X-Title': 'Intiba Pipeline',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenRouter API ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// Router
// ============================================

function isOpenRouterTier(tier: AITier): boolean {
  return tier === 'openrouter_claude' || tier === 'openrouter_gpt4o';
}

async function callProvider(tier: AITier, opts: GenerateOptions): Promise<string> {
  const model = MODEL_MAP[tier];
  const timeout = TIMEOUT_MAP[tier];

  if (isOpenRouterTier(tier)) {
    return callOpenRouter(model, opts, timeout);
  }
  if (tier === 'claude') {
    return callClaude(model, opts, timeout);
  }
  return callGemini(model, opts, timeout);
}

export async function generate(opts: GenerateOptions): Promise<AIResponse> {
  const startTier = opts.tier || 'flash';
  const maxRetries = opts.maxRetries ?? 2;
  const enableFallback = opts.fallback !== false;

  // OpenRouter tiers are standalone — no fallback chain
  // Main chain tiers: flash → pro → claude
  const isOR = isOpenRouterTier(startTier);
  const startIdx = isOR ? -1 : PROVIDER_CHAIN.indexOf(startTier);
  const chain: AITier[] = isOR
    ? [startTier]
    : enableFallback
      ? PROVIDER_CHAIN.slice(startIdx)
      : [startTier];

  let totalFallbacks = 0;

  for (const tier of chain) {
    let retries = 0;
    const model = MODEL_MAP[tier];

    while (retries <= maxRetries) {
      const start = Date.now();

      try {
        const text = await callProvider(tier, opts);

        if (!text) throw new Error('Empty response');

        return {
          text,
          provider: tier,
          model,
          latencyMs: Date.now() - start,
          retries,
          fallbacks: totalFallbacks,
        };
      } catch (err: any) {
        retries++;
        const isLastRetry = retries > maxRetries;
        const isLastProvider = tier === chain[chain.length - 1];

        console.warn(
          `[AI Router] ${tier}/${model} attempt ${retries}/${maxRetries + 1} failed: ${err.message}`
        );

        if (isLastRetry && isLastProvider) {
          throw new Error(
            `All AI providers failed. Last error (${tier}): ${err.message}`
          );
        }

        if (isLastRetry) {
          totalFallbacks++;
          break; // Move to next provider
        }

        // Brief backoff before retry
        await new Promise(r => setTimeout(r, 500 * retries));
      }
    }
  }

  throw new Error('AI routing chain exhausted');
}

/**
 * Generate JSON — convenience wrapper with responseMimeType
 */
export async function generateJSON<T = any>(
  opts: Omit<GenerateOptions, 'responseMimeType'>
): Promise<{ data: T; meta: Omit<AIResponse, 'text'> }> {
  const response = await generate({
    ...opts,
    responseMimeType: 'application/json',
  });

  const data = JSON.parse(response.text) as T;
  const { text: _, ...meta } = response;
  return { data, meta };
}

/**
 * Health check — test each provider
 */
export async function healthCheck(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  const allTiers: AITier[] = [...PROVIDER_CHAIN];
  if (process.env.OPENROUTER_API_KEY) {
    allTiers.push('openrouter_claude', 'openrouter_gpt4o');
  }

  for (const tier of allTiers) {
    try {
      await callProvider(tier, {
        prompt: 'Say "ok"',
        maxOutputTokens: 10,
        temperature: 0,
      });
      results[tier] = true;
    } catch {
      results[tier] = false;
    }
  }

  return results;
}

// ============================================
// Default Export
// ============================================

export const aiRouter = {
  generate,
  generateJSON,
  healthCheck,
};
