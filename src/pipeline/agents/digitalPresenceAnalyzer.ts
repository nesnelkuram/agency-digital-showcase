import { generateJSON, generateGroundedText } from '../geminiClient';
import type { NormalizedData, ResearchFindings, BusinessContextInput, DigitalPresenceAnalysis, WebsiteAnalysis, InstagramAnalysis, PlatformPresence } from '../types';
import type { FetchedWebsite } from '../utils/websiteFetcher';
import type { InstagramPublicData } from '../utils/instagramScraper';
import type { GooglePlacesData } from '../utils/googlePlacesScraper';

export async function runDigitalPresenceAnalyzer(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  businessContext?: BusinessContextInput,
  websiteData?: FetchedWebsite | null,
  instagramData?: InstagramPublicData | null,
  googlePlacesData?: GooglePlacesData | null,
): Promise<DigitalPresenceAnalysis> {
  const businessName = normalizedData.businessName;
  const sector = normalizedData.sector;
  const handle = businessContext?.instagramHandle || '';
  const websiteUrl = businessContext?.websiteUrl || '';
  const declaredPlatforms = businessContext?.digitalPresence || [];

  // Enrich businessContext with pre-gathered data
  const enrichedFollowers = instagramData?.followerCount
    ? `${instagramData.followerCount}`
    : businessContext?.instagramFollowers;

  // Build pre-gathered context for LLM prompts
  const preGatheredContext: string[] = [];
  if (websiteData?.businessIntel) {
    const bi = websiteData.businessIntel;
    if (bi.priceRange.segment !== 'unknown') preGatheredContext.push(`Website fiyat segmenti: ${bi.priceRange.segment} (${bi.priceRange.min}-${bi.priceRange.max} ${bi.priceRange.currency})`);
    if (bi.foundingYear) preGatheredContext.push(`Kuruluş yılı: ${bi.foundingYear}`);
    if (Object.keys(bi.socialLinks).length > 0) preGatheredContext.push(`Sosyal medya linkleri: ${Object.entries(bi.socialLinks).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    if (bi.certifications.length > 0) preGatheredContext.push(`Sertifikalar: ${bi.certifications.join(', ')}`);
    if (bi.locationCount > 0) preGatheredContext.push(`Lokasyon sayısı: ${bi.locationCount}`);
  }
  if (instagramData) {
    preGatheredContext.push(`Instagram gerçek veri: @${instagramData.handle}, takipçi=${instagramData.followerCount}, post=${instagramData.postCount}, takip=${instagramData.followingCount}, verified=${instagramData.isVerified}, maturity=${instagramData.accountMaturity}`);
    if (instagramData.bio) preGatheredContext.push(`Instagram bio: ${instagramData.bio}`);
  }
  if (googlePlacesData) {
    preGatheredContext.push(`Google Maps: ${googlePlacesData.rating}/5 puan, ${googlePlacesData.reviewCount} değerlendirme, kategori=${googlePlacesData.category}, sentiment=${googlePlacesData.reviewSentiment}`);
    if (googlePlacesData.address) preGatheredContext.push(`Adres: ${googlePlacesData.address}`);
  }

  // Run website + instagram + other platforms analysis in PARALLEL
  const [website, instagram, otherPlatforms] = await Promise.all([
    analyzeWebsite(businessName, sector, websiteUrl, websiteData),
    analyzeInstagram(businessName, sector, handle, enrichedFollowers, preGatheredContext.join('\n')),
    analyzeOtherPlatforms(businessName, declaredPlatforms),
  ]);

  // Calculate overall digital score
  const scores: number[] = [];
  if (website) scores.push(website.designQuality);
  if (instagram && instagram.status === 'analyzed') {
    const engMap: Record<string, number> = { dusuk: 3, orta: 5, yuksek: 8 };
    scores.push(engMap[instagram.engagementLevel] || 4);
  }
  const platformBonus = otherPlatforms.filter(p => p.status !== 'yok').length * 0.5;
  const avgScore = scores.length > 0
    ? Math.min(10, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length + platformBonus) * 10) / 10)
    : 3;

  const maturityLevels = ['baslangic', 'gelisen', 'olgun', 'ileri'];
  const maturityIndex = avgScore <= 3 ? 0 : avgScore <= 5 ? 1 : avgScore <= 7 ? 2 : 3;

  // Identify gaps and quick wins
  const criticalGaps: string[] = [];
  const quickWins: string[] = [];

  if (!website || website.status === 'not_provided') {
    criticalGaps.push('Web sitesi analiz edilemedi veya mevcut degil');
  } else if (website.status === 'fetch_failed') {
    criticalGaps.push('Web sitesine erisilemedi — teknik sorun olabilir');
  } else {
    if (!website.mobileOptimized) criticalGaps.push('Web sitesi mobil uyumlu degil');
    if (website.products.length === 0) criticalGaps.push('Web sitesinde urun/hizmet listesi bulunamadi');
    if (!website.seoBasics.hasDescription) quickWins.push('Meta description eksik — SEO icin eklenmeli');
    if (website.callToActions.length === 0) quickWins.push('CTA butonu yok — donusum icin eklenmeli');
    if (website.trustSignals.length === 0) quickWins.push('Guven sinyalleri eksik (referanslar, sertifikalar)');
  }

  if (!instagram || instagram.status === 'not_provided') {
    criticalGaps.push('Instagram hesabi analiz edilemedi');
  } else {
    if (instagram.postingFrequency === 'duzensiz') quickWins.push('Instagram paylasim sikligi arttirilmali');
    if (instagram.engagementLevel === 'dusuk') criticalGaps.push('Instagram etkilesim orani dusuk');
  }

  if (declaredPlatforms.includes('none') || declaredPlatforms.length === 0) {
    criticalGaps.push('Dijital platform varligi cok sinirli');
  }

  return {
    website,
    instagram,
    otherPlatforms,
    overallDigitalScore: avgScore,
    digitalMaturityLevel: maturityLevels[maturityIndex],
    criticalGaps,
    quickWins,
  };
}

// --- Website Analysis ---
async function analyzeWebsite(
  businessName: string,
  sector: string,
  websiteUrl: string,
  websiteData?: FetchedWebsite | null,
): Promise<WebsiteAnalysis | null> {
  if (!websiteUrl && !websiteData) return null;

  if (!websiteData) {
    // No pre-fetched data — use grounding to analyze
    return analyzeWebsiteViaGrounding(businessName, sector, websiteUrl);
  }

  // We have HTML data — use Gemini to analyze it
  const siteContext = `
Web Sitesi: ${websiteData.url}
Baslik: ${websiteData.title}
Meta Aciklama: ${websiteData.metaDescription}
OG Tags: ${JSON.stringify(websiteData.ogTags)}
Navigasyon: ${websiteData.navigation.join(', ')}
Basliklar (h1-h3): ${websiteData.headings.join(' | ')}
CTA Butonlari: ${websiteData.ctaButtons.join(', ')}
Urun Listesi (${websiteData.productListings.length} adet): ${JSON.stringify(websiteData.productListings.slice(0, 10))}
Sayfa Icerigi (ilk 3000 karakter): ${websiteData.textContent.slice(0, 3000)}
  `.trim();

  const prompt = `Sen bir dijital pazarlama ve UX uzmansin. "${businessName}" (${sector} sektoru) markasinin web sitesini analiz et.

## Web Sitesi Verileri
${siteContext}

---

Asagidaki JSON yapisinda analiz yap:
{
  "overallImpression": "Genel degerlendirme (2-3 cumle)",
  "designQuality": 6,
  "mobileOptimized": true,
  "loadPerformance": "hizli/orta/yavas",
  "products": [{"name": "Urun adi", "price": "Fiyat", "category": "Kategori"}],
  "pricingStrategy": "premium/orta/ekonomik/belirtilmemis",
  "contentQuality": "Icerik kalitesi degerlendirmesi",
  "callToActions": ["CTA metni"],
  "trustSignals": ["Guven sinyali"],
  "strengths": ["Guclu yan"],
  "weaknesses": ["Zayif yan"],
  "recommendations": ["Oneri"]
}

KURALLAR:
1. designQuality: 1-10 arasi puan. Navigasyon yapisi, gorsel kalite, profesyonellik.
2. products: Sayfada gordugun urun/hizmetleri listele. Fiyat varsa ekle.
3. pricingStrategy: Fiyatlara gore segmenti belirle.
4. trustSignals: Referanslar, sertifikalar, musteri yorumlari, "Bize Guvenin" vb.
5. Sadece GERCEK verilere dayan — HTML'de olmayanı UYDURMA.
6. Tum metinler TURKCE.`;

  try {
    const parsed = await generateJSON<any>('flash', prompt, 'DigitalPresence-Website', {
      temperature: 0.5,
      maxOutputTokens: 4096,
    });

    return {
      url: websiteData.url,
      status: 'analyzed',
      overallImpression: parsed.overallImpression || '',
      designQuality: Math.min(10, Math.max(1, parsed.designQuality || 5)),
      mobileOptimized: parsed.mobileOptimized ?? true,
      loadPerformance: parsed.loadPerformance || 'bilinmiyor',
      products: Array.isArray(parsed.products) ? parsed.products.slice(0, 20) : [],
      pricingStrategy: parsed.pricingStrategy || 'belirtilmemis',
      contentQuality: parsed.contentQuality || '',
      callToActions: Array.isArray(parsed.callToActions) ? parsed.callToActions : [],
      trustSignals: Array.isArray(parsed.trustSignals) ? parsed.trustSignals : [],
      seoBasics: {
        hasTitle: !!websiteData.title,
        hasDescription: !!websiteData.metaDescription,
        hasOGTags: Object.keys(websiteData.ogTags).length > 0,
        title: websiteData.title || undefined,
        description: websiteData.metaDescription || undefined,
      },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error: any) {
    console.error(`DigitalPresence-Website: Analysis failed — ${error.message}`);
    return {
      url: websiteUrl || websiteData.url,
      status: 'fetch_failed',
      overallImpression: '', designQuality: 0, mobileOptimized: false,
      loadPerformance: '', products: [], pricingStrategy: 'belirtilmemis',
      contentQuality: '', callToActions: [], trustSignals: [],
      seoBasics: { hasTitle: false, hasDescription: false, hasOGTags: false },
      strengths: [], weaknesses: [], recommendations: [],
    };
  }
}

async function analyzeWebsiteViaGrounding(
  businessName: string,
  sector: string,
  websiteUrl: string,
): Promise<WebsiteAnalysis | null> {
  if (!websiteUrl) return null;

  try {
    const groundingResult = await generateGroundedText(
      `"${businessName}" markasinin web sitesi ${websiteUrl} hakkinda bilgi topla. Urunler, fiyatlar, genel tasarim kalitesi, mobil uyumluluk, icerik yapisi analiz et. Turkce yaz.`,
      'DigitalPresence-WebsiteGrounding',
      { maxOutputTokens: 4096, modelTier: 'pro' },
    );

    const analysisPrompt = `Asagidaki web sitesi arastirma verilerini JSON'a donustur:

${groundingResult.text}

JSON yapisi:
{
  "overallImpression": "string",
  "designQuality": 5,
  "mobileOptimized": true,
  "loadPerformance": "orta",
  "products": [],
  "pricingStrategy": "belirtilmemis",
  "contentQuality": "string",
  "callToActions": [],
  "trustSignals": [],
  "strengths": [],
  "weaknesses": [],
  "recommendations": []
}
Tum metinler TURKCE. Veride olmayan bilgiyi UYDURMADAN bos birak.`;

    const parsed = await generateJSON<any>('pro', analysisPrompt, 'DigitalPresence-WebsiteJSON', {
      temperature: 0.4,
      maxOutputTokens: 4096,
    });

    return {
      url: websiteUrl,
      status: 'analyzed',
      overallImpression: parsed.overallImpression || '',
      designQuality: Math.min(10, Math.max(1, parsed.designQuality || 5)),
      mobileOptimized: parsed.mobileOptimized ?? true,
      loadPerformance: parsed.loadPerformance || 'bilinmiyor',
      products: Array.isArray(parsed.products) ? parsed.products : [],
      pricingStrategy: parsed.pricingStrategy || 'belirtilmemis',
      contentQuality: parsed.contentQuality || '',
      callToActions: Array.isArray(parsed.callToActions) ? parsed.callToActions : [],
      trustSignals: Array.isArray(parsed.trustSignals) ? parsed.trustSignals : [],
      seoBasics: { hasTitle: false, hasDescription: false, hasOGTags: false },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error: any) {
    console.error(`DigitalPresence-WebsiteGrounding: Failed — ${error.message}`);
    return null;
  }
}

// --- Instagram Analysis ---
async function analyzeInstagram(
  businessName: string,
  sector: string,
  handle: string,
  followerRange?: string,
  preGatheredContext?: string,
): Promise<InstagramAnalysis | null> {
  // Even without handle, try searching by business name
  const searchTarget = handle || businessName;
  if (!searchTarget) return null;

  try {
    // If we have pre-gathered Instagram data, skip expensive grounding searches
    // This saves ~60s of Pro model grounding calls
    let combinedText = '';
    if (preGatheredContext && preGatheredContext.length > 50) {
      console.log(`analyzeInstagram: Using pre-gathered data, skipping grounding searches`);
      combinedText = `## Ön-Toplanan Gerçek Veriler\n${preGatheredContext}`;
    } else {
      // Fallback: Two parallel grounding searches (slow but necessary without pre-gathered data)
      const handleQuery = handle
        ? `site:instagram.com/${handle} "${handle}" profil bilgileri paylasimlar`
        : `"${businessName}" instagram hesabi profil`;
      const analysisQuery = `"${businessName}" instagram analiz istatistik takipci etkilesim ${sector}`;

      const [profileRes, analysisRes] = await Promise.all([
        generateGroundedText(handleQuery, 'DigitalPresence-IGProfile', { maxOutputTokens: 4096, modelTier: 'pro' }),
        generateGroundedText(analysisQuery, 'DigitalPresence-IGAnalysis', { maxOutputTokens: 4096, modelTier: 'pro' }),
      ]);

      combinedText = `## Instagram Profil Bilgileri\n${profileRes.text}\n\n## Instagram Analiz\n${analysisRes.text}`;
    }

    const prompt = `Asagidaki Instagram arastirma verilerini analiz ederek JSON olustur.

Marka: ${businessName}
Instagram Handle: ${handle || 'Bilinmiyor'}
Sektor: ${sector}
${followerRange ? `Bildirilen Takipci Araligi: ${followerRange}` : ''}

## Arastirma Verileri
${combinedText}

---
JSON yapisi:
{
  "handle": "${handle || 'bilinmiyor'}",
  "followerRange": "tahmini takipci araligi",
  "estimatedPostCount": "tahmini paylasim sayisi",
  "postingFrequency": "gunluk/haftada 3-4/haftada 1-2/duzensiz",
  "contentThemes": ["tema1", "tema2"],
  "visualStyle": "gorsel tarzi aciklamasi",
  "captionStyle": "yazi tarzi aciklamasi",
  "hashtagUsage": "hashtag kullanim degerlendirmesi",
  "engagementLevel": "dusuk/orta/yuksek",
  "contentMix": {"photoPercent": 50, "videoPercent": 20, "reelPercent": 20, "carouselPercent": 10},
  "strengths": ["guclu yan"],
  "weaknesses": ["zayif yan"],
  "recommendations": ["oneri"]
}

KURALLAR:
1. Arastirmada BULUNAN bilgileri kullan, UYDURMADAN.
2. Bulunamiyan alanlar icin makul tahminler yap ama "tahmini" olarak belirt.
3. contentMix yuzdeleri tahmini — toplam 100 olmali.
4. followerRange: ${followerRange || 'bilinmiyor'} (musteri bildirdiyse onu kullan).
5. Tum metinler TURKCE.`;

    const parsed = await generateJSON<any>('flash', prompt, 'DigitalPresence-IGStructure', {
      temperature: 0.4,
      maxOutputTokens: 4096,
    });

    return {
      handle: parsed.handle || handle || 'bilinmiyor',
      status: 'analyzed',
      followerRange: parsed.followerRange || followerRange || undefined,
      estimatedPostCount: parsed.estimatedPostCount || undefined,
      postingFrequency: parsed.postingFrequency || undefined,
      contentThemes: Array.isArray(parsed.contentThemes) ? parsed.contentThemes : [],
      visualStyle: parsed.visualStyle || '',
      captionStyle: parsed.captionStyle || '',
      hashtagUsage: parsed.hashtagUsage || '',
      engagementLevel: parsed.engagementLevel || 'bilinmiyor',
      contentMix: parsed.contentMix || {},
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (error: any) {
    console.error(`DigitalPresence-Instagram: Failed — ${error.message}`);
    if (handle) {
      return {
        handle,
        status: 'limited_data',
        followerRange: followerRange || undefined,
        contentThemes: [], visualStyle: '', captionStyle: '', hashtagUsage: '',
        engagementLevel: 'bilinmiyor', contentMix: {},
        strengths: [], weaknesses: [], recommendations: [],
      };
    }
    return null;
  }
}

// --- Other Platforms ---
async function analyzeOtherPlatforms(
  businessName: string,
  declaredPlatforms: string[],
): Promise<PlatformPresence[]> {
  const socialPlatforms = ['LinkedIn', 'TikTok', 'YouTube', 'X'];
  const results: PlatformPresence[] = [];

  for (const platform of socialPlatforms) {
    const isDeclared = declaredPlatforms.some(
      p => p.toLowerCase() === platform.toLowerCase()
    );

    results.push({
      platform,
      status: isDeclared ? 'aktif' : 'yok',
      notes: isDeclared
        ? `${businessName} ${platform} platformunda aktif oldugunu bildirdi.`
        : '',
    });
  }

  return results;
}
