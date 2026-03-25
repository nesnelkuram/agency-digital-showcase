// Multi-Model Consensus — Pipeline-local wrapper
// Uses Gemini Pro + Flash for cross-validation of critical decisions

import { generateJSON } from './geminiClient';
import type { EvidenceChain } from './evidence';

export interface ConsensusResult {
  consensusReached: boolean;
  consensusScore: number;
  finalAnswer: string;
  disagreements: string[];
  humanReviewRecommended: boolean;
  evidence: EvidenceChain;
  // Populated when consensus fails — feeds mandatory revision
  revisionNeeded: boolean;
  revisionReason?: string;    // "Model güven farkı: Pro=45, Flash=78"
  suggestedWeakness?: string; // consensus'un tespit ettiği zayıf nokta
}

interface ConsensusResponse {
  answer: string;
  confidence: number;
  rationale: string;
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

  // Run both models in parallel
  const [proResult, flashResult] = await Promise.allSettled([
    generateJSON<ConsensusResponse>('pro', prompt, 'ConsensusPro', { temperature: 0.3, maxOutputTokens: 2048 }),
    generateJSON<ConsensusResponse>('flash', prompt, 'ConsensusFlash', { temperature: 0.3, maxOutputTokens: 2048 }),
  ]);

  const proOpinion = proResult.status === 'fulfilled' ? proResult.value : null;
  const flashOpinion = flashResult.status === 'fulfilled' ? flashResult.value : null;

  if (!proOpinion && !flashOpinion) {
    return {
      consensusReached: false,
      consensusScore: 0,
      finalAnswer: '',
      disagreements: ['Her iki model de yanit veremedi'],
      humanReviewRecommended: true,
      revisionNeeded: true,
      revisionReason: 'Çoklu model doğrulaması başarısız — her iki model yanıt veremedi',
      suggestedWeakness: 'Konumlandırma veya arketip seçimi doğrulanamadı',
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

  const opinions = [proOpinion, flashOpinion].filter(Boolean) as ConsensusResponse[];
  const avgConfidence = Math.round(opinions.reduce((sum, o) => sum + (o.confidence || 50), 0) / opinions.length);

  // Check agreement
  const disagreements: string[] = [];
  if (proOpinion && flashOpinion) {
    const proConf = proOpinion.confidence || 50;
    const flashConf = flashOpinion.confidence || 50;
    if (Math.abs(proConf - flashConf) > 25) {
      disagreements.push(`Guven farki: Pro=${proConf}, Flash=${flashConf}`);
    }
  }

  const consensusScore = disagreements.length === 0 ? Math.min(95, avgConfidence + 10) : Math.max(20, avgConfidence - 15);
  const best = proOpinion || flashOpinion!;
  const revisionNeeded = consensusScore < 60;

  // Build revision reason when consensus fails
  let revisionReason: string | undefined;
  let suggestedWeakness: string | undefined;
  if (revisionNeeded) {
    const parts: string[] = [];
    if (proOpinion && flashOpinion) {
      parts.push(`Model güven farkı: Pro=${proOpinion.confidence}, Flash=${flashOpinion.confidence}`);
    }
    if (disagreements.length > 0) parts.push(...disagreements);
    revisionReason = parts.join(' | ');
    // Use the lower-confidence model's rationale as the "weakness signal"
    const weakerModel = (proOpinion?.confidence ?? 100) < (flashOpinion?.confidence ?? 100)
      ? proOpinion : flashOpinion;
    suggestedWeakness = weakerModel?.rationale?.slice(0, 200);
  }

  return {
    consensusReached: consensusScore >= 60,
    consensusScore,
    finalAnswer: best.answer || '',
    disagreements,
    humanReviewRecommended: revisionNeeded,
    revisionNeeded,
    revisionReason,
    suggestedWeakness,
    evidence: {
      claim: question,
      evidenceType: consensusScore >= 60 ? 'framework' : 'ai_inference',
      sources: [
        proOpinion ? `gemini-pro (guven: ${proOpinion.confidence})` : '',
        flashOpinion ? `gemini-flash (guven: ${flashOpinion.confidence})` : '',
      ].filter(Boolean),
      confidence: consensusScore,
      assumptions: disagreements.length > 0 ? [`Modeller arasi gorus ayriligi: ${disagreements.length} noktada`] : [],
      falsifiableBy: 'Alternatif konumlandirma ile karsilastirma',
    },
  };
}
