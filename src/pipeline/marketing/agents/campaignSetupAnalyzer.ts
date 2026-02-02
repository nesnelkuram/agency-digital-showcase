import { generateJSON } from '../../geminiClient';

// ============================================
// Input / Output Types
// ============================================

export interface SetupAnalysisInput {
  campaignName: string;
  objective: string;
  status: string;
  platforms: string[];
  budget: {
    totalBudget: number;
    dailyLimit?: number;
    currency: string;
  };
  schedule: {
    startDate: string;
    endDate?: string;
  };
  adSetCount: number;
  adSets: Array<{
    name: string;
    status: string;
    budget: { daily: number; lifetime?: number };
    bidStrategy: string;
    optimizationGoal?: string;
    targetingJson?: Record<string, any>;
    adCount: number;
    ads: Array<{
      name: string;
      status: string;
      type: string;
      hasImage: boolean;
      hasVideo: boolean;
      headline: string;
      primaryText: string;
      callToAction: string;
    }>;
  }>;
  performance?: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCTR: number;
    averageCPA: number;
  };
}

export interface SetupAnalysisOutput {
  overallScore: number; // 0-100
  summary: string;
  categories: Array<{
    category: string;
    score: number;
    status: 'good' | 'warning' | 'critical';
    findings: string[];
    recommendations: string[];
  }>;
  quickWins: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

// ============================================
// Agent
// ============================================

export async function runCampaignSetupAnalyzer(
  input: SetupAnalysisInput
): Promise<SetupAnalysisOutput> {

  // Build ad sets detail block
  const adSetDetails = input.adSets.map((adSet, i) => {
    const targeting = adSet.targetingJson
      ? JSON.stringify(adSet.targetingJson, null, 2)
      : 'Belirtilmemis';

    const adsInfo = adSet.ads.map((ad, j) =>
      `    Reklam ${j + 1}: "${ad.name}" [${ad.status}] tip=${ad.type}, gorsel=${ad.hasImage ? 'var' : 'yok'}, video=${ad.hasVideo ? 'var' : 'yok'}, baslik="${ad.headline}", CTA=${ad.callToAction}`
    ).join('\n');

    return `  Ad Set ${i + 1}: "${adSet.name}" [${adSet.status}]
    Gunluk Butce: ${adSet.budget.daily} ${input.budget.currency}${adSet.budget.lifetime ? `, Yasam Boyu: ${adSet.budget.lifetime} ${input.budget.currency}` : ''}
    Teklif Stratejisi: ${adSet.bidStrategy}
    Optimizasyon Hedefi: ${adSet.optimizationGoal || 'Belirtilmemis'}
    Hedefleme: ${targeting}
    Reklam Sayisi: ${adSet.adCount}
${adsInfo}`;
  }).join('\n\n');

  // Build performance block if available
  let performanceBlock = '';
  if (input.performance) {
    const p = input.performance;
    performanceBlock = `
## Performans Verisi (Mevcut)
- Toplam Harcama: ${p.totalSpend.toFixed(2)} ${input.budget.currency}
- Toplam Gosterim: ${p.totalImpressions.toLocaleString()}
- Toplam Tiklama: ${p.totalClicks.toLocaleString()}
- Toplam Donusum: ${p.totalConversions}
- Ortalama CTR: ${p.averageCTR.toFixed(2)}%
- Ortalama CPA: ${p.averageCPA.toFixed(2)} ${input.budget.currency}`;
  }

  // Calculate schedule duration
  const startDate = new Date(input.schedule.startDate);
  const endDate = input.schedule.endDate ? new Date(input.schedule.endDate) : null;
  const durationDays = endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate total daily budget across ad sets
  const totalDailyAdSetBudget = input.adSets.reduce((sum, as) => sum + as.budget.daily, 0);

  const prompt = `Sen Meta (Facebook/Instagram) reklam kampanya denetim uzmanisin. Verilen kampanya yapisini analiz ederek, kurulum hatalarini tespit edecek ve iyilestirme onerileri sunacaksin.

## Kampanya Bilgileri
- Kampanya Adi: "${input.campaignName}"
- Hedef: ${input.objective}
- Durum: ${input.status}
- Platformlar: ${input.platforms.join(', ')}
- Toplam Butce: ${input.budget.totalBudget} ${input.budget.currency}
${input.budget.dailyLimit ? `- Gunluk Limit: ${input.budget.dailyLimit} ${input.budget.currency}` : '- Gunluk Limit: Belirtilmemis'}
- Baslangic: ${input.schedule.startDate}
${input.schedule.endDate ? `- Bitis: ${input.schedule.endDate} (${durationDays} gun)` : '- Bitis: Belirsiz (surekli)'}
- Ad Set Sayisi: ${input.adSetCount}
- Toplam Gunluk Ad Set Butcesi: ${totalDailyAdSetBudget} ${input.budget.currency}
${performanceBlock}

## Ad Set Detaylari
${adSetDetails}

## DEGERLENDIRME KATEGORILERI VE KRITERLERI

### 1. Hedefleme (Targeting)
- Hedefleme tanimli mi? Cok genis mi (tum Turkiye, 18-65+)? Cok dar mi?
- Yas, cinsiyet, konum, ilgi alanlari yeterli mi?
- Lookalike veya custom audience kullaniliyor mu?
- Her ad set farkli bir kitle mi hedefliyor (A/B test icin)?

### 2. Butce (Budget)
- Gunluk butce, toplam butceye oranla makul mu?
- Ad set'ler arasinda butce dagitimi dengeli mi?
- Gunluk butce, secilen hedefe gore yeterli mi? (donusum hedefinde minimum 5x CPA)
- Butce ile reklam sayisi uyumlu mu? (cok reklam, az butce = ogrenme asamasindan cikamaz)

### 3. Kreatifler (Creatives)
- Her ad set'te en az 3-5 reklam var mi?
- Gorsel ve video cesitliligi var mi?
- Basliklar yeterli uzunlukta mu? (bos veya cok kisa olanlar)
- CTA (Call to Action) uygun secilmis mi?
- Farkli reklam tipleri (carousel, video, single image) denenmiyor mu?

### 4. Reklam Setleri (Ad Sets)
- Ad set sayisi makul mu? (1 = test yok, 10+ = butce dagilimi sorunu)
- Optimizasyon hedefleri dogru secilmis mi?
- Teklif stratejileri kampanya hedefiyle uyumlu mu?
- Durum tutarliligi: aktif kampanyada pasif ad set var mi?

### 5. Yapi (Structure)
- Isimlendirme kurali var mi? (ornegin: [kitle]_[hedef]_[tarih] gibi)
- Kampanya hedefi ile ad set optimizasyon hedefleri uyumlu mu?
- Gereksiz yineleme var mi? (ayni hedefleme, ayni reklam)

### 6. Zamanlama (Schedule)
- Baslangic tarihi gecmiste mi, gelecekte mi?
- Bitis tarihi belirlenmis mi? (surekli calisma butce riskidir)
- Kampanya suresi hedefe uygun mu? (bilinirlik icin en az 2 hafta, donusum icin 4+ hafta)

## PUANLAMA KURALLARI
- Her kategori 0-100 arasi puanlanir
- 80-100: "good" — Az veya hic sorun yok
- 50-79: "warning" — Iyilestirme alani var
- 0-49: "critical" — Ciddi sorunlar mevcut
- overallScore: Tum kategorilerin agirlikli ortalamasi (Hedefleme: %25, Butce: %20, Kreatifler: %20, Ad Setler: %15, Yapi: %10, Zamanlama: %10)

## QUICK WINS KURALLARI
- En kolay, en hizli uygulanabilir iyilestirmeleri listele
- Her quick win SOMUT ve UYGULANABILIR olmali
- Impact seviyesi: iyilestirmenin beklenen etkisine gore

## KURALLAR
1. SOMUT ve SPESIFIK bulgular yaz — "hedefleme genis" degil, "18-65+ yas araligi cok genis, 25-45 olarak daraltilmali" gibi
2. Her oneri UYGULANABILIR olmali — ne yapilacagi ACIK olmali
3. Performans verisi varsa, kurulum bulgularini performansla iliskilendir
4. Turkce yaz
5. Findings en az 1, en fazla 5 madde olmali
6. Recommendations en az 1, en fazla 4 madde olmali

## CIKTI FORMATI (JSON)
{
  "overallScore": 0,
  "summary": "string — 2-3 cumlelik genel degerlendirme ozeti",
  "categories": [
    {
      "category": "Hedefleme | Butce | Kreatifler | Reklam Setleri | Yapi | Zamanlama",
      "score": 0,
      "status": "good | warning | critical",
      "findings": ["string — tespit edilen bulgular"],
      "recommendations": ["string — iyilestirme onerileri"]
    }
  ],
  "quickWins": [
    {
      "title": "string — kisa baslik",
      "description": "string — ne yapilmali, neden yapilmali",
      "impact": "high | medium | low"
    }
  ]
}`;

  return generateJSON<SetupAnalysisOutput>(
    'flash',
    prompt,
    'campaignSetupAnalyzer',
    { temperature: 0.4, maxOutputTokens: 4096 }
  );
}
