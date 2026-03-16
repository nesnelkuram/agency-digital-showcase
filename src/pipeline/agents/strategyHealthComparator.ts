import { generateJSON } from '../geminiClient';
import type { StrategyBaseline, CheckupFindings, HealthComponentScores, HEALTH_WEIGHTS } from '../../../shared/types/strategyFeedback';

interface ComparatorInput {
  baseline: StrategyBaseline;
  newResearch: any | null;
  newCompetitorDiscovery: any | null;
  newChallengerOutput: any | null;
}

interface ComparatorOutput {
  findings: CheckupFindings;
  componentScores: HealthComponentScores;
  summary: string;
}

/**
 * Strategy Health Comparator — lightweight agent that compares fresh research
 * data against the original strategy baseline to detect drift, new threats,
 * and market shifts. Uses Gemini Flash for speed and cost efficiency.
 */
export async function runStrategyHealthComparator(input: ComparatorInput): Promise<ComparatorOutput> {
  const { baseline, newResearch, newCompetitorDiscovery, newChallengerOutput } = input;

  const newCompetitorNames = [
    ...(newResearch?.competitors?.map((c: any) => c.name) || []),
    ...(newCompetitorDiscovery?.discoveredCompetitors?.map((c: any) => c.name) || []),
    ...(newCompetitorDiscovery?.knownCompetitors?.map((c: any) => c.name) || []),
  ];
  const uniqueNewNames = [...new Set(newCompetitorNames.map((n: string) => n.toLowerCase().trim()))];

  const newTrends = newResearch?.marketData?.consumerTrends || [];
  const challengerRisks = newChallengerOutput?.blindSpots || [];

  const prompt = `Sen bir marka stratejisi saglik analisti sin. Asagidaki ORIJINAL STRATEJI ile GUNCEL VERILER arasindaki farklari analiz et.

## ORIJINAL STRATEJI (Baseline)
- Arketip: ${baseline.archetype}
- Konumlandirma: ${baseline.positioningStatement}
- Farklilastirici: ${baseline.differentiator}
- Rekabet Avantaji: ${baseline.competitiveAdvantage}
- Bilinen Rakipler: ${baseline.competitors.join(', ') || 'Yok'}
- Pazar Buyuklugu: ${baseline.marketSize}
- Orijinal Trendler: ${baseline.consumerTrends.join('; ') || 'Yok'}
- Orijinal Guven Skoru: ${baseline.overallConfidence}/100

## GUNCEL VERILER
### Yeni Arastirma Bulgulari
- Yeni/guncellenmis rakipler: ${uniqueNewNames.join(', ') || 'Bilgi yok'}
- Guncel trendler: ${newTrends.join('; ') || 'Bilgi yok'}
- Pazar buyuklugu: ${newResearch?.marketData?.marketSize || 'Bilgi yok'}

### Yeni Rakip Kesfetme
${newCompetitorDiscovery ? `- Kesif edilen: ${newCompetitorDiscovery.discoveredCompetitors?.map((c: any) => c.name).join(', ') || 'Yok'}
- Bilinen: ${newCompetitorDiscovery.knownCompetitors?.map((c: any) => c.name).join(', ') || 'Yok'}` : 'Veri yok'}

### Yeni Muhalif Degerlendirmesi
${newChallengerOutput ? `- Karsi pozisyon: ${newChallengerOutput.counterPosition || 'Yok'}
- Kör noktalar: ${challengerRisks.join('; ') || 'Yok'}
- Risk alanlari: ${newChallengerOutput.riskAssessment?.highRiskAreas?.join('; ') || 'Yok'}` : 'Veri yok'}

## GOREV
Karsilastirma yap ve asagidaki JSON formatinda cevap ver:

{
  "newCompetitors": ["orijinal baseline'da OLMAYAN yeni rakip isimleri"],
  "lostCompetitors": ["orijinal baseline'da OLAN ama yeni verilerde BULUNAMAYAN rakipler"],
  "trendShifts": [
    {"trend": "trend aciklamasi", "direction": "new|growing|fading", "relevance": "marka stratejisine etkisi"}
  ],
  "positioningDrift": {
    "stillValid": true/false,
    "driftScore": 0-100,
    "reasons": ["neden gecerli/gecersiz aciklamalari"]
  },
  "challengerAlerts": ["yeni risk veya kor nokta uyarilari"],
  "competitorStability": 0-100,
  "marketAlignment": 0-100,
  "positioningRelevance": 0-100,
  "trendAlignment": 0-100,
  "summary": "3-5 cumlelik yonetici ozeti — Turkce"
}

ONEMLI:
- competitorStability: Rakip yapisinin ne kadar degismedigini olcer (100 = hic degismedi)
- marketAlignment: Pazar dinamiklerinin stratejiyle uyumunu olcer
- positioningRelevance: Konumlandirmanin hala gecerli olup olmadigini olcer
- trendAlignment: Tuketici trendlerinin stratejiyle uyumunu olcer
- driftScore: 0 = kayma yok, 100 = strateji tamamen gecersiz`;

  const result = await generateJSON<any>('flash', prompt, 'StrategyHealthComparator', {
    maxOutputTokens: 4096,
  });

  return {
    findings: {
      newCompetitors: result.newCompetitors || [],
      lostCompetitors: result.lostCompetitors || [],
      trendShifts: result.trendShifts || [],
      positioningDrift: result.positioningDrift || { stillValid: true, driftScore: 0, reasons: [] },
      challengerAlerts: result.challengerAlerts || [],
    },
    componentScores: {
      competitorStability: clamp(result.competitorStability ?? 75),
      marketAlignment: clamp(result.marketAlignment ?? 75),
      positioningRelevance: clamp(result.positioningRelevance ?? 75),
      trendAlignment: clamp(result.trendAlignment ?? 75),
    },
    summary: result.summary || '',
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
