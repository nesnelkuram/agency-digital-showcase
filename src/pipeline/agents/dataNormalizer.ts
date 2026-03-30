import { generateJSON } from '../geminiClient';
import { resolveAnswers, STAGE_NAMES, STAGE_QUESTION_IDS, QUESTION_MAP } from '../prompts';
import type { PipelineInput, NormalizedData, BrandMaturityLevel, DataGap } from '../types';

export async function runDataNormalizer(input: PipelineInput): Promise<NormalizedData> {

  const { contact, sector, wizard, requestedServices } = input;
  const resolvedQA = resolveAnswers(sector, wizard.answers, wizard.scores);

  const stageResultsSummary = (wizard.stageResults || [])
    .map((s: any) => `- ${s.title || 'Asama'}: ${s.description || ''} (Skor: ${s.score ?? 'N/A'})`)
    .join('\n');

  const servicesList = (requestedServices || [])
    .map((s) => s.title)
    .join(', ');

  // Admin notes (expert context — MUST override any conflicting inference)
  const adminNotesSection = input.adminNotes?.trim()
    ? `\n## ⚠️ KRITIK ADMIN NOTU (ZORUNLU)\nBu isletme hakkinda uzman tarafindan eklenen BAGLAYICI bilgiler:\n${input.adminNotes.trim()}\n\nBu notlar KESINLIKLE dikkate alinmalidir. Genel profili, sektoru ve isletme tanimini bu nota UYGUN olustur. Bu notla CELISEN cikarimlar YAPMA — admin notu diger tum varsayimlardan ONCELIKLIDIR.\n`
    : '';

  // Business context (v2.0 wizard data)
  const bc = input.businessContext;
  const businessContextSection = bc
    ? `\n## Isletme Baglam Bilgileri (Dogrudan Musteri Beyanı)
- Isletme Tanimi: ${bc.businessDescription || 'Belirtilmedi'}
- Bilinen Rakipler: ${bc.competitors || 'Belirtilmedi'}
- Cografi Kapsam: ${bc.geoScope || 'Belirtilmedi'}
- Dijital Platformlar: ${bc.digitalPresence?.join(', ') || 'Belirtilmedi'}
- Instagram Takipci: ${bc.instagramFollowers || 'Belirtilmedi'}
- Aylik Butce: ${bc.monthlyBudget || 'Belirtilmedi'}
- Isletme Asamasi: ${bc.businessStage || 'Belirtilmedi'}
- Basvuru Nedeni: ${bc.triggerReason || 'Belirtilmedi'}
- Varoluş Amacı (WHY): ${bc.brandWhy || 'Belirtilmedi'}
- Müşteri Algısı: ${bc.customerPerception || 'Belirtilmedi'}
- Mevcut Marka Varlıkları: ${bc.existingBrandAssets || 'Belirtilmedi'}
- 3 Yıllık Vizyon: ${bc.futureVision || 'Belirtilmedi'}
- Müşterinin Kiraladığı İş (JTBD): ${bc.customerJob || 'Belirtilmedi'}
- Müşterinin Mücadelesi: ${bc.customerStruggle || 'Belirtilmedi'}
- Karşı Olunan (Düşman): ${bc.brandEnemy || 'Belirtilmedi'}
`
    : '';

  const prompt = `Sen bir veri normalizasyon uzmanisisin. Asagidaki ham marka degerlendirme wizard verisini yapilandirilmis ve normalize edilmis bir formata donustur.

## Isletme Bilgileri
- Isletme Adi: ${contact.businessName}
- Sektor: ${sector}
- Talep Edilen Hizmetler: ${servicesList || 'Belirtilmedi'}

## Asama Sonuclari
${stageResultsSummary || 'Asama sonucu bulunamadi'}

## Detayli Soru-Cevaplar
${resolvedQA || 'Cevap bulunamadi'}
${businessContextSection}${adminNotesSection}
---

Yukaridaki ham verileri analiz ederek asagidaki JSON yapisinda bir cikti uret:

{
  "sector": "sektor adi",
  "businessName": "isletme adi",
  "structuredAnswers": [
    {
      "stage": 0,
      "stageName": "Asama adi",
      "questions": [
        {
          "id": "soru id",
          "question": "soru metni",
          "answer": "ham cevap degeri",
          "answerLabel": "insanlar icin okunabilir cevap etiketi",
          "score": 0
        }
      ]
    }
  ],
  "detectedPatterns": ["Cevaplar arasinda tespit edilen oruntu ve temalar (3-5 adet)"],
  "contradictions": ["Cevaplar arasinda tespit edilen celiskiler (varsa)"],
  "dataQualityScore": 0.85,
  "missingAreas": ["Eksik veya yetersiz kalan alanlar (varsa)"],
  "overallProfile": "Isletmenin genel marka profilini ozetleyen 2-3 cumlelik dogal dilde bir metin. Isletmenin sektorunu, yaklasimini, guclu yanlarini ve genel konumlandirmasini icermeli."
}

ONEMLI KURALLAR:
1. "structuredAnswers" dizisinde her asama icin (${STAGE_NAMES.join(', ')}) bir girdi olustur. Her asamadaki sorulari etiketleriyle birlikte yaz.
2. "detectedPatterns" alaninda cevaplar arasindaki tutarli temaları, tekrar eden degerleri ve ortak egilimleri belirt (3-5 adet).
3. "contradictions" alaninda birbirleriyle celisen cevaplari tespit et. Celisi yoksa bos dizi don.
4. "dataQualityScore" 0 ile 1 arasinda bir deger olmali. Tum sorular cevaplanmissa 1.0'a yakin, eksik cevaplar varsa daha dusuk.
5. "missingAreas" alaninda cevaplanmamis veya yetersiz kalan alanlari listele. Hepsi tamamsa bos dizi don.
6. "overallProfile" alaninda isletmenin genel marka profilini dogal bir dille ozetle. Isletme baglam bilgileri (isletme tanimi, cografi kapsam, isletme asamasi, dijital varlik durumu) varsa bunlari profilde kullan. Bu metin sonraki asamalarda diger ajanlar tarafindan kullanilacak.
7. Tum metinler TURKCE olmali.
8. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<NormalizedData>('flash', prompt, 'DataNormalizer', {
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  // Calculate brand maturity score from business context signals
  const brandMaturity = calculateBrandMaturity(bc);
  const dataGaps = detectDataGaps(bc);

  // Ensure required fields have fallback values
  return {
    sector: parsed.sector || sector,
    businessName: parsed.businessName || contact.businessName,
    structuredAnswers: parsed.structuredAnswers || [],
    detectedPatterns: parsed.detectedPatterns || [],
    contradictions: parsed.contradictions || [],
    dataQualityScore: typeof parsed.dataQualityScore === 'number' ? parsed.dataQualityScore : 0.5,
    missingAreas: parsed.missingAreas || [],
    overallProfile: parsed.overallProfile || `${contact.businessName} - ${sector} sektorunde faaliyet gostermektedir.`,
    brandMaturity,
    dataGaps,
  };
}

/**
 * Calculate brand maturity from business context signals.
 * 4 factors × 0-3 points = 0-12 total score.
 * No LLM call needed — pure rule-based.
 */
function calculateBrandMaturity(bc?: PipelineInput['businessContext']): NormalizedData['brandMaturity'] {
  if (!bc) {
    return { level: 'pre_brand', score: 0, factors: { businessAge: 0, brandAssets: 0, digitalPresence: 0, audienceSize: 0 }, reportFocus: 'kimlik' };
  }

  // Factor 1: Business age
  const ageMap: Record<string, number> = { idea: 0, new: 1, growing: 2, established: 3 };
  const businessAge = ageMap[bc.businessStage || ''] ?? 0;

  // Factor 2: Brand assets
  const assetMap: Record<string, number> = { none: 0, basic: 1, professional: 3 };
  const brandAssets = assetMap[bc.existingBrandAssets || ''] ?? 0;

  // Factor 3: Digital presence breadth
  const platforms = bc.digitalPresence || [];
  const hasNone = platforms.includes('none');
  const digitalPresence = hasNone ? 0 : Math.min(platforms.length, 3);

  // Factor 4: Audience size (Instagram as proxy)
  const audienceMap: Record<string, number> = { no_account: 0, '0_1k': 1, '1k_10k': 2, '10k_50k': 3, '50k_plus': 3 };
  const audienceSize = audienceMap[bc.instagramFollowers || ''] ?? 0;

  const score = businessAge + brandAssets + digitalPresence + audienceSize;

  let level: BrandMaturityLevel;
  let reportFocus: string;
  if (score <= 3) {
    level = 'pre_brand';
    reportFocus = 'kimlik';       // Önce temel kimlik oluştur
  } else if (score <= 6) {
    level = 'emerging';
    reportFocus = 'kimlik';       // Kimlik güçlendir + temel strateji
  } else if (score <= 9) {
    level = 'developing';
    reportFocus = 'strateji';     // Strateji optimize et
  } else {
    level = 'mature';
    reportFocus = 'buyume';       // Büyüme ve sadakat odaklı
  }

  return {
    level, score,
    factors: { businessAge, brandAssets, digitalPresence, audienceSize },
    reportFocus,
  };
}

/**
 * Detect data gaps — zero LLM cost.
 * Checks which data fields are available, missing, or can be auto-filled
 * by the pipeline's data gathering utilities.
 */
function detectDataGaps(bc?: PipelineInput['businessContext']): DataGap[] {
  const gaps: DataGap[] = [];

  // Wizard-sourced fields
  gaps.push({
    field: 'businessDescription',
    source: 'wizard',
    status: bc?.businessDescription ? 'complete' : 'missing',
    canAutoFill: false,
  });
  gaps.push({
    field: 'competitors',
    source: 'wizard',
    status: bc?.competitors ? 'complete' : 'missing',
    canAutoFill: true, // research can discover competitors
    dataOrigin: 'ai_inference',
  });
  gaps.push({
    field: 'brandWhy',
    source: 'wizard',
    status: bc?.brandWhy ? 'complete' : 'missing',
    canAutoFill: false,
  });
  gaps.push({
    field: 'customerPerception',
    source: 'wizard',
    status: bc?.customerPerception ? 'complete' : 'missing',
    canAutoFill: false,
  });

  // Website-sourced fields
  gaps.push({
    field: 'websiteData',
    source: 'website',
    status: bc?.websiteUrl ? 'partial' : 'missing', // partial until crawled
    canAutoFill: !!bc?.websiteUrl,
    dataOrigin: 'website_scrape',
  });
  gaps.push({
    field: 'priceRange',
    source: 'website',
    status: 'missing', // updated after website crawl finds products
    canAutoFill: !!bc?.websiteUrl,
    dataOrigin: 'website_scrape',
  });

  // Instagram-sourced fields
  const hasIG = !!(bc?.instagramHandle || bc?.instagramFollowers);
  gaps.push({
    field: 'instagramData',
    source: 'instagram',
    status: hasIG ? 'partial' : 'missing', // partial = self-reported, complete = scraped
    canAutoFill: !!bc?.instagramHandle,
    dataOrigin: hasIG ? 'wizard_input' : undefined,
  });

  // Google Places fields
  gaps.push({
    field: 'googleReviews',
    source: 'google_places',
    status: 'missing',
    canAutoFill: true,
    dataOrigin: 'website_scrape',
  });

  // Research fields
  gaps.push({
    field: 'marketData',
    source: 'research',
    status: 'missing', // updated after research phase
    canAutoFill: true,
    dataOrigin: 'grounding_search',
  });

  return gaps;
}
