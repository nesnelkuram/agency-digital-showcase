// Multi-Model Consensus Engine
// For critical decisions: run through Gemini Pro + Claude Sonnet, compare outputs

import { generateJSON } from '../../src/pipeline/geminiClient';
import type { EvidenceChain } from '../../src/pipeline/evidence';

export interface ConsensusInput {
  question: string;       // The specific question to validate
  context: string;        // Full context for the decision
  options?: string[];     // If multiple choice, the options
}

export interface ModelOpinion {
  model: string;
  answer: string;
  confidence: number;     // 0-100
  rationale: string;
}

export interface ConsensusResult {
  consensusReached: boolean;
  consensusScore: number;  // 0-100: agreement level
  finalAnswer: string;
  opinions: ModelOpinion[];
  disagreements: string[];
  humanReviewRecommended: boolean;
  evidence: EvidenceChain;
}

interface ConsensusResponse {
  answer: string;
  confidence: number;
  rationale: string;
  keyFactors: string[];
}

/** Run a critical decision through multiple models for validation */
export async function runConsensus(
  input: ConsensusInput,
): Promise<ConsensusResult> {
  const prompt = buildConsensusPrompt(input);

  // Run Gemini Pro (primary)
  let geminiOpinion: ModelOpinion;
  try {
    const geminiResult = await generateJSON<ConsensusResponse>('pro', prompt, 'ConsensusGemini', {
      temperature: 0.3,
      maxOutputTokens: 4096,
    });
    geminiOpinion = {
      model: 'gemini-pro',
      answer: geminiResult.answer || '',
      confidence: geminiResult.confidence || 50,
      rationale: geminiResult.rationale || '',
    };
  } catch {
    geminiOpinion = {
      model: 'gemini-pro',
      answer: '',
      confidence: 0,
      rationale: 'Model yanıt veremedi',
    };
  }

  // Run Gemini Flash as second opinion (lower cost than Claude)
  let flashOpinion: ModelOpinion;
  try {
    const flashResult = await generateJSON<ConsensusResponse>('flash', prompt, 'ConsensusFlash', {
      temperature: 0.3,
      maxOutputTokens: 4096,
    });
    flashOpinion = {
      model: 'gemini-flash',
      answer: flashResult.answer || '',
      confidence: flashResult.confidence || 50,
      rationale: flashResult.rationale || '',
    };
  } catch {
    flashOpinion = {
      model: 'gemini-flash',
      answer: '',
      confidence: 0,
      rationale: 'Model yanıt veremedi',
    };
  }

  // Try Claude if ANTHROPIC_API_KEY is available
  let claudeOpinion: ModelOpinion | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      claudeOpinion = await callClaudeForConsensus(input);
    } catch {
      // Claude not available, proceed with 2 models
    }
  }

  const opinions = [geminiOpinion, flashOpinion];
  if (claudeOpinion) opinions.push(claudeOpinion);

  // Calculate consensus
  return calculateConsensus(input, opinions);
}

function buildConsensusPrompt(input: ConsensusInput): string {
  return `Sen bir marka stratejisi doğrulama uzmanısın. Aşağıdaki soruyu BAĞIMSIZ olarak değerlendir.

## Soru
${input.question}

## Bağlam
${input.context}

${input.options ? `## Seçenekler\n${input.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}` : ''}

Aşağıdaki JSON formatında yanıt ver:
{
  "answer": "Kısa ve net cevap",
  "confidence": 0-100 arası güven skoru,
  "rationale": "Bu cevabı neden verdiğinin 2-3 cümlelik açıklaması. KANIT göster.",
  "keyFactors": ["Bu kararı etkileyen en önemli 3-5 faktör"]
}

KURALLAR:
1. Sadece VERİLEN bağlama dayanarak cevapla — varsayım YAPMA
2. Confidence skoru kanıt gücüyle orantılı olmalı
3. Emin olmadığın konularda düşük confidence ver
4. Türkçe yaz
5. Sadece JSON dön`;
}

async function callClaudeForConsensus(input: ConsensusInput): Promise<ModelOpinion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not available');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: buildConsensusPrompt(input),
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(text);
    return {
      model: 'claude-sonnet',
      answer: parsed.answer || '',
      confidence: parsed.confidence || 50,
      rationale: parsed.rationale || '',
    };
  } catch {
    return {
      model: 'claude-sonnet',
      answer: text.slice(0, 200),
      confidence: 30,
      rationale: 'JSON parse hatası — ham metin kullanıldı',
    };
  }
}

function calculateConsensus(
  input: ConsensusInput,
  opinions: ModelOpinion[]
): ConsensusResult {
  const validOpinions = opinions.filter(o => o.answer && o.confidence > 0);

  if (validOpinions.length === 0) {
    return {
      consensusReached: false,
      consensusScore: 0,
      finalAnswer: '',
      opinions,
      disagreements: ['Hiçbir model geçerli yanıt veremedi'],
      humanReviewRecommended: true,
      evidence: {
        claim: input.question,
        evidenceType: 'ai_inference',
        sources: opinions.map(o => o.model),
        confidence: 0,
        assumptions: ['Çoklu model doğrulaması başarısız'],
        falsifiableBy: 'Manuel uzman değerlendirmesi ile',
      },
    };
  }

  // Check if answers are similar (simple string similarity)
  const answers = validOpinions.map(o => o.answer.toLowerCase().trim());
  const allSame = answers.every(a => {
    // Check if at least 50% of words overlap with first answer
    const words1 = new Set(answers[0].split(/\s+/));
    const words2 = a.split(/\s+/);
    const overlap = words2.filter(w => words1.has(w)).length;
    return overlap / Math.max(words1.size, words2.length) > 0.4;
  });

  const avgConfidence = Math.round(
    validOpinions.reduce((sum, o) => sum + o.confidence, 0) / validOpinions.length
  );

  const disagreements: string[] = [];
  if (!allSame) {
    for (let i = 1; i < validOpinions.length; i++) {
      if (validOpinions[i].answer !== validOpinions[0].answer) {
        disagreements.push(
          `${validOpinions[0].model} vs ${validOpinions[i].model}: "${validOpinions[0].answer.slice(0, 100)}" vs "${validOpinions[i].answer.slice(0, 100)}"`
        );
      }
    }
  }

  const consensusScore = allSame ? Math.min(95, avgConfidence + 10) : Math.max(20, avgConfidence - 20);
  const consensusReached = consensusScore >= 60;

  // Pick final answer: highest confidence model
  const best = [...validOpinions].sort((a, b) => b.confidence - a.confidence)[0];

  return {
    consensusReached,
    consensusScore,
    finalAnswer: best.answer,
    opinions,
    disagreements,
    humanReviewRecommended: !consensusReached || disagreements.length > 0,
    evidence: {
      claim: input.question,
      evidenceType: consensusReached ? 'framework' : 'ai_inference',
      sources: validOpinions.map(o => `${o.model} (güven: ${o.confidence})`),
      confidence: consensusScore,
      assumptions: disagreements.length > 0
        ? [`Modeller arası görüş ayrılığı mevcut: ${disagreements.length} noktada`]
        : [],
      falsifiableBy: 'Alternatif pozisyonlama veya arketip ile karşılaştırma',
    },
  };
}
