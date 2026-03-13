import { runDeepResearch, pollDeepResearch, startDeepResearch, generateGroundedText, generateJSON } from '../geminiClient';
import type { PipelineInput, ResearchFindings, BusinessContextInput } from '../types';
import { getSectorEnrichment } from '../sectorEnrichment';

export interface SectorResearchOptions {
  drInteractionId?: string;  // pre-started DR interaction to poll
  drTimeout?: number;        // DR poll timeout (default 240s)
  startTimeMs?: number;      // caller start time for budget tracking
  budgetMs?: number;         // total caller budget (e.g. 290_000)
}

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
export function buildDeepResearchPrompt(businessName: string, sector: string, businessContext?: BusinessContextInput, adminNotes?: string): string {
  // Enrich prompt with business context when available
  const descLine = businessContext?.businessDescription
    ? `\nIsletme Tanimi (Musteri Beyani): ${businessContext.businessDescription}`
    : '';
  const competitorLine = businessContext?.competitors
    ? `\nMusterinin Bildirdigi Rakipler: ${businessContext.competitors}`
    : '';
  const geoLine = businessContext?.geoScope
    ? `\nHedef Pazar: ${businessContext.geoScope}`
    : '';

  // Check for sector-specific enrichment module
  const enrichment = getSectorEnrichment(sector);
  const t = enrichment?.terminologyOverrides;

  // Sector-specific extra steps (ADIM 6+)
  const extraSteps = enrichment?.deepResearchSteps?.replace(/\$BUSINESS_NAME/g, businessName) || '';

  // Admin notes — critical context override
  const adminNotesBlock = adminNotes?.trim()
    ? `\n\n⚠️ KRITIK ADMIN NOTU — BU BILGIYI KESINLIKLE DIKKATE AL:\n${adminNotes.trim()}\nBu not, isletmeyi taniyan uzman tarafindan eklenmistir. Arastirmani bu nota UYGUN sekilde yonlendir. Bu notla celisen varsayimlar YAPMA.\n`
    : '';

  return `Sen bir sektor arastirmacisisin. Asagidaki marka hakkinda KAPSAMLI ve ${t?.researchType || 'URUN BAZLI'} bir arastirma yap.
${adminNotesBlock}
Marka: ${businessName}
Sektor: ${sector}${descLine}${competitorLine}${geoLine}

ARASTIRMA ADIMLARI (sirayla uygula):

ADIM 1 — MARKANIN KENDISI:
- "${businessName}" web sitesini bul ve ziyaret et.${businessContext?.businessDescription ? `\n- Musterinin kendi tanimi: "${businessContext.businessDescription}" — bu bilgiyi arastirmani yonlendirmek icin kullan.` : ''}
- ${t?.productLabel || 'Hangi URUN ve HIZMETLERI sunuyor? Her birini listele.'}
- Fiyat araliklari nedir? (mumkunse gercek fiyatlar${t?.priceDetail || ''})
- Kendini nasil konumlandiriyor? (${t?.positioningExamples || 'ucuz/orta/premium'})
- Alt markalari varsa her birini ayri ayri incele.

ADIM 2 — ${t?.competitorAnalysisLabel || 'URUN BAZLI RAKIP ANALIZI'}:${businessContext?.competitors ? `\n- Musterinin bildirdigi rakipler: ${businessContext.competitors} — BUNLARI ONCELIKLI olarak arastir.` : ''}
- ${t ? (t.competitorSearchExample.includes('Ornek') ? t.competitorSearchExample : `Adim 1'de buldugun HER urun/hizmet kategorisi icin dogrudan rakipleri arastir.\n- ${t.competitorSearchExample}`) : "Adim 1'de buldugun HER urun/hizmet kategorisi icin dogrudan rakipleri arastir.\n- Ornek: Eger marka \"findik kremasi\" satiyorsa → \"findik kremasi markalari Turkiye\" ara."}
- Her rakibin web sitesini ziyaret et.
- ${t?.competitorMetrics || 'Rakip urun fiyatlarini karsilastir.'}
- Her rakibin guclu ve zayif yanlarini belirle (somut: ${t?.competitorStrengthsContext || 'urun cesitliligi, dagitim agi, fiyat, kalite algisi'}).
- EN AZ 4, EN FAZLA 8 rakip bul.

ADIM 3 — PAZAR VERILERI:
- ${t?.marketDataFocus || "Bu URUN KATEGORISININ (genel sektor degil, spesifik urun!) Turkiye'deki pazar buyuklugu."}${businessContext?.geoScope ? `\n- Musteri hedef pazari: ${businessContext.geoScope} — pazar verilerini BU COGRAFYAYA odakla.` : ''}
- Yillik buyume orani veya trend yonu.
- Tuketici davranislari: Kim aliyor, nasil aliyor, ne siklikla aliyor.
- Fiyat hassasiyeti: Tuketiciler fiyat icin marka degistirir mi?

ADIM 4 — HEDEF KITLE PROFILI:
- ${t?.audienceLabel || 'Bu urunleri gercekte kimler satin aliyor?'}
${t?.audienceDetails?.map(d => `- ${d}`).join('\n') || '- Yas araligi, gelir duzeyi, yasadiklari sehirler.\n- Satin alma motivasyonlari (fiyat, kalite, marka, organik/dogal icerikleri vb.).\n- Hangi kanallarda alisveris yapiyorlar (market, online, organik dukkan vb.).'}

ADIM 5 — DIJITAL VARLIK ANALIZI:
- "${businessName}" Instagram hesabini bul ve analiz et.${businessContext?.instagramHandle ? `\n  - Instagram kullanici adi: ${businessContext.instagramHandle}` : ''}
  - Paylasim sikligi, icerik temalari, gorsel tarzi, takipci sayisi tahmini.
  - Son gonderilerdeki yorumlara bak — ${t?.customerTerm || 'musteriler'} ne diyor?
  - Icerik karmasi: foto, video, Reel, carousel oranlarini tahmin et.
- "${businessName}" web sitesini UX acisindan degerlendir:${businessContext?.websiteUrl ? `\n  - Web sitesi: ${businessContext.websiteUrl}` : ''}
  - ${t?.websiteAnalysisFocus || 'Urun cesitliligi, fiyat gosterimi, mobil uyumluluk.'}
  - Hangi CTA'lar var, guveni artiran unsurlar neler?
  - Genel tasarim kalitesi ve profesyonellik.
- Rakiplerin Instagram ve web sitelerini de kiyasla — hangisi dijitalde daha guclu?${extraSteps}

SONUCLARI DETAYLI OLARAK TURKCE YAZ. Her bilginin kaynagini belirt.`;
}

// --- Grounding-based fallback ---
async function runGroundingFallback(businessName: string, sector: string, adminNotes?: string) {
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const adminNotesRule = adminNotes?.trim()
    ? `\n\nKRITIK ADMIN NOTU: ${adminNotes.trim()} — Bu notu arastirma sirasinda KESINLIKLE dikkate al.`
    : '';
  const dateRule = `\n\nONEMLI: Bugun ${today} tarihidir. SADECE 2025-2026 yilina ait GUNCEL verileri ara. 2024 ve oncesi veriler YETERSIZDIR — daha guncel kaynak bul. Resmi kurum raporlari (TUIK, TMO, sanayi birlikleri, ihracatci birlikleri) ONCELIKLI kaynaktir.${adminNotesRule}`;

  const enrichment = getSectorEnrichment(sector);

  // Use sector-specific prompts if available, otherwise generic
  const competitorPrompt = enrichment
    ? enrichment.groundingPromptOverrides.competitor(businessName, dateRule)
    : `Sen bir sektor arastirmacisisin. ${sector} sektorunde Turkiye'de faaliyet gosteren ve "${businessName}" ile ayni segmentte rekabet eden markalari arastir. Her rakip icin gercek marka adi, web sitesi, konumlandirma, guclu/zayif yanlar, tahmini olcek bul. EN AZ 3, EN FAZLA 7 rakip. Turkce yaz.${dateRule}`;

  const marketPrompt = enrichment
    ? enrichment.groundingPromptOverrides.market(businessName, dateRule)
    : `Sen bir pazar arastirmacisisin. ${sector} sektoru icin Turkiye pazar buyuklugu, buyume hizi, tuketici profili, satin alma davranislari, dijital trendler arastir. Somut rakamlar ver. Turkce yaz.${dateRule}`;

  const trendPrompt = enrichment
    ? enrichment.groundingPromptOverrides.trend(businessName, dateRule)
    : `${sector} sektoru ${businessName} icin firsatlar, tehditler, sektor standartlari, benchmark metrikler arastir. Turkce yaz.${dateRule}`;

  // Extra grounding queries from sector module
  const extraQueryDefs = enrichment?.extraGroundingQueries(businessName, dateRule) || [];
  const extraQueries = extraQueryDefs.map(q =>
    generateGroundedText(q.prompt, q.label, { maxOutputTokens: 8192 })
  );

  const [competitorRes, marketRes, trendRes, ...extraResults] = await Promise.all([
    generateGroundedText(competitorPrompt, 'SectorResearch-Competitors', { maxOutputTokens: 8192 }),
    generateGroundedText(marketPrompt, 'SectorResearch-Market', { maxOutputTokens: 8192 }),
    generateGroundedText(trendPrompt, 'SectorResearch-Trends', { maxOutputTokens: 8192 }),
    ...extraQueries,
  ]);

  let allSourceUrls: Array<{ title: string; url: string }> = [];
  let allSearchQueries: string[] = [];
  let sourcesUsed = 0;

  // Build grounded text with extra sections
  let extraSections = '';
  if (extraResults.length > 0 && extraQueryDefs.length > 0) {
    extraSections = extraResults.map((res, i) => {
      const label = extraQueryDefs[i]?.label?.replace('SectorResearch-', '') || `Extra-${i + 1}`;
      return `\n\n## ${label.toUpperCase()}\n${res?.text || ''}`;
    }).join('');
  }
  const allGroundedText = `## RAKIP ANALIZI\n${competitorRes.text}\n\n## PAZAR VE HEDEF KITLE\n${marketRes.text}\n\n## TRENDLER VE FIRSATLAR\n${trendRes.text}${extraSections}`;

  for (const res of [competitorRes, marketRes, trendRes, ...extraResults]) {
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
export async function runSectorResearch(
  input: PipelineInput,
  options?: SectorResearchOptions,
): Promise<ResearchFindings> {
  const { contact, sector, adminNotes } = input;
  const businessName = contact.businessName;
  const drTimeout = options?.drTimeout ?? 240_000;

  let researchText = '';
  let allSourceUrls: Array<{ title: string; url: string }> = [];
  let allSearchQueries: string[] = [];
  let sourcesUsed = 0;
  let researchMethod = 'none';

  // Primary: Deep Research
  try {
    if (options?.drInteractionId) {
      // Pre-started DR — just poll
      console.log(`SectorResearch: Polling pre-started DR (${options.drInteractionId}), timeout=${drTimeout}ms`);
      const drResult = await pollDeepResearch(options.drInteractionId, drTimeout);

      if (drResult.status === 'completed' && drResult.text.length > 200) {
        researchText = drResult.text;
        researchMethod = 'deep-research';
        console.log(`SectorResearch: Deep Research completed (${researchText.length} chars)`);
      } else {
        console.log(`SectorResearch: Deep Research ${drResult.status}, falling back to grounding...`);
      }
    } else {
      // Start + poll DR (sync pipeline path)
      console.log('SectorResearch: Starting Deep Research...');
      const drResult = await runDeepResearch(
        buildDeepResearchPrompt(businessName, sector, input.businessContext, adminNotes),
        drTimeout,
      );

      if (drResult.status === 'completed' && drResult.text.length > 200) {
        researchText = drResult.text;
        researchMethod = 'deep-research';
        console.log(`SectorResearch: Deep Research completed (${researchText.length} chars)`);
      } else {
        console.log(`SectorResearch: Deep Research ${drResult.status}, falling back to grounding...`);
      }
    }
  } catch (error) {
    console.error('SectorResearch: Deep Research failed:', error);
  }

  // Fallback: Grounding (if Deep Research didn't work)
  if (!researchText) {
    // Check if we have enough time for grounding (needs ~40s) + extraction (~30s)
    const callerRemaining = options?.startTimeMs && options?.budgetMs
      ? options.budgetMs - (Date.now() - options.startTimeMs)
      : Infinity;

    if (callerRemaining < 70_000) {
      console.log(`SectorResearch: Skipping grounding fallback — only ${Math.round(callerRemaining / 1000)}s remaining (need 70s)`);
      return { ...EMPTY_RESEARCH, searchQueries: [`${businessName} ${sector} Turkiye`], sourcesUsed: 0 };
    }

    try {
      console.log('SectorResearch: Running grounding fallback...');
      const fb = await runGroundingFallback(businessName, sector, adminNotes);
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
    console.log(`SectorResearch: Insufficient text (${researchText.length} chars), returning empty`);
    return { ...EMPTY_RESEARCH, searchQueries: allSearchQueries, sourcesUsed };
  }

  console.log(`SectorResearch: Using ${researchMethod} data (${researchText.length} chars, ${sourcesUsed} sources)`);

  return extractResearchJSON(
    researchText,
    allSourceUrls,
    allSearchQueries,
    researchMethod === 'deep-research' ? -1 : sourcesUsed,
    sector,
  );
}

// --- Exported: extract structured JSON from raw research text ---
export async function extractResearchJSON(
  researchText: string,
  sourceUrls: Array<{ title: string; url: string }> = [],
  searchQueries: string[] = [],
  sourcesUsedCount: number = 0,
  sector?: string,
): Promise<ResearchFindings> {
  if (!researchText || researchText.length < 100) {
    console.log(`extractResearchJSON: Insufficient text (${researchText?.length || 0} chars), returning empty`);
    return { ...EMPTY_RESEARCH, searchQueries, sourcesUsed: sourcesUsedCount, sourceUrls, rawSnippets: [researchText?.slice(0, 10000) || ''] };
  }

  // Get sector-specific enrichment for extraction
  const enrichment = sector ? getSectorEnrichment(sector) : null;
  const t = enrichment?.terminologyOverrides;

  const sectorSchemaFragment = enrichment?.extractionSchemaFragment || '';
  const sectorExtractionRules = enrichment?.extractionRules || '';

  const extractionPrompt = `Asagidaki arastirma metnini analiz ederek JSON yapisinda yapilandir.
ONEMLI: Metinde gecen TUM somut bilgileri koru. Bilgi UYDURMADAN sadece metinde olan bilgileri yapilandir.

## Arastirma Metni
${researchText.slice(0, 40000)}

${sourceUrls.length > 0 ? `## Kaynaklar\n${sourceUrls.map((s) => `- [${s.title}](${s.url})`).join('\n')}` : ''}

---
JSON yapisi:
{
  "competitors": [
    {
      "name": "Gercek ${t ? (sector === 'hospitality' ? 'otel' : sector === 'gastronomi' ? 'restoran' : 'marka') : 'marka'} adi",
      "website": "Web sitesi URL'si",
      "positioning": "Pazar konumlandirmasi ve fiyat segmenti",
      "strengths": ["Guclu yan 1", "Guclu yan 2"],
      "weaknesses": ["Zayif yan 1"],
      "estimatedScale": "Olcek bilgisi",
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
  "sectorBenchmarks": ["Benchmark 1"]${sectorSchemaFragment}
}

KURALLAR:
1. EN AZ 3 rakip. Metinde adi gecen TUM rakipleri dahil et.
2. Urun bazli rakip bilgileri oncelikli (sadece sektor degil, spesifik urun kategorisi).
3. Metinde olmayan bilgiyi UYDURMADAN "Veri bulunamadi" yaz.
4. Tum metinler TURKCE.
5. Sadece JSON don.${sectorExtractionRules}`;

  try {
    type ResearchJSON = Omit<ResearchFindings, 'searchQueries' | 'sourcesUsed' | 'sourceUrls' | 'rawSnippets'>;
    const parsed = await generateJSON<ResearchJSON>('pro', extractionPrompt, 'SectorResearch-Extract', {
      temperature: 0.5,
      maxOutputTokens: 8192,
    });

    // Extract sector-specific data field
    const sectorDataField = enrichment?.dataFieldName;
    const sectorData = sectorDataField ? (parsed as any)[sectorDataField] : undefined;

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
      searchQueries,
      sourcesUsed: sourcesUsedCount,
      sourceUrls,
      rawSnippets: [researchText.slice(0, 10000)],
      ...(sectorDataField && sectorData ? { [sectorDataField]: sectorData } : {}),
    };
  } catch (error) {
    console.error('extractResearchJSON: JSON extraction failed:', error);
    return {
      ...EMPTY_RESEARCH,
      searchQueries,
      sourcesUsed: sourcesUsedCount,
      sourceUrls,
      rawSnippets: [researchText.slice(0, 10000)],
    };
  }
}
