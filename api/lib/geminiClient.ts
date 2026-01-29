import { GoogleGenerativeAI } from '@google/generative-ai';

export type ModelTier = 'flash' | 'pro';

const MODEL_IDS: Record<ModelTier, string> = {
  flash: 'gemini-2.0-flash',
  pro: 'gemini-2.0-flash',
};
// NOTE: Both tiers use gemini-2.0-flash for now.
// Upgrade pro to 'gemini-2.5-pro' once model availability is confirmed.

export function createGeminiModel(
  tier: ModelTier,
  config?: { temperature?: number; maxOutputTokens?: number }
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL_IDS[tier],
    generationConfig: {
      temperature: config?.temperature ?? 0.7,
      topP: 0.9,
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
      responseMimeType: 'application/json',
    },
  });
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
