import { generateJSON } from '../../geminiClient';
import type { PerformanceAnalysisOutput } from './performanceAnalyst';
import type { AdPlatform, MarketingCampaign } from '@/shared/types/marketing';

export interface PlatformOptimizationInput {
  campaign: {
    name: string;
    objective: string;
    platforms: AdPlatform[];
    currentBudget: Record<string, number>; // platform → daily budget
    currentBidStrategy: Record<string, string>;
    currentTargeting: Record<string, string>; // platform → targeting summary
  };
  analysisOutput: PerformanceAnalysisOutput;
}

export interface PlatformOptimizationOutput {
  changes: Array<{
    platform: AdPlatform;
    changeType: 'budget' | 'bid' | 'targeting' | 'creative' | 'placement' | 'schedule';
    currentSetting: string;
    proposedSetting: string;
    reason: string;
    expectedImpact: string;
    confidence: 'high' | 'medium' | 'low';
    requiresApproval: boolean;
  }>;

  abTestResults: Array<{
    testName: string;
    winner: string;
    metric: string;
    improvement: string;
    recommendation: string;
  }>;

  pauseRecommendations: Array<{
    platform: AdPlatform;
    adSetOrAdId: string;
    reason: string;
    alternativeAction: string;
  }>;

  scaleRecommendations: Array<{
    platform: AdPlatform;
    currentBudget: number;
    proposedBudget: number;
    reason: string;
    expectedROAS: string;
  }>;

  overallRecommendation: string;
}

export async function runPlatformOptimizer(
  input: PlatformOptimizationInput
): Promise<PlatformOptimizationOutput> {

  const { campaign, analysisOutput } = input;

  // Build context from analysis
  const performanceContext = `
## Performans Analizi Sonuclari
- Genel Skor: ${analysisOutput.overallScore}/100
- Ozet: ${analysisOutput.summary}
- Haftalik Trend: ${analysisOutput.weeklyTrend}

## KPI Durumu
${analysisOutput.kpiAnalysis.map(k =>
  `- ${k.metric}: ${k.current} (hedef: ${k.target}) — ${k.status}, trend: ${k.trend}`
).join('\n')}

## Platform Karsilastirmasi
${analysisOutput.platformComparison.map(p =>
  `- ${p.platform}: ${p.spend} TL harcama, performans: ${p.performance}`
).join('\n')}

## Anomaliler
${analysisOutput.anomalies.length > 0
  ? analysisOutput.anomalies.map(a => `- ${a.date}: ${a.metric} ${a.change} (olasi sebep: ${a.possibleCause})`).join('\n')
  : 'Anomali tespit edilmedi'}

## Mevcut Optimizasyon Onerileri
${analysisOutput.optimizationSuggestions.map(s =>
  `- [${s.priority}] ${s.title}: ${s.description}`
).join('\n')}
`;

  const campaignContext = `
## Kampanya Bilgileri
- Adi: ${campaign.name}
- Hedef: ${campaign.objective}
- Platformlar: ${campaign.platforms.join(', ')}
- Mevcut Butce (gunluk): ${Object.entries(campaign.currentBudget).map(([p, b]) => `${p}: ${b} TL`).join(', ')}
- Mevcut Bid Stratejisi: ${Object.entries(campaign.currentBidStrategy).map(([p, s]) => `${p}: ${s}`).join(', ')}
- Mevcut Hedefleme: ${Object.entries(campaign.currentTargeting).map(([p, t]) => `${p}: ${t}`).join(', ')}
`;

  const prompt = `Sen platform bazli reklam optimizasyon uzmanisin. Performans analizi sonuclarina ve mevcut kampanya ayarlarina dayanarak, SPESIFIK platform degisiklik onerileri olusturacaksin.

${campaignContext}
${performanceContext}

## KURALLAR
1. Her oneri SPESIFIK olmali — "butceyi artir" degil, "Meta gunluk butceyi 150 TL'den 200 TL'ye cikar" gibi
2. Degisiklikler PERFORMANS VERISINE dayanmali
3. Dusuk performans gosteren platform/ad set icin DURDURMA onerisi ver
4. Yuksek performans gosteren platform icin OLCEKLEME onerisi ver
5. A/B test sonuclari varsa KAZANAN varyanti belirle
6. Her degisikligin BEKLENEN ETKISINI belirt
7. Onay gerektiren degisiklikleri isaretle (requiresApproval: true)
8. Risk dusuk degisiklikler icin otomatik uygulama onerebilirsin (requiresApproval: false)

## CIKTI FORMATI (JSON)
{
  "changes": [
    {
      "platform": "meta | google | tiktok | linkedin | email",
      "changeType": "budget | bid | targeting | creative | placement | schedule",
      "currentSetting": "string",
      "proposedSetting": "string",
      "reason": "string",
      "expectedImpact": "string",
      "confidence": "high | medium | low",
      "requiresApproval": true
    }
  ],
  "abTestResults": [
    {
      "testName": "string",
      "winner": "string — kazanan varyant",
      "metric": "string — basari metrigi",
      "improvement": "string — %X iyilesme",
      "recommendation": "string"
    }
  ],
  "pauseRecommendations": [
    {
      "platform": "meta",
      "adSetOrAdId": "string",
      "reason": "string",
      "alternativeAction": "string"
    }
  ],
  "scaleRecommendations": [
    {
      "platform": "meta",
      "currentBudget": 0,
      "proposedBudget": 0,
      "reason": "string",
      "expectedROAS": "string"
    }
  ],
  "overallRecommendation": "string — 2-3 cumlelik genel oneri ozeti"
}`;

  return generateJSON<PlatformOptimizationOutput>(
    'flash',
    prompt,
    'platformOptimizer',
    { temperature: 0.4, maxOutputTokens: 6144 }
  );
}
