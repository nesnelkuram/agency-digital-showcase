import { generateJSON } from '../../geminiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorAnalyzerInput {
  competitorName: string;
  competitorWebsite?: string;
  sector?: string;
  platforms: string[];
  clientName?: string;
  clientSector?: string;
}

export interface CompetitorAdExampleOutput {
  platform: string;
  type: string; // image | video | carousel | text
  headline?: string;
  description?: string;
  cta?: string;
  estimatedEngagement: string; // low | medium | high
  notes: string;
}

export interface CompetitorAnalyzerOutput {
  adStrategySummary: string;
  estimatedMonthlySpend: string;
  primaryPlatforms: string[];
  targetAudience: string;
  messagingThemes: string[];
  creativeApproach: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  adExamples: CompetitorAdExampleOutput[];
  recommendations: string[];
  overallThreatLevel: string; // low | medium | high
  confidence: number; // 0-1
}

// ---------------------------------------------------------------------------
// Main agent function
// ---------------------------------------------------------------------------

export async function runCompetitorAnalyzer(
  input: CompetitorAnalyzerInput
): Promise<CompetitorAnalyzerOutput> {
  const prompt = `Sen bir dijital pazarlama rekabet analizi uzmanisin.

Rakip firma hakkinda kapsamli bir reklam stratejisi analizi yap:

RAKIP BILGILERI:
- Firma: ${input.competitorName}
${input.competitorWebsite ? `- Web sitesi: ${input.competitorWebsite}` : ''}
${input.sector ? `- Sektor: ${input.sector}` : ''}
- Izlenen platformlar: ${input.platforms.join(', ')}
${input.clientName ? `- Musterimiz: ${input.clientName}` : ''}
${input.clientSector ? `- Musteri sektoru: ${input.clientSector}` : ''}

ANALIZ GEREKSINIMLERI:
1. Rakibin genel reklam stratejisi ozeti (detayli paragraf)
2. Tahmini aylik reklam harcamasi (TL cinsinden aralik)
3. Birincil reklam platformlari ve kullanim oranlari
4. Hedef kitle profili (demografik + psikografik)
5. Mesaj temalari ve ton (en az 4 tema)
6. Kreatif yaklasim (gorsel stil, video kullanimi, format tercihleri)
7. Guclu yonleri (en az 3)
8. Zayif yonleri (en az 3)
9. Musterimiz icin firsatlar (en az 3)
10. Tehditler (en az 2)
11. Reklam ornekleri (her platform icin 1-2 tahmini ornek)
12. Stratejik oneriler (en az 4, somut ve uygulanabilir)
13. Genel tehdit seviyesi (low/medium/high)
14. Guven skoru (0-1 arasi)

## CIKTI FORMATI (JSON)
{
  "adStrategySummary": "string — Rakibin genel reklam stratejisi ozeti, en az 3-4 cumle",
  "estimatedMonthlySpend": "string — Tahmini aylik harcama, ornegin '50.000-100.000 TL'",
  "primaryPlatforms": ["string — Platform adi"],
  "targetAudience": "string — Hedef kitle profili detayli aciklama",
  "messagingThemes": ["string — Mesaj temalari"],
  "creativeApproach": "string — Kreatif yaklasim aciklamasi",
  "strengths": ["string — Guclu yan"],
  "weaknesses": ["string — Zayif yan"],
  "opportunities": ["string — Musterimiz icin firsat"],
  "threats": ["string — Tehdit"],
  "adExamples": [
    {
      "platform": "string — Platform adi (Meta, Google, TikTok, LinkedIn)",
      "type": "string — image | video | carousel | text",
      "headline": "string — Tahmini baslik",
      "description": "string — Tahmini aciklama metni",
      "cta": "string — Tahmini CTA",
      "estimatedEngagement": "string — low | medium | high",
      "notes": "string — Bu reklam hakkinda notlar ve gozlemler"
    }
  ],
  "recommendations": ["string — Stratejik oneri"],
  "overallThreatLevel": "string — low | medium | high",
  "confidence": 0.7
}

KURALLAR:
1. Tum metinler TURKCE olmali
2. Somut ve uygulanabilir analizler yap, jenerik ifadelerden kacin
3. Her platform icin en az 1 reklam ornegi olustur
4. Oneriler spesifik ve aksiyon alinabilir olmali
5. Tehdit seviyesini rakibin buyuklugu, dijital etkinligi ve sektor konumuna gore belirle
6. Guven skoru, bilgi kalitesi ve analiz derinligine gore 0-1 arasi deger ver
7. SADECE JSON don, baska bir sey yazma`;

  console.log(
    `[competitorAnalyzer] Analyzing competitor: ${input.competitorName}` +
      (input.sector ? `, sector=${input.sector}` : '') +
      `, platforms=[${input.platforms.join(', ')}]`
  );

  const result = await generateJSON<CompetitorAnalyzerOutput>(
    'pro',
    prompt,
    'competitorAnalyzer',
    { temperature: 0.5, maxOutputTokens: 8192 }
  );

  // Validate and sanitize output
  if (!result.adStrategySummary) {
    throw new Error('competitorAnalyzer returned empty adStrategySummary');
  }

  // Ensure arrays are arrays
  result.strengths = Array.isArray(result.strengths) ? result.strengths : [];
  result.weaknesses = Array.isArray(result.weaknesses) ? result.weaknesses : [];
  result.opportunities = Array.isArray(result.opportunities) ? result.opportunities : [];
  result.threats = Array.isArray(result.threats) ? result.threats : [];
  result.messagingThemes = Array.isArray(result.messagingThemes) ? result.messagingThemes : [];
  result.adExamples = Array.isArray(result.adExamples) ? result.adExamples : [];
  result.recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  result.primaryPlatforms = Array.isArray(result.primaryPlatforms) ? result.primaryPlatforms : [];

  // Clamp confidence
  result.confidence = Math.min(1, Math.max(0, result.confidence || 0.5));

  // Normalize threat level
  const validLevels = ['low', 'medium', 'high'];
  if (!validLevels.includes(result.overallThreatLevel)) {
    result.overallThreatLevel = 'medium';
  }

  console.log(
    `[competitorAnalyzer] Analysis complete: threat=${result.overallThreatLevel}, ` +
      `confidence=${result.confidence}, examples=${result.adExamples.length}`
  );

  return result;
}
