import { generateJSON } from '../../geminiClient';
import type { MarketingPipelineInput, BudgetAllocatorOutput, CampaignStrategyOutput } from '../types';

export async function runBudgetAllocator(
  input: MarketingPipelineInput,
  strategy: CampaignStrategyOutput
): Promise<BudgetAllocatorOutput> {
  const { totalBudget, currency, campaignDuration, sector, goals } = input;

  // Build platform priorities from strategy
  const platformPriorities = strategy.platformStrategies.map(ps =>
    `- ${ps.platform} (${ps.priority}): ${ps.campaignType} — ${ps.objective}`
  ).join('\n');

  const prompt = `Sen dijital reklam butce optimizasyonu uzmanisin. Kampanya stratejisine ve isletme butcesine dayanarak, platform bazli butce dagilimi ve harcama plani olusturacaksin.

## Butce Parametreleri
- Toplam Aylik Butce: ${totalBudget} ${currency}
- Kampanya Suresi: ${campaignDuration} gun
- Sektor: ${sector}
- Birincil Hedef: ${goals.primaryObjective}
${goals.targetMetrics?.targetCPA ? `- Hedef CPA: ${goals.targetMetrics.targetCPA} ${currency}` : ''}
${goals.targetMetrics?.targetROAS ? `- Hedef ROAS: ${goals.targetMetrics.targetROAS}x` : ''}

## Platform Stratejisi ve Oncelikleri
${platformPriorities}

## Kampanya Zamanlama
- Faz 1: ${strategy.timeline.phase1.name} (${strategy.timeline.phase1.duration})
- Faz 2: ${strategy.timeline.phase2.name} (${strategy.timeline.phase2.duration})
- Faz 3: ${strategy.timeline.phase3.name} (${strategy.timeline.phase3.duration})

## KURALLAR
1. Birincil platformlar butcenin %50-70'ini almali
2. Ikincil platformlar %20-35
3. Destekleyici platformlar %5-15
4. Ilk hafta TEST BUTCESI ayir (%15-20) — basarisiz kanallari erken tespit etmek icin
5. Gunluk harcama limitleri belirle — ani butce tukenmesini onle
6. CPC/CPM tahminleri SEKTOR BAZLI ve GERCEKCI olmali
7. Turkiye pazari icin guncel fiyat araliklari kullan:
   - Meta: CPC 1-8 TL, CPM 15-80 TL (sektore gore)
   - Google Search: CPC 2-15 TL (keyword rekabetine gore)
   - Google Display: CPM 5-30 TL
   - TikTok: CPM 10-50 TL, CPC 1-5 TL
   - LinkedIn: CPC 15-50 TL, CPM 100-300 TL (en pahaliya platform)
   - Email: Sabit maliyet (Resend: ~$20/ay 50k email)
8. Eger toplam butce < 3000 TL ise: MAKSIMUM 2 platform oner, geri kalanini disla
9. Eger toplam butce < 1000 TL ise: SADECE 1 platform oner + email
10. ROAS beklentisi GERCEKCI olmali — ilk ayda yuksek ROAS BEKLEME
11. 3 senaryo olustur: muhafazakar, orta, agresif
12. Her senaryo icin BEKLENEN SONUCLARI belirt

## CIKTI FORMATI (JSON)
{
  "budgetPlan": {
    "totalMonthly": ${totalBudget},
    "currency": "${currency}",
    "platforms": [
      {
        "platform": "meta | google | tiktok | linkedin | email",
        "monthlyBudget": 0,
        "dailyBudget": 0,
        "estimatedCPC": 0,
        "estimatedCPM": 0,
        "estimatedReach": 0,
        "estimatedClicks": 0,
        "expectedROAS": 0
      }
    ],
    "testPhaseBudget": 0,
    "testPhaseDuration": 7,
    "rationale": "string — butce dagilimi mantigi"
  },
  "allocationRationale": "string — detayli aciklama: neden bu dagilim?",
  "scenarioAnalysis": {
    "conservative": {
      "totalBudget": 0,
      "expectedResults": "string — muhafazakar senaryoda beklenen sonuclar"
    },
    "moderate": {
      "totalBudget": ${totalBudget},
      "expectedResults": "string — orta senaryoda beklenen sonuclar"
    },
    "aggressive": {
      "totalBudget": 0,
      "expectedResults": "string — agresif senaryoda beklenen sonuclar"
    }
  },
  "warnings": ["string — butce uyarilari (yetersiz butce, yuksek rekabet, vs.)"],
  "optimizationTriggers": [
    {
      "condition": "string — tetikleyici kosul (orn: CPA > 50 TL)",
      "action": "string — yapilacak aksiyon (orn: Meta butcesini %20 dusur, Google'a kaydir)"
    }
  ]
}`;

  return generateJSON<BudgetAllocatorOutput>(
    'flash',
    prompt,
    'budgetAllocator',
    { temperature: 0.3, maxOutputTokens: 4096 }
  );
}
