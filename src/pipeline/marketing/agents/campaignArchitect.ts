import { generateJSON } from '../../geminiClient';

export interface CampaignArchitectInput {
  brief: string;
  objective: string;
  platforms: string[];
  totalBudget: number;
  currency: 'TRY' | 'USD' | 'EUR';
  duration: number;
  businessName?: string;
  sector?: string;
  brandContext?: string;
}

export interface GeneratedCampaignData {
  name: string;
  description: string;
  targeting: {
    ageRange: { min: number; max: number };
    genders: string[];
    locations: Array<{ type: string; name: string }>;
    languages: string[];
    meta?: {
      interests: string[];
      behaviors: string[];
      placements: string[];
    };
    google?: {
      keywords: Array<{ text: string; matchType: string }>;
      negativeKeywords: string[];
    };
    tiktok?: {
      interests: string[];
      hashtags: string[];
    };
    linkedin?: {
      companies: { sizes: string[]; industries: string[] };
      jobTitles: string[];
      seniority: string[];
    };
  };
  budget: {
    totalBudget: number;
    dailyLimit: number;
    currency: string;
    platformSplit: Record<string, number>;
  };
  adSets: Array<{
    id: string;
    name: string;
    platform: string;
    bidStrategy: string;
    budgetDaily: number;
    ads: Array<{
      id: string;
      name: string;
      type: string;
      creative: {
        headline: string;
        primaryText: string;
        description: string;
        callToAction: string;
        destinationUrl: string;
      };
      variant?: string;
    }>;
  }>;
  rationale: string;
  confidence: number;
}

export async function runCampaignArchitect(
  input: CampaignArchitectInput
): Promise<GeneratedCampaignData> {
  const platformList = input.platforms.join(', ');
  const budgetInfo = `${input.totalBudget} ${input.currency}`;

  const prompt = `Sen deneyimli bir dijital pazarlama uzmanisin. Asagidaki brief'e gore tam bir reklam kampanyasi olustur.

## Brief
${input.brief}

## Parametreler
- Hedef: ${input.objective}
- Platformlar: ${platformList}
- Toplam Butce: ${budgetInfo}
- Sure: ${input.duration} gun
${input.businessName ? `- Isletme: ${input.businessName}` : ''}
${input.sector ? `- Sektor: ${input.sector}` : ''}
${input.brandContext ? `\n## Marka Baglami\n${input.brandContext}` : ''}

## Gorev
Asagidaki JSON formatinda tam bir kampanya olustur. Her platform icin ayri reklam setleri ve en az 2 reklam varyanti olustur.

KURALLAR:
- Turkiye pazarina uygun hedefleme yap
- Butceyi platformlar arasi akilli dagit (performans potansiyeline gore)
- Her reklam metni Turkce olsun
- Reklam metinleri kisa, etkili ve aksiyona yonlendirici olsun
- CTA secenekleri: Simdi Al, Daha Fazla Bilgi, Kayit Ol, Indir, Iletisime Gec
- Gunluk butce limiti toplam butce / sure olarak hesapla
- Teklif stratejisi olarak genelde "lowest_cost" kullan

JSON FORMATI:
{
  "name": "Kampanya adi (brief'e uygun)",
  "description": "Kampanyanin kisa aciklamasi",
  "targeting": {
    "ageRange": { "min": 18, "max": 65 },
    "genders": ["male", "female"],
    "locations": [{ "type": "country", "name": "Turkiye" }],
    "languages": ["tr"],
    "meta": { "interests": [...], "behaviors": [...], "placements": ["facebook_feed", "instagram_feed", "instagram_stories", "instagram_reels"] },
    "google": { "keywords": [{ "text": "...", "matchType": "broad" }], "negativeKeywords": [...] },
    "tiktok": { "interests": [...], "hashtags": [...] },
    "linkedin": { "companies": { "sizes": [...], "industries": [...] }, "jobTitles": [...], "seniority": [...] }
  },
  "budget": {
    "totalBudget": ${input.totalBudget},
    "dailyLimit": ${Math.round(input.totalBudget / input.duration)},
    "currency": "${input.currency}",
    "platformSplit": { "meta": 50, "google": 30, ... }
  },
  "adSets": [
    {
      "id": "adset_1",
      "name": "Reklam Seti adi",
      "platform": "meta",
      "bidStrategy": "lowest_cost",
      "budgetDaily": 100,
      "ads": [
        {
          "id": "ad_1",
          "name": "Reklam adi",
          "type": "image",
          "creative": {
            "headline": "Dikkat cekici baslik",
            "primaryText": "Ana reklam metni",
            "description": "Ek aciklama",
            "callToAction": "Daha Fazla Bilgi",
            "destinationUrl": "https://example.com"
          },
          "variant": "A"
        }
      ]
    }
  ],
  "rationale": "Kampanya stratejisinin kisa aciklamasi ve neden bu yaklasimi sectiginiz",
  "confidence": 0.85
}

SADECE platform listesinde olan platformlar icin reklam seti olustur: ${platformList}
Yanit olarak SADECE JSON ver, baska bir sey yazma.`;

  console.log(`[campaignArchitect] Generating campaign for: ${input.objective}, platforms: ${platformList}, budget: ${budgetInfo}`);

  const result = await generateJSON<GeneratedCampaignData>(
    'pro',
    prompt,
    'campaignArchitect',
    { temperature: 0.7, maxOutputTokens: 8192 }
  );

  console.log(`[campaignArchitect] Generated campaign: ${result.name}, ${result.adSets?.length || 0} ad sets`);

  return result;
}
