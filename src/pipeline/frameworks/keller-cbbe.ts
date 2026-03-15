// Keller's Customer-Based Brand Equity (CBBE) Model
// 4-level pyramid: Identity → Meaning → Response → Resonance

import type { FrameworkScore } from '../evidence';

export interface CBBEAssessment {
  identity: {
    salience: number; // 0-25: How easily and often is the brand recalled?
    rationale: string;
  };
  meaning: {
    performance: number; // 0-12.5: How well does the product meet functional needs?
    imagery: number; // 0-12.5: How well does the brand meet psychological/social needs?
    rationale: string;
  };
  response: {
    judgments: number; // 0-12.5: Quality, credibility, consideration, superiority
    feelings: number; // 0-12.5: Warmth, fun, excitement, security, social approval, self-respect
    rationale: string;
  };
  resonance: {
    loyalty: number; // 0-6.25: Behavioral loyalty (repeat purchase)
    attachment: number; // 0-6.25: Attitudinal attachment (love it)
    community: number; // 0-6.25: Sense of community
    engagement: number; // 0-6.25: Active engagement
    rationale: string;
  };
}

export function scoreCBBE(assessment: CBBEAssessment): FrameworkScore {
  const identityScore = assessment.identity.salience;
  const meaningScore = assessment.meaning.performance + assessment.meaning.imagery;
  const responseScore = assessment.response.judgments + assessment.response.feelings;
  const resonanceScore = assessment.resonance.loyalty + assessment.resonance.attachment +
    assessment.resonance.community + assessment.resonance.engagement;

  const total = identityScore + meaningScore + responseScore + resonanceScore;

  return {
    framework: 'Keller CBBE',
    score: Math.round(total * 10) / 10,
    maxScore: 100,
    rationale: `Kimlik: ${identityScore}/25, Anlam: ${meaningScore}/25, Tepki: ${responseScore}/25, Rezonans: ${resonanceScore}/25`,
    subscores: {
      identity: identityScore,
      meaning: meaningScore,
      response: responseScore,
      resonance: resonanceScore,
    },
  };
}

/** Prompt snippet for injecting CBBE scoring into agent prompts */
export const CBBE_PROMPT_SNIPPET = `
## Keller CBBE Puanlama Rubriği
Marka değerini 4 katmanlı piramitle puanla (toplam 100 puan):

**1. Kimlik / Salience (0-25):**
- 0-5: Marka bilinirliği yok, sektörde görünmez
- 6-12: Tanıyanlar var ama ilk akla gelen değil
- 13-18: Sektörde bilinen, belirli durumlarda hatırlanan
- 19-25: Kategori denince ilk akla gelen (Top of Mind)

**2. Anlam / Meaning (0-25):**
- Performans (0-12.5): Fonksiyonel ihtiyaçları karşılama seviyesi
- İmaj (0-12.5): Psikolojik/sosyal ihtiyaçları karşılama seviyesi

**3. Tepki / Response (0-25):**
- Yargılar (0-12.5): Kalite, güvenilirlik, üstünlük algısı
- Duygular (0-12.5): Sıcaklık, heyecan, güvenlik, sosyal onay

**4. Rezonans / Resonance (0-25):**
- Sadakat (0-6.25): Tekrar satın alma davranışı
- Bağlılık (0-6.25): Duygusal bağ ("seviyorum")
- Topluluk (0-6.25): Kullanıcı topluluğu hissi
- Katılım (0-6.25): Aktif marka savunuculuğu
`;
