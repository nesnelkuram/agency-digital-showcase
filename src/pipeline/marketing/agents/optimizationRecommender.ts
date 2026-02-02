import { generateJSON } from '../../geminiClient';

// ============================================
// Input / Output Types
// ============================================

export interface OptimizationInput {
  campaignName: string;
  objective: string;
  budget: { totalBudget: number; dailyLimit?: number; currency: string };
  adSets: Array<{
    name: string;
    metaAdSetId: string;
    budget: { daily: number };
    bidStrategy: string;
    optimizationGoal?: string;
    performanceSummary?: {
      impressions: number;
      clicks: number;
      spend: number;
      ctr: number;
      cpa: number;
      conversions: number;
    };
    ads: Array<{
      name: string;
      metaAdId: string;
      status: string;
      performanceSummary?: {
        impressions: number;
        clicks: number;
        spend: number;
        ctr: number;
        conversions: number;
      };
    }>;
  }>;
  breakdowns?: {
    ageGender?: Array<{ age: string; gender: string; spend: number; impressions: number; clicks: number; conversions: number; ctr: number }>;
    device?: Array<{ devicePlatform: string; spend: number; impressions: number; clicks: number; conversions: number }>;
    placement?: Array<{ publisherPlatform: string; platformPosition: string; spend: number; impressions: number; clicks: number; conversions: number }>;
    region?: Array<{ region: string; spend: number; impressions: number; clicks: number; conversions: number }>;
  };
  dailyTrend?: Array<{ date: string; spend: number; impressions: number; clicks: number; conversions: number; ctr: number }>;
}

export interface OptimizationOutput {
  summary: string;
  recommendations: Array<{
    type: 'budget_realloc' | 'targeting_refine' | 'creative_change' | 'pause_underperform' | 'bid_adjust' | 'scale_winner';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    currentValue: string;
    suggestedValue: string;
    expectedImprovement: string;
    confidence: number; // 0-1
    affectedEntity?: string; // ad set name or ad name
  }>;
}

// ============================================
// Agent
// ============================================

export async function runOptimizationRecommender(
  input: OptimizationInput
): Promise<OptimizationOutput> {

  // Build ad set performance summary
  const adSetPerf = input.adSets.map((adSet, i) => {
    const perf = adSet.performanceSummary;
    const perfLine = perf
      ? `Harcama: ${perf.spend.toFixed(2)} ${input.budget.currency}, Gosterim: ${perf.impressions.toLocaleString()}, Tiklama: ${perf.clicks}, Donusum: ${perf.conversions}, CTR: ${perf.ctr.toFixed(2)}%, CPA: ${perf.cpa.toFixed(2)} ${input.budget.currency}`
      : 'Performans verisi yok';

    const adsLines = adSet.ads.map((ad, j) => {
      const adPerf = ad.performanceSummary;
      const adPerfLine = adPerf
        ? `Harcama: ${adPerf.spend.toFixed(2)}, Gosterim: ${adPerf.impressions}, Tiklama: ${adPerf.clicks}, Donusum: ${adPerf.conversions}, CTR: ${adPerf.ctr.toFixed(2)}%`
        : 'Performans verisi yok';
      return `    Reklam ${j + 1}: "${ad.name}" [${ad.status}] (ID: ${ad.metaAdId}) — ${adPerfLine}`;
    }).join('\n');

    return `  Ad Set ${i + 1}: "${adSet.name}" (ID: ${adSet.metaAdSetId})
    Gunluk Butce: ${adSet.budget.daily} ${input.budget.currency}, Teklif: ${adSet.bidStrategy}, Optimizasyon: ${adSet.optimizationGoal || 'Belirtilmemis'}
    Performans: ${perfLine}
${adsLines}`;
  }).join('\n\n');

  // Build breakdown blocks
  let breakdownBlock = '';

  if (input.breakdowns?.ageGender?.length) {
    const sorted = [...input.breakdowns.ageGender].sort((a, b) => b.spend - a.spend);
    const lines = sorted.slice(0, 15).map(r =>
      `  ${r.age} / ${r.gender}: Harcama=${r.spend.toFixed(2)}, Gosterim=${r.impressions}, Tiklama=${r.clicks}, Donusum=${r.conversions}, CTR=${r.ctr.toFixed(2)}%`
    ).join('\n');
    breakdownBlock += `\n### Yas-Cinsiyet Kirilimi (en yuksek harcamadan)\n${lines}`;
  }

  if (input.breakdowns?.device?.length) {
    const lines = input.breakdowns.device.map(r =>
      `  ${r.devicePlatform}: Harcama=${r.spend.toFixed(2)}, Gosterim=${r.impressions}, Tiklama=${r.clicks}, Donusum=${r.conversions}`
    ).join('\n');
    breakdownBlock += `\n### Cihaz Kirilimi\n${lines}`;
  }

  if (input.breakdowns?.placement?.length) {
    const sorted = [...input.breakdowns.placement].sort((a, b) => b.spend - a.spend);
    const lines = sorted.slice(0, 10).map(r =>
      `  ${r.publisherPlatform} / ${r.platformPosition}: Harcama=${r.spend.toFixed(2)}, Gosterim=${r.impressions}, Tiklama=${r.clicks}, Donusum=${r.conversions}`
    ).join('\n');
    breakdownBlock += `\n### Yerlestirme Kirilimi (en yuksek harcamadan)\n${lines}`;
  }

  if (input.breakdowns?.region?.length) {
    const sorted = [...input.breakdowns.region].sort((a, b) => b.spend - a.spend);
    const lines = sorted.slice(0, 10).map(r =>
      `  ${r.region}: Harcama=${r.spend.toFixed(2)}, Gosterim=${r.impressions}, Tiklama=${r.clicks}, Donusum=${r.conversions}`
    ).join('\n');
    breakdownBlock += `\n### Bolge Kirilimi (en yuksek harcamadan)\n${lines}`;
  }

  // Build daily trend block
  let trendBlock = '';
  if (input.dailyTrend?.length) {
    const sorted = [...input.dailyTrend].sort((a, b) => a.date.localeCompare(b.date));
    const lines = sorted.map(d =>
      `  ${d.date}: Harcama=${d.spend.toFixed(2)}, Gosterim=${d.impressions}, Tiklama=${d.clicks}, Donusum=${d.conversions}, CTR=${d.ctr.toFixed(2)}%`
    ).join('\n');
    trendBlock = `\n## Gunluk Performans Trendi\n${lines}`;
  }

  // Calculate totals for context
  const totalSpend = input.adSets.reduce((sum, as) => sum + (as.performanceSummary?.spend || 0), 0);
  const totalConversions = input.adSets.reduce((sum, as) => sum + (as.performanceSummary?.conversions || 0), 0);
  const totalClicks = input.adSets.reduce((sum, as) => sum + (as.performanceSummary?.clicks || 0), 0);
  const totalImpressions = input.adSets.reduce((sum, as) => sum + (as.performanceSummary?.impressions || 0), 0);
  const overallCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const overallCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  const prompt = `Sen Meta (Facebook/Instagram) reklam optimizasyon uzmanisin. Kampanya performans verilerini ve kirilim (breakdown) verilerini analiz ederek, somut ve uygulanabilir optimizasyon onerileri ureteceksin.

## Kampanya Bilgileri
- Kampanya Adi: "${input.campaignName}"
- Hedef: ${input.objective}
- Toplam Butce: ${input.budget.totalBudget} ${input.budget.currency}
${input.budget.dailyLimit ? `- Gunluk Limit: ${input.budget.dailyLimit} ${input.budget.currency}` : ''}

## Genel Performans Ozeti
- Toplam Harcama: ${totalSpend.toFixed(2)} ${input.budget.currency}
- Toplam Gosterim: ${totalImpressions.toLocaleString()}
- Toplam Tiklama: ${totalClicks.toLocaleString()}
- Toplam Donusum: ${totalConversions}
- Genel CTR: ${overallCTR.toFixed(2)}%
- Genel CPA: ${overallCPA.toFixed(2)} ${input.budget.currency}

## Ad Set ve Reklam Detaylari
${adSetPerf}
${breakdownBlock ? `\n## Kirilim (Breakdown) Verileri${breakdownBlock}` : ''}
${trendBlock}

## ANALIZ VE ONERI ALANLARI

### 1. Butce Yeniden Dagitimi (budget_realloc)
- Dusuk performansli ad set'lerden yuksek performanslilara butce kaydirma
- CPA karsilastirmasi: En iyi ad set CPA vs en kotu ad set CPA
- Harcama/donusum oranina gore butce yeniden dagitimi onerileri
- "currentValue" = mevcut gunluk butce, "suggestedValue" = onerilen gunluk butce

### 2. Hedefleme Iyilestirmeleri (targeting_refine)
- Kirilim verilerinden en iyi performans gosteren yas/cinsiyet/cihaz/yerlestirme/bolgeler
- Dusuk donusum oranli demografik gruplari disla
- Yuksek CTR ve donusum gosteren segmentleri genislet
- "currentValue" = mevcut hedefleme, "suggestedValue" = onerilen hedefleme

### 3. Kreatif Degisiklikler (creative_change)
- Dusuk CTR'li reklamlari tespit et
- Yuksek harcama ama dusuk donusum gosterenleri isaretle
- Yeni kreatif formati oner (video, carousel, vb.)
- "affectedEntity" = reklam adi

### 4. Dusuk Performansi Durdurma (pause_underperform)
- CPA ortalamanin 2x ustunde olan ad set/reklamlar
- Yeterli gosterim almis ama hic donusum olmayan reklamlar
- Ogrenme asamasindan cikamamis ad set'ler (7+ gun, hala dusuk gosterim)
- "affectedEntity" = ad set veya reklam adi

### 5. Teklif Stratejisi Ayarlama (bid_adjust)
- Mevcut teklif stratejisi hedefe uygun mu?
- Lowest cost vs cost cap vs bid cap onerisi
- "currentValue" = mevcut strateji, "suggestedValue" = onerilen strateji

### 6. Kazanani Olceklendir (scale_winner)
- En iyi performans gosteren ad set/reklamlari tespit et
- Butce artirma veya benzer kitle olusturma onerisi
- Dikkat: Butceyi bir anda %20'den fazla artirma (ogrenme asamasi sifirlanaabilir)
- "affectedEntity" = ad set veya reklam adi

## ONERI ONCELIKLENDIRME KURALLARI
- high: Hemen uygulanmali — butce kaybediliyor veya buyuk firsat kaciriliyor
- medium: 1-3 gun icinde uygulanmali — performansi iyilestirecek
- low: Haftalik optimizasyon dongusu icinde degerlendirilmeli

## GUVEN PUANI KURALLARI
- 0.8-1.0: Veri yeterli, oneri kesin
- 0.5-0.7: Veri kisitli ama pattern goruluyor
- 0.3-0.4: Sinirli veri, dikkatli uygulanmali

## KURALLAR
1. Her oneri SOMUT olmali — "butceyi artir" degil, "Ad Set X'in gunluk butcesini 50 TL'den 80 TL'ye cikar" gibi
2. currentValue ve suggestedValue MUTLAKA doldurulmali
3. expectedImprovement OLCULEBILIR olmali — "%15-20 CPA dususu bekleniyor" gibi
4. En az 3, en fazla 10 oneri uret
5. Onerileri once priority'ye (high > medium > low), sonra confidence'a gore sirala
6. Turkce yaz
7. Veri yoksa veya yetersizse ZORLAMA ONERI URETME — confidence dusuk tut

## CIKTI FORMATI (JSON)
{
  "summary": "string — 2-3 cumlelik genel optimizasyon degerlendirmesi",
  "recommendations": [
    {
      "type": "budget_realloc | targeting_refine | creative_change | pause_underperform | bid_adjust | scale_winner",
      "priority": "high | medium | low",
      "title": "string — kisa baslik",
      "description": "string — detayli aciklama",
      "currentValue": "string — mevcut durum",
      "suggestedValue": "string — onerilen durum",
      "expectedImprovement": "string — beklenen iyilesme",
      "confidence": 0.0,
      "affectedEntity": "string — etkilenen ad set veya reklam adi (opsiyonel)"
    }
  ]
}`;

  return generateJSON<OptimizationOutput>(
    'pro',
    prompt,
    'optimizationRecommender',
    { temperature: 0.4, maxOutputTokens: 6144 }
  );
}
