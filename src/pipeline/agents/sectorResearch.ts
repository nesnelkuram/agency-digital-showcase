import { runDeepResearch, generateGroundedText, generateJSON } from '../geminiClient';
import type { PipelineInput, ResearchFindings } from '../types';

const EMPTY_RESEARCH: ResearchFindings = {
  competitors: [],
  marketData: {
    marketSize: 'Veri bulunamadi',
    growthRate: 'Veri bulunamadi',
    keyPlayers: [],
    consumerTrends: [],
    regulatoryFactors: [],
  },
  targetAudienceInsights: {
    demographics: 'Veri bulunamadi',
    psychographics: 'Veri bulunamadi',
    painPoints: [],
    purchaseBehavior: 'Veri bulunamadi',
  },
  opportunities: [],
  threats: [],
  sectorBenchmarks: [],
  searchQueries: [],
  sourcesUsed: 0,
  sourceUrls: [],
  rawSnippets: [],
};

// --- Deep Research prompt: product-level investigation ---
function buildDeepResearchPrompt(businessName: string, sector: string): string {
  return `Sen bir sektor arastirmacisisin. Asagidaki marka hakkinda KAPSAMLI ve URUN BAZLI bir arastirma yap.

Marka: ${businessName}
Sektor: ${sector}

ARASTIRMA ADIMLARI (sirayla uygula):

ADIM 1 — MARKANIN KENDISI:
- "${businessName}" web sitesini bul ve ziyaret et.
- Hangi URUN ve HIZMETLERI sunuyor? Her birini listele.
- Fiyat araliklari nedir? (mumkunse gercek fiyatlar)
- Kendini nasil konumlandiriyor? (ucuz/orta/premium)
- Alt markalari varsa her birini ayri ayri incele.

ADIM 2 — URUN BAZLI RAKIP ANALIZI:
- Adim 1'de buldugun HER urun/hizmet kategorisi icin dogrudan rakipleri arastir.
- Ornek: Eger marka "findik kremasi" satiyorsa → "findik kremasi markalari Turkiye" ara.
- Her rakibin web sitesini ziyaret et.
- Rakip urun fiyatlarini karsilastir.
- Her rakibin guclu ve zayif yanlarini belirle (somut: urun cesitliligi, dagitim agi, fiyat, kalite algisi).
- EN AZ 4, EN FAZLA 8 rakip bul.

ADIM 3 — PAZAR VERILERI:
- Bu URUN KATEGORISININ (genel sektor degil, spesifik urun!) Turkiye'deki pazar buyuklugu.
- Yillik buyume orani veya trend yonu.
- Tuketici davranislari: Kim aliyor, nasil aliyor, ne siklikla aliyor.
- Fiyat hassasiyeti: Tuketiciler fiyat icin marka degistirir mi?

ADIM 4 — HEDEF KITLE PROFILI:
- Bu urunleri gercekte kimler satin aliyor?
- Yas araligi, gelir duzeyi, yasadiklari sehirler.
- Satin alma motivasyonlari (fiyat, kalite, marka, organik/dogal icerikleri vb.).
- Hangi kanallarda alisveris yapiyorlar (market, online, organik dukkan vb.).

SONUCLARI DETAYLI OLARAK TURKCE YAZ. Her bilginin kaynagini belirt.`;
}

// --- Grounding-based fallback (3 parallel searches) ---
async function runGroundingFallback(businessName: string, sector: string) {
  const competitorPrompt = `Sen bir sektor arastirmacisisin. ${sector} sektorunde Turkiye'de faaliyet gosteren ve "${businessName}" ile ayni segmentte rekabet eden markalari arastir. Her rakip icin gercek marka adi, web sitesi, konumlandirma, guclu/zayif yanlar, tahmini olcek bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.`;
  const marketPrompt = `Sen bir pazar arastirmacisisin. ${sector} sektoru icin Turkiye pazar buyuklugu, buyume hizi, tuketici profili, satin alma davranislari, dijital trendler arastir. Somut rakamlar ver. Turkce yaz.`;
  const trendPrompt = `${sector} sektoru ${businessName} icin firsatlar, tehditler, sektor standartlari, benchmark metrikler arastir. Turkce yaz.`;

  const [competitorRes, marketRes, trendRes] = await Promise.all([
    generateGroundedText(competitorPrompt, 'SectorResearch-Competitors', { maxOutputTokens: 8192 }),
    generateGroundedText(marketPrompt, 'SectorResearch-Market', { maxOutputTokens: 8192 }),
    generateGroundedText(trendPrompt, 'SectorResearch-Trends', { maxOutputTokens: 8192 }),
  ]);

  let allSourceUrls: Array<{ title: string; url: string }> = [];
  let allSearchQueries: string[] = [];
  let sourcesUsed = 0;

  const allGroundedText = `## RAKIP ANALIZI\n${competitorRes.text}\n\n## PAZAR VE HEDEF KITLE\n${marketRes.text}\n\n## TRENDLER VE FIRSATLAR\n${trendRes.text}`;

  for (const res of [competitorRes, marketRes, trendRes]) {
    if (res.groundingMetadata) {
      for (const chunk of res.groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          sourcesUsed++;
          allSourceUrls.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
        }
      }
      allSearchQueries.push(...res.groundingMetadata.webSearchQueries);
    }
  }

  const seen = new Set<string>();
  allSourceUrls = allSourceUrls.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  return { allGroundedText, allSourceUrls, allSearchQueries, sourcesUsed };
}

// --- Main research function ---
export async function runSectorResearch(input: PipelineInput): Promise<ResearchFindings> {
  const { contact, sector } = input;
  const businessName = contact.businessName;

  let researchText = '';
  let allSourceUrls: Array<{ title: string; url: string }> = [];
  let allSearchQueries: string[] = [];
  let sourcesUsed = 0;
  let researchMethod = 'none';

  // Primary: Deep Research
  try {
    console.log('SectorResearch: Starting Deep Research...');
    const drResult = await runDeepResearch(
      buildDeepResearchPrompt(businessName, sector),
      140_000, // 140s budget
    );

    if (drResult.status === 'completed' && drResult.text.length > 200) {
      researchText = drResult.text;
      researchMethod = 'deep-research';
      console.log(`SectorResearch: Deep Research completed (${researchText.length} chars)`);
    } else {
      console.log(`SectorResearch: Deep Research ${drResult.status}, falling back to grounding...`);
    }
  } catch (error) {
    console.error('SectorResearch: Deep Research failed:', error);
  }

  // Fallback: Grounding (if Deep Research didn't work)
  if (!researchText) {
    try {
      console.log('SectorResearch: Running grounding fallback...');
      const fb = await runGroundingFallback(businessName, sector);
      researchText = fb.allGroundedText;
      allSourceUrls = fb.allSourceUrls;
      allSearchQueries = fb.allSearchQueries;
      sourcesUsed = fb.sourcesUsed;
      researchMethod = 'grounding';
    } catch (error) {
      console.error('SectorResearch: Grounding fallback also failed:', error);
      return { ...EMPTY_RESEARCH, searchQueries: [`${businessName} ${sector} Turkiye`] };
    }
  }

  if (!researchText || researchText.length < 100) {
    return { ...EMPTY_RESEARCH, searchQueries: allSearchQueries, sourcesUsed };
  }

  // Extract structured JSON from research text
  const extractionPrompt = `Asagidaki arastirma metnini analiz ederek JSON yapisinda yapilandir.
ONEMLI: Metinde gecen TUM somut bilgileri koru. Bilgi UYDURMADAN sadece metinde olan bilgileri yapilandir.

## Arastirma Metni
${researchText.slice(0, 40000)}

${allSourceUrls.length > 0 ? `## Kaynaklar\n${allSourceUrls.map((s) => `- [${s.title}](${s.url})`).join('\n')}` : ''}

---
JSON yapisi:
{
  "competitors": [
    {
      "name": "Gercek marka adi",
      "website": "Web sitesi URL'si",
      "positioning": "Pazar konumlandirmasi ve fiyat segmenti",
      "strengths": ["Guclu yan 1", "Guclu yan 2"],
      "weaknesses": ["Zayif yan 1"],
      "estimatedScale": "Olcek bilgisi (sube, calisan, ciro)",
      "socialPresence": "Sosyal medya bilgisi",
      "sourceSnippet": "Bu bilginin kaynagi"
    }
  ],
  "marketData": {
    "marketSize": "Pazar buyuklugu (rakam)",
    "growthRate": "Buyume orani",
    "keyPlayers": ["Buyuk oyuncu 1"],
    "consumerTrends": ["Tuketici trendi 1"],
    "regulatoryFactors": ["Duzenleme 1"]
  },
  "targetAudienceInsights": {
    "demographics": "Yas, cinsiyet, gelir, lokasyon",
    "psychographics": "Degerler, yasam tarzi",
    "painPoints": ["Ihtiyac 1", "Ihtiyac 2"],
    "purchaseBehavior": "Satin alma davranisi"
  },
  "opportunities": ["Firsat 1", "Firsat 2"],
  "threats": ["Tehdit 1", "Tehdit 2"],
  "sectorBenchmarks": ["Benchmark 1"]
}

KURALLAR:
1. EN AZ 3 rakip. Metinde adi gecen TUM rakipleri dahil et.
2. Urun bazli rakip bilgileri oncelikli (sadece sektor degil, spesifik urun kategorisi).
3. Metinde olmayan bilgiyi UYDURMADAN "Veri bulunamadi" yaz.
4. Tum metinler TURKCE.
5. Sadece JSON don.`;

  try {
    type ResearchJSON = Omit<ResearchFindings, 'searchQueries' | 'sourcesUsed' | 'sourceUrls' | 'rawSnippets'>;
    const parsed = await generateJSON<ResearchJSON>('flash', extractionPrompt, 'SectorResearch-Extract', {
      temperature: 0.3,
      maxOutputTokens: 8192,
    });

    return {
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map((c) => ({
        name: c.name || 'Bilinmiyor',
        website: c.website || '',
        positioning: c.positioning || '',
        strengths: Array.isArray(c.strengths) ? c.strengths : [],
        weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
        estimatedScale: c.estimatedScale || '',
        socialPresence: c.socialPresence || '',
        sourceSnippet: c.sourceSnippet || '',
      })) : [],
      marketData: {
        marketSize: parsed.marketData?.marketSize || 'Veri bulunamadi',
        growthRate: parsed.marketData?.growthRate || 'Veri bulunamadi',
        keyPlayers: Array.isArray(parsed.marketData?.keyPlayers) ? parsed.marketData.keyPlayers : [],
        consumerTrends: Array.isArray(parsed.marketData?.consumerTrends) ? parsed.marketData.consumerTrends : [],
        regulatoryFactors: Array.isArray(parsed.marketData?.regulatoryFactors) ? parsed.marketData.regulatoryFactors : [],
      },
      targetAudienceInsights: {
        demographics: parsed.targetAudienceInsights?.demographics || 'Veri bulunamadi',
        psychographics: parsed.targetAudienceInsights?.psychographics || 'Veri bulunamadi',
        painPoints: Array.isArray(parsed.targetAudienceInsights?.painPoints) ? parsed.targetAudienceInsights.painPoints : [],
        purchaseBehavior: parsed.targetAudienceInsights?.purchaseBehavior || 'Veri bulunamadi',
      },
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      threats: Array.isArray(parsed.threats) ? parsed.threats : [],
      sectorBenchmarks: Array.isArray(parsed.sectorBenchmarks) ? parsed.sectorBenchmarks : [],
      searchQueries: allSearchQueries,
      sourcesUsed: researchMethod === 'deep-research' ? -1 : sourcesUsed, // -1 = Deep Research (many)
      sourceUrls: allSourceUrls,
      rawSnippets: [researchText.slice(0, 3000)],
    };
  } catch (error) {
    console.error('SectorResearch: JSON extraction failed:', error);
    return {
      ...EMPTY_RESEARCH,
      searchQueries: allSearchQueries,
      sourcesUsed,
      sourceUrls: allSourceUrls,
      rawSnippets: [researchText.slice(0, 3000)],
    };
  }
}
