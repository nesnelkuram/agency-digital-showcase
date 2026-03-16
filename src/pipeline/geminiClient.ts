import { GoogleGenAI } from '@google/genai';

export type ModelTier = 'flash' | 'pro';

export interface GroundedResponse {
  text: string;
  groundingMetadata: {
    webSearchQueries: string[];
    groundingChunks: Array<{ web?: { uri?: string; title?: string } }>;
  } | null;
}

const MODEL_IDS: Record<ModelTier, string> = {
  flash: 'gemini-2.0-flash',
  pro: 'gemini-3-pro-preview',
};

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

// Gemini 3 Pro: thinking tokens count against maxOutputTokens budget.
// A low maxOutputTokens causes truncated output (MAX_TOKENS finish reason).
// We enforce a minimum to ensure enough room for both thinking + actual output.
const PRO_MIN_OUTPUT_TOKENS = 16_384;

function resolveMaxTokens(tier: ModelTier, requested?: number, fallback: number = 4096): number {
  const base = requested ?? fallback;
  // For Pro tier, ensure at least PRO_MIN_OUTPUT_TOKENS so thinking doesn't eat all output budget
  return tier === 'pro' ? Math.max(base, PRO_MIN_OUTPUT_TOKENS) : base;
}

export async function generateJSON<T>(
  tier: ModelTier,
  prompt: string,
  agentName: string,
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<T> {
  const client = getClient();
  const result = await client.models.generateContent({
    model: MODEL_IDS[tier],
    contents: prompt,
    config: {
      temperature: config?.temperature ?? 0.7,
      topP: 0.9,
      maxOutputTokens: resolveMaxTokens(tier, config?.maxOutputTokens, 4096),
      responseMimeType: 'application/json',
      // gemini-3-pro-preview requires thinking mode; flash models don't support it
      ...(tier === 'pro' ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  });
  const text = result.text ?? '';
  if (!text) {
    throw new Error(`Agent "${agentName}" returned empty response from Gemini API`);
  }
  return safeParseJSON<T>(text, agentName);
}

export async function generateText(
  tier: ModelTier,
  prompt: string,
  agentName: string,
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const client = getClient();
  const result = await client.models.generateContent({
    model: MODEL_IDS[tier],
    contents: prompt,
    config: {
      temperature: config?.temperature ?? 0.7,
      topP: 0.9,
      maxOutputTokens: resolveMaxTokens(tier, config?.maxOutputTokens, 2048),
      ...(tier === 'pro' ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  });
  const text = result.text ?? '';
  if (!text) {
    throw new Error(`Agent "${agentName}" returned empty text response`);
  }
  return text.trim();
}

export async function generateGroundedText(
  prompt: string,
  agentName: string,
  config?: { temperature?: number; maxOutputTokens?: number; modelTier?: ModelTier }
): Promise<GroundedResponse> {
  const client = getClient();
  const tier = config?.modelTier ?? 'flash';
  const result = await client.models.generateContent({
    model: MODEL_IDS[tier],
    contents: prompt,
    config: {
      temperature: config?.temperature ?? 0.4,
      topP: 0.9,
      maxOutputTokens: resolveMaxTokens(tier, config?.maxOutputTokens, 8192),
      ...(tier === 'pro' ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      tools: [{ googleSearch: {} }],
    },
  });

  const text = result.text ?? '';
  if (!text) {
    throw new Error(`Agent "${agentName}" returned empty grounded response`);
  }

  const candidate = (result as any).candidates?.[0];
  const gm = candidate?.groundingMetadata ?? null;

  return {
    text,
    groundingMetadata: gm ? {
      webSearchQueries: gm.webSearchQueries ?? [],
      groundingChunks: (gm.groundingChunks ?? []).map((chunk: any) => ({
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
      })),
    } : null,
  };
}

// --- Deep Research via Interactions API ---

export interface DeepResearchResult {
  text: string;
  status: 'completed' | 'failed' | 'timeout';
}

const DEEP_RESEARCH_AGENT = 'deep-research-pro-preview-12-2025';
const POLL_INTERVAL_MS = 10_000; // 10s between polls

// --- Start DR interaction (no polling) ---
export async function startDeepResearch(prompt: string): Promise<string | null> {
  const client = getClient();
  try {
    const interaction = await client.interactions.create({
      agent: DEEP_RESEARCH_AGENT,
      input: prompt,
      background: true,
    });
    const id = interaction.id;
    if (!id) {
      console.log('DeepResearch: No interaction ID returned');
      return null;
    }
    console.log(`DeepResearch: Interaction created — ${id}`);
    return id;
  } catch (createError: any) {
    console.error(`DeepResearch: create() failed — ${createError.message}`);
    return null;
  }
}

// --- Poll an existing DR interaction ---
export async function pollDeepResearch(
  interactionId: string,
  timeoutMs: number = 240_000,
): Promise<DeepResearchResult> {
  const client = getClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Wait, but check deadline before and after to prevent overshoot
    const waitMs = Math.min(POLL_INTERVAL_MS, deadline - Date.now());
    if (waitMs <= 0) break;
    await new Promise(resolve => setTimeout(resolve, waitMs));

    if (Date.now() >= deadline) break;

    try {
      const result = await client.interactions.get(interactionId);
      const status = result.status;
      const steps = (result as any).steps || (result as any).progress?.steps || [];
      const outputCount = (result.outputs || []).length;
      const partialChars = (result.outputs || []).reduce((sum: number, o: any) => sum + (o.text?.length || 0), 0);
      console.log(`DeepResearch: poll status=${status}, steps=${steps.length || 'N/A'}, outputs=${outputCount}, partialChars=${partialChars}, keys=${Object.keys(result).join(',')}`);

      if (status === 'completed') {
        const outputs: any[] = result.outputs || [];
        const textParts = outputs
          .filter((o: any) => o.type === 'text' && o.text)
          .map((o: any) => o.text);
        const text = textParts.join('\n\n');
        console.log(`DeepResearch: completed — ${text.length} chars from ${textParts.length} outputs`);
        return { text, status: 'completed' };
      }

      if (status === 'failed' || status === 'cancelled') {
        console.log(`DeepResearch: ended with status=${status}`);
        return { text: '', status: 'failed' };
      }
    } catch (pollError: any) {
      console.error(`DeepResearch: poll error — ${pollError.message}`);
      return { text: '', status: 'failed' };
    }
  }

  console.log(`DeepResearch: poll timeout after ${timeoutMs}ms — interaction still alive on Gemini`);
  return { text: '', status: 'timeout' };
}

// --- Combined: start + poll (for backward compat / sync pipeline) ---
export async function runDeepResearch(
  prompt: string,
  timeoutMs: number = 120_000,
): Promise<DeepResearchResult> {
  const interactionId = await startDeepResearch(prompt);
  if (!interactionId) {
    return { text: '', status: 'failed' };
  }
  return pollDeepResearch(interactionId, timeoutMs);
}

// --- Embedding generation via text-embedding-004 ---

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const result = await client.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('Embedding API returned empty result');
  }
  return values;
}

export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const result = await client.models.embedContent({
    model: 'text-embedding-004',
    contents: texts,
  });
  const embeddings = result.embeddings;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error(`Embedding batch expected ${texts.length} results, got ${embeddings?.length ?? 0}`);
  }
  return embeddings.map(e => e.values ?? []);
}

export function safeParseJSON<T>(text: string, agentName: string): T {
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = text.match(/```json?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    throw new Error(`Agent "${agentName}" returned invalid JSON: ${text.slice(0, 200)}`);
  }
}
