import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { generateGroundedText, generateJSON } from '../_lib/gemini-bundle.mjs';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = { maxDuration: 60 };

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!applyRateLimit(res, req.userUid, LIMITS.AI_ANALYSIS)) return;

  const { description } = req.body || {};
  if (!description || description.trim().length < 10)
    return res.status(400).json({ error: 'Ajan açıklaması en az 10 karakter olmalıdır.' });

  const task = description.trim();

  // Step 1: Internet research via Google Search grounding (fails gracefully)
  let researchText = '';
  let researchSources: { uri?: string; title?: string }[] = [];
  try {
    const researchResult = await generateGroundedText(
      `Search for best practices and expert prompt engineering techniques for an AI agent that: "${task}".
      Summarize: 1) Effective system prompts 2) Recommended input variables 3) Expected output structure 4) Whether to use a fast or powerful model 5) When human review is needed.`,
      'meta-agent-researcher',
      { maxOutputTokens: 2048, temperature: 0.3 }
    );
    researchText = researchResult.text ?? '';
    researchSources = researchResult.groundingMetadata?.groundingChunks
      ?.map((c: any) => c.web).filter(Boolean) ?? [];
  } catch (err) {
    console.warn('[generate-agent] Grounding step failed, continuing without research:', err);
  }

  // Step 2: Synthesize into a complete AIAgent config
  const systemInstruction = `You are an expert AI agent architect. Your job is to produce a complete, production-ready agent configuration as a single JSON object. Never wrap the object in another key. Never include explanatory comments inside the JSON. All Turkish strings must be real values, not placeholder descriptions.`;

  const userPrompt = `Create a production-ready AI agent configuration for the following task:

TASK: ${task}
${researchText ? `\nRESEARCH CONTEXT:\n${researchText}\n` : ''}
Return a single JSON object with these exact keys and value types:

{
  "name": "<short Turkish name, e.g. 'Müşteri Geri Bildirim Analisti'>",
  "description": "<1-2 Turkish sentences describing what this agent does>",
  "agentType": "<exactly 'gemini_task' for text/data tasks, or 'gemini_vision' ONLY for image analysis>",
  "systemPrompt": "<detailed Turkish system prompt, must start with 'Sen bir', minimum 3 sentences>",
  "promptTemplate": "<template string using at least 2 {{variable}} placeholders>",
  "model": "<exactly 'flash' for fast/simple tasks, or 'pro' for complex reasoning>",
  "inputMapping": { "<variable_name>": "<context_key>" },
  "outputMapping": { "<output_field>": "<context_key>" },
  "requiresHumanReview": <true or false>,
  "confidenceThreshold": <number between 0.7 and 0.9>,
  "maxRetries": <integer 1, 2, or 3>,
  "timeoutMs": <one of: 30000, 60000, or 120000>
}`;

  let agentConfig: Record<string, any>;
  try {
    agentConfig = await generateJSON(
      'flash',
      `${systemInstruction}\n\n${userPrompt}`,
      'meta-agent-synthesizer',
      { maxOutputTokens: 2048, temperature: 0.4 }
    );
  } catch (err: any) {
    console.error('[generate-agent] generateJSON failed:', err?.message);
    return res.status(500).json({ error: `AI model hatası: ${err?.message ?? 'bilinmeyen hata'}` });
  }

  // Unwrap if model accidentally nested the object (e.g. { "agent": { ... } })
  const result: Record<string, any> =
    agentConfig.name ? agentConfig :
    agentConfig.agent ? agentConfig.agent :
    Object.values(agentConfig)[0] ?? agentConfig;

  const missing = ['name', 'systemPrompt', 'promptTemplate'].filter((k) => !result[k]);
  if (missing.length > 0) {
    console.error('[generate-agent] Missing required fields:', missing, 'Got:', JSON.stringify(result).slice(0, 300));
    return res.status(500).json({
      error: `AI yanıtı eksik alanlar içeriyor: ${missing.join(', ')}. Lütfen daha ayrıntılı bir açıklama yazın ve tekrar deneyin.`,
    });
  }

  return res.status(200).json({ agent: result, researchSources });
});
