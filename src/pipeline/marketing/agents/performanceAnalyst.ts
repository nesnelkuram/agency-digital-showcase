import { generateJSON } from '../../geminiClient';
import type { PerformanceSnapshot, CampaignObjective } from '@/shared/types/marketing';

export interface PerformanceAnalysisInput {
  campaignName: string;
  objective: CampaignObjective;
  targetMetrics?: {
    targetCPA?: number;
    targetROAS?: number;
    targetReach?: number;
  };
  snapshots: PerformanceSnapshot[];
  totalBudget: number;
  currency: string;
  daysRunning: number;
}

export interface PerformanceAnalysisOutput {
  overallScore: number;            // 0-100
  summary: string;
  kpiAnalysis: Array<{
    metric: string;
    current: string;
    target: string;
    status: 'above_target' | 'on_target' | 'below_target' | 'critical';
    trend: 'improving' | 'stable' | 'declining';
    recommendation: string;
  }>;
  platformComparison: Array<{
    platform: string;
    spend: number;
    performance: string;           // "Yuksek" | "Orta" | "Dusuk"
    recommendation: string;
  }>;
  anomalies: Array<{
    date: string;
    metric: string;
    change: string;
    possibleCause: string;
  }>;
  optimizationSuggestions: Array<{
    type: string;
    title: string;
    description: string;
    expectedImprovement: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  budgetEfficiency: {
    spendRate: string;
    burnRate: string;
    projectedEndDate: string;
    recommendation: string;
  };
  weeklyTrend: string;
}

export async function runPerformanceAnalyst(
  input: PerformanceAnalysisInput
): Promise<PerformanceAnalysisOutput> {

  // Aggregate metrics by platform
  const platformMetrics: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; count: number }> = {};

  input.snapshots.forEach(snap => {
    if (!platformMetrics[snap.platform]) {
      platformMetrics[snap.platform] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, count: 0 };
    }
    const pm = platformMetrics[snap.platform];
    pm.spend += snap.spend;
    pm.impressions += snap.impressions;
    pm.clicks += snap.clicks;
    pm.conversions += snap.conversions;
    pm.count++;
  });

  const platformSummary = Object.entries(platformMetrics).map(([platform, m]) =>
    `- ${platform}: ${m.spend.toFixed(0)} TL harcama, ${m.impressions} gosterim, ${m.clicks} tiklama, ${m.conversions} donusum, CTR: ${m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(2) : 0}%, CPA: ${m.conversions > 0 ? (m.spend / m.conversions).toFixed(0) : 'N/A'} TL`
  ).join('\n');

  // Daily trend (last 7 days)
  const recentSnaps = input.snapshots
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const dailyTrend = recentSnaps.map(s =>
    `${s.date}: ${s.platform} — ${s.spend.toFixed(0)} TL, ${s.clicks} tik, ${s.conversions} don, CTR: ${s.ctr.toFixed(2)}%`
  ).join('\n');

  // Total metrics
  const totalSpend = input.snapshots.reduce((s, snap) => s + snap.spend, 0);
  const totalClicks = input.snapshots.reduce((s, snap) => s + snap.clicks, 0);
  const totalConversions = input.snapshots.reduce((s, snap) => s + snap.conversions, 0);
  const totalImpressions = input.snapshots.reduce((s, snap) => s + snap.impressions, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const prompt = `Sen dijital reklam performans analistisin. Kampanya performans verilerini analiz ederek, somut optimizasyon onerileri ureteceksin.

## Kampanya Bilgileri
- Kampanya Adi: ${input.campaignName}
- Hedef: ${input.objective}
- Toplam Butce: ${input.totalBudget} ${input.currency}/ay
- Calisma Suresi: ${input.daysRunning} gun
${input.targetMetrics?.targetCPA ? `- Hedef CPA: ${input.targetMetrics.targetCPA} ${input.currency}` : ''}
${input.targetMetrics?.targetROAS ? `- Hedef ROAS: ${input.targetMetrics.targetROAS}x` : ''}

## Toplam Metrikler
- Toplam Harcama: ${totalSpend.toFixed(0)} ${input.currency}
- Toplam Gosterim: ${totalImpressions.toLocaleString()}
- Toplam Tiklama: ${totalClicks.toLocaleString()}
- Toplam Donusum: ${totalConversions}
- Ortalama CTR: ${avgCTR.toFixed(2)}%
- Ortalama CPA: ${avgCPA.toFixed(0)} ${input.currency}

## Platform Bazli Performans
${platformSummary}

## Son 7 Gun Trend
${dailyTrend}

## KURALLAR
1. Veriye dayali SOMUT oneriler ver
2. Anomalileri tespit et (onceki gune gore %30+ degisim)
3. Platform karsilastirmasi yap — dusuk performans gostereni belirle
4. Butce verimliligi analizi yap — butce tukeniyor mu, yeterli mi?
5. Her oneri UYGULANABILIR olmali
6. Trend analizi yap — haftalik iyilesme/kotulesme var mi?
7. Turkce yaz

## CIKTI FORMATI (JSON)
{
  "overallScore": 0,
  "summary": "string — 2-3 cumlelik genel performans ozeti",
  "kpiAnalysis": [
    {
      "metric": "string — CTR, CPA, ROAS, vb.",
      "current": "string — mevcut deger",
      "target": "string — hedef deger",
      "status": "above_target | on_target | below_target | critical",
      "trend": "improving | stable | declining",
      "recommendation": "string — somut oneri"
    }
  ],
  "platformComparison": [
    {
      "platform": "string",
      "spend": 0,
      "performance": "Yuksek | Orta | Dusuk",
      "recommendation": "string"
    }
  ],
  "anomalies": [
    {
      "date": "string",
      "metric": "string",
      "change": "string — %50 artis gibi",
      "possibleCause": "string"
    }
  ],
  "optimizationSuggestions": [
    {
      "type": "budget_shift | targeting | creative | bid | schedule",
      "title": "string",
      "description": "string",
      "expectedImprovement": "string",
      "priority": "high | medium | low"
    }
  ],
  "budgetEfficiency": {
    "spendRate": "string — gunluk ortalama harcama",
    "burnRate": "string — butcenin ne kadarini harcadi",
    "projectedEndDate": "string — bu hizla butce ne zaman biter",
    "recommendation": "string"
  },
  "weeklyTrend": "string — haftalik trend ozeti"
}`;

  return generateJSON<PerformanceAnalysisOutput>(
    'pro',
    prompt,
    'performanceAnalyst',
    { temperature: 0.5, maxOutputTokens: 6144 }
  );
}
