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
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
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

export async function generateGroundedText(
  prompt: string,
  agentName: string,
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<GroundedResponse> {
  const client = getClient();
  const result = await client.models.generateContent({
    model: MODEL_IDS.flash,
    contents: prompt,
    config: {
      temperature: config?.temperature ?? 0.4,
      topP: 0.9,
      maxOutputTokens: config?.maxOutputTokens ?? 8192,
      thinkingConfig: { thinkingBudget: 0 },
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

export async function runDeepResearch(
  prompt: string,
  timeoutMs: number = 140_000,
): Promise<DeepResearchResult> {
  const client = getClient();

  // Start background research (fail fast if API unavailable)
  let interactionId: string;
  try {
    const interaction = await client.interactions.create({
      agent: DEEP_RESEARCH_AGENT,
      input: prompt,
      background: true,
    });
    interactionId = interaction.id;
    if (!interactionId) {
      console.log('DeepResearch: No interaction ID returned');
      return { text: '', status: 'failed' };
    }
    console.log(`DeepResearch: Interaction created — ${interactionId}`);
  } catch (createError: any) {
    console.error(`DeepResearch: create() failed — ${createError.message}`);
    return { text: '', status: 'failed' };
  }

  const deadline = Date.now() + timeoutMs;

  // Poll for completion
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const result = await client.interactions.get(interactionId);
      const status = result.status;
      console.log(`DeepResearch: poll status=${status}`);

      if (status === 'completed') {
        // Extract text from outputs (TextContent objects have { type: 'text', text: '...' })
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
      // status === 'in_progress' or 'requires_action' → keep polling
    } catch (pollError: any) {
      console.error(`DeepResearch: poll error — ${pollError.message}`);
      return { text: '', status: 'failed' };
    }
  }

  // Timeout — try to cancel the background interaction
  console.log(`DeepResearch: timeout after ${timeoutMs}ms`);
  try {
    await client.interactions.cancel(interactionId);
  } catch { /* ignore cancel errors */ }
  return { text: '', status: 'timeout' };
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
