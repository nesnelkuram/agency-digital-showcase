import { generateJSON } from '../../geminiClient';

// ============================================
// BUDGET FORECASTER - BUTCE TAHMIN AJANI
// ============================================

export interface BudgetForecasterInput {
  campaignName: string;
  totalBudget: number;
  currency: string;
  spentToDate: number;
  dailySpendHistory: Array<{ date: string; spend: number }>;
  scheduledEndDate?: string;
  objective: string;
  platforms: string[];
}

export interface BudgetForecasterOutput {
  projectedDepletionDate: string;    // ISO tarih
  daysRemaining: number;
  dailySpendRate: number;
  weeklyTrend: 'increasing' | 'stable' | 'decreasing';
  burndownProjection: Array<{
    date: string;
    projectedRemaining: number;
  }>;                                 // Gelecek 30 gun
  recommendations: string[];          // 3-5 Turkce oneri
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;                 // 0-1
}

export async function runBudgetForecaster(
  input: BudgetForecasterInput
): Promise<BudgetForecasterOutput> {
  const {
    campaignName,
    totalBudget,
    currency,
    spentToDate,
    dailySpendHistory,
    scheduledEndDate,
    objective,
    platforms,
  } = input;

  const remainingBudget = totalBudget - spentToDate;
  const spentPercentage = totalBudget > 0 ? ((spentToDate / totalBudget) * 100).toFixed(1) : '0';

  // Son 7 ve 14 gunluk ortalama harcama
  const sortedHistory = [...dailySpendHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const last7Days = sortedHistory.slice(0, 7);
  const last14Days = sortedHistory.slice(0, 14);

  const avg7 = last7Days.length > 0
    ? (last7Days.reduce((sum, d) => sum + d.spend, 0) / last7Days.length).toFixed(2)
    : '0';
  const avg14 = last14Days.length > 0
    ? (last14Days.reduce((sum, d) => sum + d.spend, 0) / last14Days.length).toFixed(2)
    : '0';

  const historyText = sortedHistory
    .slice(0, 30)
    .map((d) => `  ${d.date}: ${d.spend.toFixed(2)} ${currency}`)
    .join('\n');

  const prompt = `Sen dijital reklam butce analizi ve tahmin uzmanisin. Bir kampanyanin harcama verilerini analiz ederek, butce tukenme tarihini tahmin edecek ve optimizasyon onerileri sunacaksin.

## KAMPANYA BILGILERI
- Kampanya Adi: ${campaignName}
- Toplam Butce: ${totalBudget} ${currency}
- Harcanan: ${spentToDate} ${currency} (%${spentPercentage})
- Kalan Butce: ${remainingBudget} ${currency}
- Hedef: ${objective}
- Platformlar: ${platforms.join(', ')}
${scheduledEndDate ? `- Planlanan Bitis Tarihi: ${scheduledEndDate}` : '- Planlanan Bitis Tarihi: Belirlenmemis'}

## HARCAMA ISTATISTIKLERI
- Son 7 Gun Ortalama Gunluk Harcama: ${avg7} ${currency}
- Son 14 Gun Ortalama Gunluk Harcama: ${avg14} ${currency}
- Toplam Veri Gunu: ${sortedHistory.length}

## GUNLUK HARCAMA GECMISI (en yeniden eskiye)
${historyText || '  Veri yok'}

## ANALIZ GOREVLERI
1. Gunluk harcama trendini analiz et (artan/stabil/azalan)
2. Agirlikli ortalama kullanarak gelecek 30 gun icin butce projeksiyonu olustur
3. Butce tukenme tarihini hesapla
4. Kalan gun sayisini belirle
5. Risk seviyesini degerlendir:
   - low: >14 gun kaldi veya butce rahat
   - medium: 7-14 gun kaldi
   - high: 3-7 gun kaldi
   - critical: <3 gun kaldi veya butce tukenmek uzere
6. 3-5 adet Turkce optimizasyon onerisi yaz
7. Eger planlanan bitis tarihi varsa, butcenin o tarihe kadar yetip yetmeyecegini degerlendir

## ONEMLI KURALLAR
- Bugunun tarihi: ${new Date().toISOString().split('T')[0]}
- Tum tarihler ISO formatinda (YYYY-MM-DD) olmali
- Oneriler Turkce, acik ve uygulanabilir olmali
- Burndown projeksiyonu tam 30 gunluk olmali (bugun dahil)
- Confidence degeri 0-1 arasinda olmali (veri kalitesine gore)
- Eger harcama verisi 3 gunden azsa, confidence dusuk olmali (<0.5)

## CIKTI FORMATI (JSON)
{
  "projectedDepletionDate": "YYYY-MM-DD",
  "daysRemaining": 0,
  "dailySpendRate": 0,
  "weeklyTrend": "increasing | stable | decreasing",
  "burndownProjection": [
    { "date": "YYYY-MM-DD", "projectedRemaining": 0 }
  ],
  "recommendations": [
    "Turkce oneri 1",
    "Turkce oneri 2",
    "Turkce oneri 3"
  ],
  "riskLevel": "low | medium | high | critical",
  "confidence": 0.0
}`;

  return generateJSON<BudgetForecasterOutput>(
    'pro',
    prompt,
    'budgetForecaster',
    { temperature: 0.3, maxOutputTokens: 4096 }
  );
}
