import { generateGroundedText, generateJSON } from '../geminiClient';
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

export async function runSectorResearch(input: PipelineInput): Promise<ResearchFindings> {
  const { contact, sector } = input;
  const businessName = contact.businessName;

  // Step A: 3 parallel grounded calls for rich web data
  const competitorPrompt = `Sen bir sektor arastirmacisisin. ${sector} sektorunde Turkiye'de faaliyet gosteren ve "${businessName}" ile ayni segmentte rekabet eden markalari arastir.

Her rakip icin su bilgileri bul:
- GERCEK marka/sirket adi (tahmin yapma, sadece buldugun isimler)
- Web sitesi URL'si
- Pazar konumlandirmasi (ne vaat ediyorlar, fiyat segmenti)
- Guclu yanlari (somut: sube sayisi, musteri tabani, urun cesitliligi vb.)
- Zayif yanlari (somut: musteri sikayetleri, eksik hizmetler vb.)
- Tahmini olcek (sube sayisi, calisan sayisi, ciro tahmini vb.)
- Sosyal medya varligi (Instagram, TikTok, YouTube takipci sayilari)

ONEMLI: Sadece dogrulanabilir bilgiler ver. Tahmin ettigin bilgileri acikca "[tahmin]" olarak belirt.
EN AZ 3, EN FAZLA 7 rakip listele.
Turkce yaz.`;

  const marketPrompt = `Sen bir pazar arastirmacisisin. ${sector} sektoru icin Turkiye pazarini arastir.

Asagidaki bilgileri bul:
1. PAZAR BUYUKLUGU: Tahmini pazar buyuklugu (TL veya USD cinsinden), mumkunse kaynak belirt
2. BUYUME HIZI: Yillik buyume orani veya trend yonu
3. ANAHTAR OYUNCULAR: Sektorun en buyuk 5-7 markasi/sirketi
4. HEDEF KITLE PROFILI: Bu sektorde alisveris yapan tuketicilerin:
   - Yas araligi, cinsiyet dagilimi, gelir duzeyi
   - Yogunlukla yasadiklari sehirler
   - Degerleri ve yasam tarzi
   - En buyuk sikayetleri ve acil ihtiyaclari (pain points)
   - Satin alma kanallari (online/offline/sosyal medya)
   - Satin alma karar sureci
5. TUKETICI TRENDLERI: Son 1 yilda degisen tuketici davranislari
6. REGULASYON: Sektoru etkileyen yasal duzenlemeler veya standartlar

Somut rakamlar ve kaynaklar ver. Turkce yaz.`;

  const trendPrompt = `Sen bir sektor analistisin. ${sector} sektoru icin Turkiye'deki guncel trendleri, firsatlari ve tehditleri arastir.

1. DIJITAL TRENDLER: Sektorde dijital donusum, e-ticaret, sosyal medya trendleri, yapay zeka kullanimi
2. TUKETICI DAVRANISI: Degisen tuketici beklentileri ve yeni alisveris aliskanliklari
3. REKABET DINAMIKLERI: Yeni girisimler, pazar konsolidasyonlari, fiyat rekabeti
4. FIRSATLAR: "${businessName}" icin somut firsatlar (neden firsat, nasil degerlendirilir)
5. TEHDITLER: "${businessName}" icin somut tehditler (ne riski var, nasil onlenir)
6. SEKTOR STANDARTLARI: Basarili markalarin ortak ozellikleri, sektorde basari icin gereken minimum gereksinimler
7. BENCHMARK METRIKLER: Sektorde ortalama musteri edinme maliyeti, donusum oranlari, musteri sadakati gibi olculebilir degerler

Somut ornekler ve kaynaklar ver. Turkce yaz.`;

  let allGroundedText = '';
  let allSourceUrls: Array<{ title: string; url: string }> = [];
  let allSearchQueries: string[] = [];
  let sourcesUsed = 0;

  try {
    // Run 3 grounded searches in parallel
    const [competitorRes, marketRes, trendRes] = await Promise.all([
      generateGroundedText(competitorPrompt, 'SectorResearch-Competitors', { maxOutputTokens: 8192 }),
      generateGroundedText(marketPrompt, 'SectorResearch-Market', { maxOutputTokens: 8192 }),
      generateGroundedText(trendPrompt, 'SectorResearch-Trends', { maxOutputTokens: 8192 }),
    ]);

    // Combine all grounded text
    allGroundedText = `## RAKIP ANALIZI\n${competitorRes.text}\n\n## PAZAR VE HEDEF KITLE\n${marketRes.text}\n\n## TRENDLER VE FIRSATLAR\n${trendRes.text}`;

    // Collect source URLs from grounding metadata
    for (const res of [competitorRes, marketRes, trendRes]) {
      if (res.groundingMetadata) {
        for (const chunk of res.groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            sourcesUsed++;
            allSourceUrls.push({
              title: chunk.web.title || chunk.web.uri,
              url: chunk.web.uri,
            });
          }
        }
        allSearchQueries.push(...res.groundingMetadata.webSearchQueries);
      }
    }

    // Deduplicate source URLs
    const seen = new Set<string>();
    allSourceUrls = allSourceUrls.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

  } catch (error) {
    console.error('SectorResearch: Grounded search failed:', error);
    return { ...EMPTY_RESEARCH, searchQueries: [`${businessName} ${sector} Turkiye`] };
  }

  if (!allGroundedText || allGroundedText.length < 100) {
    console.warn('SectorResearch: Grounded search returned minimal data');
    return { ...EMPTY_RESEARCH, searchQueries: allSearchQueries, sourcesUsed };
  }

  // Step B: Extract structured JSON from grounded text
  const extractionPrompt = `Asagidaki sektor arastirmasi metnini analiz ederek JSON yapisinda yapilandir. Metinde gecen TUM somut bilgileri koru: marka adlari, web siteleri, rakamlar, kaynaklar. Bilgi UYDURMADAN sadece metinde olan bilgileri yapilandir. Eger bir alan icin veri yoksa bos birak veya "Veri bulunamadi" yaz.

## Arastirma Metni
${allGroundedText.slice(0, 30000)}

## Kaynaklar
${allSourceUrls.map((s) => `- [${s.title}](${s.url})`).join('\n')}

---

Yukaridaki metni asagidaki JSON yapisinda yapilandir:

{
  "competitors": [
    {
      "name": "Gercek marka/sirket adi",
      "website": "Web sitesi URL'si (metinde varsa)",
      "positioning": "Pazar konumlandirmasi",
      "strengths": ["Guclu yan 1", "Guclu yan 2"],
      "weaknesses": ["Zayif yan 1"],
      "estimatedScale": "Tahmini olcek bilgisi (sube, calisan, ciro)",
      "socialPresence": "Sosyal medya bilgisi",
      "sourceSnippet": "Bu bilginin metindeki kaynak cumlesi"
    }
  ],
  "marketData": {
    "marketSize": "Pazar buyuklugu (rakam ve birim)",
    "growthRate": "Buyume orani veya trendi",
    "keyPlayers": ["Sektordeki buyuk oyuncular"],
    "consumerTrends": ["Tuketici trendi 1", "Tuketici trendi 2"],
    "regulatoryFactors": ["Yasal duzenleme veya standart"]
  },
  "targetAudienceInsights": {
    "demographics": "Yas, cinsiyet, gelir, lokasyon bilgileri",
    "psychographics": "Degerler, yasam tarzi, motivasyonlar",
    "painPoints": ["Tuketici sikayeti/ihtiyaci 1", "Tuketici sikayeti/ihtiyaci 2"],
    "purchaseBehavior": "Satin alma kanallari ve karar sureci"
  },
  "opportunities": ["Somut firsat 1", "Somut firsat 2"],
  "threats": ["Somut tehdit 1", "Somut tehdit 2"],
  "sectorBenchmarks": ["Sektor standardi/olcutu 1", "Sektor standardi/olcutu 2"]
}

KURALLAR:
1. "competitors" EN AZ 3 rakip icermeli. Metinde adi gecen TUM rakipleri dahil et.
2. Her rakibin "name" alani GERCEK bir marka adi olmali, uydurma yasak.
3. "marketData.marketSize" mumkunse rakamsal deger icermeli (TL/USD).
4. "targetAudienceInsights.painPoints" en az 2 madde icermeli.
5. "opportunities" ve "threats" en az 2'ser madde icermeli.
6. Metinde olmayan bilgiyi UYDURMADAN "Veri bulunamadi" yaz.
7. Tum metinler TURKCE olmali.
8. Sadece JSON don.`;

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
      sourcesUsed,
      sourceUrls: allSourceUrls,
      rawSnippets: [allGroundedText.slice(0, 2000)],
    };
  } catch (error) {
    console.error('SectorResearch: JSON extraction failed:', error);
    return {
      ...EMPTY_RESEARCH,
      searchQueries: allSearchQueries,
      sourcesUsed,
      sourceUrls: allSourceUrls,
      rawSnippets: [allGroundedText.slice(0, 2000)],
    };
  }
}
