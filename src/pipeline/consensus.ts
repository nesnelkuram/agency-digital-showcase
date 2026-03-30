// Multi-Model Consensus v2 — Cross-provider validation
// Uses Gemini Pro output + OpenRouter Claude for genuine multi-model consensus.
// Fallback: if OpenRouter unavailable, falls back to Gemini Pro + Flash (same-provider).

import { generateJSON } from './geminiClient';
import type { EvidenceChain } from './evidence';

export interface ConsensusResult {
  consensusReached: boolean;
  consensusScore: number;
  finalAnswer: string;
  disagreements: string[];
  humanReviewRecommended: boolean;
  evidence: EvidenceChain;
  revisionNeeded: boolean;
  revisionReason?: string;
  suggestedWeakness?: string;
  // v2: track which providers were used
  providersUsed: string[];
}

interface ConsensusResponse {
  answer: string;
  confidence: number;
  rationale: string;
}

// OpenRouter call for cross-provider consensus
async function callOpenRouterForConsensus(
  prompt: string,
  model: string = 'anthropic/claude-opus-4-6',
): Promise<ConsensusResponse | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://intiba.co',
        'X-Title': 'Intiba Consensus',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[Consensus] OpenRouter ${response.status} — falling back`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) return null;

    return JSON.parse(text) as ConsensusResponse;
  } catch (err: any) {
    console.warn(`[Consensus] OpenRouter failed: ${err.message}`);
    return null;
  }
}

export async function runPositioningConsensus(
  businessName: string,
  sector: string,
  positioning: string,
  archetype: string,
  context: string,
): Promise<ConsensusResult> {
  const question = `${businessName} icin onerilen konumlandirma: "${positioning}" ve arketip: "${archetype}". Bu ${sector} sektorunde GUCLU ve FARKLI bir konumlandirma mi?`;

  const prompt = `Sen bir marka stratejisi dogrulama uzmanisin. Asagidaki konumlandirmayi BAGIMSIZ olarak degerlendir.

## Soru
${question}

## Baglam
${context}

Asagidaki JSON formatinda yanit ver:
{
  "answer": "Kisa ve net degerlendirme (2-3 cumle)",
  "confidence": 0-100,
  "rationale": "Neden bu degerlendirmeyi yaptiginin 2-3 cumlelik aciklamasi"
}

KURALLAR:
1. Sadece VERILEN baglamdaki verilere dayan
2. Confidence skoru kanit gucuyle orantili
3. Turkce yaz
4. Sadece JSON don`;

  // Strategy: Try OpenRouter Claude first (cross-provider), fall back to Flash (same-provider)
  const providersUsed: string[] = [];

  // Model A: Gemini Pro (always runs)
  const proResultP = generateJSON<ConsensusResponse>('pro', prompt, 'ConsensusPro', {
    temperature: 0.3, maxOutputTokens: 2048,
  }).catch(() => null);

  // Model B: OpenRouter Claude (preferred) or Gemini Flash (fallback)
  const crossProviderP = callOpenRouterForConsensus(prompt);

  const [proOpinion, crossOpinion] = await Promise.all([proResultP, crossProviderP]);

  if (proOpinion) providersUsed.push('gemini-pro');

  // If OpenRouter succeeded, use it. Otherwise fallback to Flash.
  let secondOpinion = crossOpinion;
  if (secondOpinion) {
    providersUsed.push('openrouter-claude');
  } else {
    // Fallback: same-provider Flash
    try {
      secondOpinion = await generateJSON<ConsensusResponse>('flash', prompt, 'ConsensusFlash', {
        temperature: 0.3, maxOutputTokens: 2048,
      });
      if (secondOpinion) providersUsed.push('gemini-flash');
    } catch {
      secondOpinion = null;
    }
  }

  if (!proOpinion && !secondOpinion) {
    return {
      consensusReached: false,
      consensusScore: 0,
      finalAnswer: '',
      disagreements: ['Her iki model de yanit veremedi'],
      humanReviewRecommended: true,
      revisionNeeded: true,
      revisionReason: 'Çoklu model doğrulaması başarısız — her iki model yanıt veremedi',
      suggestedWeakness: 'Konumlandırma veya arketip seçimi doğrulanamadı',
      providersUsed,
      evidence: {
        claim: question,
        evidenceType: 'ai_inference',
        sources: [],
        confidence: 0,
        assumptions: ['Coklu model dogrulamasi basarisiz'],
        falsifiableBy: 'Manuel uzman degerlendirmesi',
      },
    };
  }

  const opinions = [proOpinion, secondOpinion].filter(Boolean) as ConsensusResponse[];
  const avgConfidence = Math.round(opinions.reduce((sum, o) => sum + (o.confidence || 50), 0) / opinions.length);

  // Check agreement
  const disagreements: string[] = [];
  if (proOpinion && secondOpinion) {
    const proConf = proOpinion.confidence || 50;
    const secondConf = secondOpinion.confidence || 50;
    if (Math.abs(proConf - secondConf) > 25) {
      disagreements.push(`Güven farkı: ${providersUsed[0]}=${proConf}, ${providersUsed[1] || 'unknown'}=${secondConf}`);
    }
  }

  // Cross-provider consensus is more valuable: +5 bonus when different providers agree
  const crossProviderBonus = providersUsed.includes('openrouter-claude') && disagreements.length === 0 ? 5 : 0;
  const consensusScore = disagreements.length === 0
    ? Math.min(95, avgConfidence + 10 + crossProviderBonus)
    : Math.max(20, avgConfidence - 15);
  const best = proOpinion || secondOpinion!;
  const revisionNeeded = consensusScore < 60;

  let revisionReason: string | undefined;
  let suggestedWeakness: string | undefined;
  if (revisionNeeded) {
    const parts: string[] = [];
    if (proOpinion && secondOpinion) {
      parts.push(`Model güven farkı: ${providersUsed[0]}=${proOpinion.confidence}, ${providersUsed[1] || 'unknown'}=${secondOpinion.confidence}`);
    }
    if (disagreements.length > 0) parts.push(...disagreements);
    revisionReason = parts.join(' | ');
    const weakerModel = (proOpinion?.confidence ?? 100) < (secondOpinion?.confidence ?? 100)
      ? proOpinion : secondOpinion;
    suggestedWeakness = weakerModel?.rationale?.slice(0, 200);
  }

  console.log(`[Consensus] score=${consensusScore}, providers=${providersUsed.join('+')}, crossProvider=${providersUsed.includes('openrouter-claude')}`);

  return {
    consensusReached: consensusScore >= 60,
    consensusScore,
    finalAnswer: best.answer || '',
    disagreements,
    humanReviewRecommended: revisionNeeded,
    revisionNeeded,
    revisionReason,
    suggestedWeakness,
    providersUsed,
    evidence: {
      claim: question,
      evidenceType: consensusScore >= 60 ? 'framework' : 'ai_inference',
      sources: providersUsed.map((p, i) => {
        const conf = i === 0 ? proOpinion?.confidence : secondOpinion?.confidence;
        return `${p} (güven: ${conf ?? 'N/A'})`;
      }),
      confidence: consensusScore,
      assumptions: disagreements.length > 0
        ? [`Modeller arasi gorus ayriligi: ${disagreements.length} noktada`]
        : providersUsed.includes('openrouter-claude')
          ? ['Farklı AI sağlayıcıları aynı sonuca ulaştı (cross-provider consensus)']
          : [],
      falsifiableBy: 'Alternatif konumlandirma ile karsilastirma',
    },
  };
}
