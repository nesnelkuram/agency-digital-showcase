import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, BlogAdvisorOutput } from '../types';
import { BLOG_AUTHOR_META, BLOG_PRINCIPLES, BLOG_TOPIC_INDEX, BLOG_QUOTES } from '../data/blogKnowledgeBase';

export async function runBlogStrategyAdvisor(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput
): Promise<BlogAdvisorOutput> {

  // Build research context (same pattern as brandChallenger)
  let researchContext = '';
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors
      .map((c) => `- ${c.name}: ${c.positioning}`)
      .join('\n');

    researchContext = `
## Sektor Arastirmasi
- Rakipler: ${competitorSummary || 'Bilgi yok'}
- Pazar Buyuklugu: ${researchFindings.marketData.marketSize}
- Buyume Hizi: ${researchFindings.marketData.growthRate}
- Tuketici Trendleri: ${researchFindings.marketData.consumerTrends.join('; ') || 'Bilgi yok'}
- Firsatlar: ${researchFindings.opportunities.join('; ') || 'Bilgi yok'}
- Tehditler: ${researchFindings.threats.join('; ') || 'Bilgi yok'}
`;
  }

  // Format target audience summary
  const taSegments = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === 'string'
    ? taSegments
    : `Birincil: ${taSegments.primarySegment?.demographics || 'Belirtilmedi'} — ${taSegments.primarySegment?.behavioralProfile || ''}`;

  // Build blog knowledge base context
  const principlesSummary = BLOG_PRINCIPLES
    .slice(0, 60) // top 60 articles to keep within limits
    .map((p) => `- [${p.tags.join(', ')}] "${p.title}": ${p.excerpt}${p.coreContent ? ` — ${p.coreContent.slice(0, 300)}` : ''}`)
    .join('\n');

  const topicsSummary = BLOG_TOPIC_INDEX
    .slice(0, 12)
    .map((t) => `- ${t.tag} (${t.count} yazi): ${t.topArticles.slice(0, 3).join(', ')}`)
    .join('\n');

  const quotesSummary = BLOG_QUOTES
    .slice(0, 30)
    .map((q) => `- "${q}"`)
    .join('\n');

  const prompt = `Sen ${BLOG_AUTHOR_META.name}'in stratejik felsefesini temsil eden bir marka danismanisin. ${BLOG_AUTHOR_META.name}, ${BLOG_AUTHOR_META.site} adresinde ${BLOG_AUTHOR_META.totalArticles} blog yazisi yayinlamis, Turkiye'nin taninan marka stratejistlerinden biridir. "Gayrinizami Markalama" felsefesiyle bilinir — geleneksel pazarlama dogmalarini sorgular, sira disi ve cesur yaklasimlar savunur.

Gorevlerin:
1. Onerilen marka stratejisini Engin Tezcan'in felsefi cercevesinden degerlendir
2. Blog yazilarindaki stratejik prensipleri bu markaya SOMUT OLARAK uygula
3. Icerik stratejisini yazarin tarzi, sesi ve konularina gore sekillendirerek UYGULANABILIR oneriler sun

## Yazarin Temel Temalari
${topicsSummary}

## Yazarin Stratejik Yazilari (Ozetler)
${principlesSummary}

## Yazarin Sozleri
${quotesSummary}

---

## Analiz Edilecek Isletme
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}

## Onerilen Strateji (Strateji Uzmani Ciktisi)
- Arketip: ${strategistOutput.archetype}
- Arketip Gerekce: ${strategistOutput.archetypeRationale}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(', ')}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}
- Hedef Kitle: ${targetAudienceSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}
${researchContext}
---

Yukaridaki stratejiyi Engin Tezcan'in blog yazilarindaki felsefe ve yaklasimlarla karsilastirarak asagidaki JSON yapisinda bir degerlendirme olustur:

{
  "philosophicalAlignment": {
    "score": 7,
    "rationale": "Onerilen stratejinin Engin Tezcan'in felsefesiyle ne kadar uyumlu oldugu. Somut blog referanslariyla acikla. (2-3 cumle)",
    "alignedPrinciples": [
      "UYUMLU PRENSIP 1: Blog yazilarindan hangi prensip bu stratejiyi destekliyor? Blog basligini ve icerigini referans goster.",
      "UYUMLU PRENSIP 2: ..."
    ],
    "conflictingPrinciples": [
      "CELISEN PRENSIP 1: Blog yazilarindan hangi prensip bu stratejiyle celisiyor? Neden? Blog basligini referans goster.",
      "CELISEN PRENSIP 2: ..."
    ]
  },
  "strategicRecommendations": [
    {
      "area": "positioning",
      "recommendation": "Blog yazilarindaki bir prensibi bu markaya SOMUT olarak uygulayan oneri. Ornek: 'Dengesiz yonetin yazisindaki gibi, 4P dengesini bozarak [X]'e agirlik verin.'",
      "blogReference": "Referans alinan blog yazisinin basligi"
    },
    {
      "area": "differentiation",
      "recommendation": "Farklilasmak icin blog felsefesinden bir uygulama onerisi",
      "blogReference": "Blog basligi"
    },
    {
      "area": "content",
      "recommendation": "Icerik stratejisi icin blog tarzindan bir uygulama onerisi",
      "blogReference": "Blog basligi"
    }
  ],
  "contentStrategyInsights": {
    "toneAlignment": "Bu markanin iletisim tonunun Engin Tezcan'in yazim tarziyla nasil iliskilendirilecegi. (1-2 cumle)",
    "contentPillars": [
      "ICERIK SUTUNU 1: Blog temalarindan esinlenerek bu markaya ozgu bir icerik sutunu",
      "ICERIK SUTUNU 2: ...",
      "ICERIK SUTUNU 3: ..."
    ],
    "narrativeApproach": "Bu markanin hikaye anlatim yaklasimi nasil olmali? Blog yazilarindaki anlatim tekniklerinden (hikaye, provokasyon, karsilastirma) hangisi uygun? (1-2 cumle)",
    "topicSuggestions": [
      "KONU 1: Blog temalarindan esinlenerek bu markaya ozel bir icerik konusu onerisi",
      "KONU 2: ...",
      "KONU 3: ...",
      "KONU 4: ...",
      "KONU 5: ..."
    ]
  },
  "authorPerspective": "Engin Tezcan bu markayi incelese ne derdi? Onun uslubunda, onun bakis acisiyla 3-5 cumlelik bir degerlendirme yaz. Gayrinizami, cesur, dogrudan.",
  "unconventionalInsights": [
    "GAYRINIZAMI ICGORU 1: Blog felsefesinden esinlenen, geleneksel pazarlama yaklasimlarindan farkli, cesur bir oneri. (1-2 cumle)",
    "GAYRINIZAMI ICGORU 2: Sira disi bir bakis acisi veya strateji onerisi. (1-2 cumle)"
  ]
}

KRITIK KURALLAR:
1. Her oneri ve degerlendirme SOMUT bir blog yazisina referans vermeli. Genel laflar YASAK.
2. "authorPerspective" alaninda GERCEKTEN Engin Tezcan gibi yaz — provoke edici, hikayeli, dogmalara meydan okuyan.
3. "contentPillars" 3-5 adet olmali, HER biri blog temalarindan esinlenmeli ama BU MARKAYA OZEL olmali.
4. "topicSuggestions" 5-7 adet olmali, HER biri blog yazilarinin yaklasimini bu markaya uygulayan somut konular.
5. "strategicRecommendations" 3-5 adet, her biri FARKLI bir alana odaklanmali: positioning, differentiation, content, audience, competition.
6. "unconventionalInsights" 2-3 adet, GELENEKSEL pazarlama mantigi DISINDA dusun — tam da Engin Tezcan'in yapacagi gibi.
7. score degeri DUNUK (3-4) ise stratejinin neden SIRADAN ve CESARET EKSIK oldugunu acikla. YUKSEK (8-9) ise neden GAYRINIZAMI ve CESUR oldugunu belirt.
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<BlogAdvisorOutput>('flash', prompt, 'BlogStrategyAdvisor', {
    temperature: 0.8,
    maxOutputTokens: 8192,
  });

  // Validate and provide fallbacks
  return {
    philosophicalAlignment: {
      score: typeof parsed.philosophicalAlignment?.score === 'number'
        ? Math.min(10, Math.max(0, parsed.philosophicalAlignment.score))
        : 5,
      rationale: parsed.philosophicalAlignment?.rationale || 'Degerlendirme tamamlanamadi.',
      alignedPrinciples: Array.isArray(parsed.philosophicalAlignment?.alignedPrinciples)
        ? parsed.philosophicalAlignment.alignedPrinciples
        : [],
      conflictingPrinciples: Array.isArray(parsed.philosophicalAlignment?.conflictingPrinciples)
        ? parsed.philosophicalAlignment.conflictingPrinciples
        : [],
    },
    strategicRecommendations: Array.isArray(parsed.strategicRecommendations) && parsed.strategicRecommendations.length > 0
      ? parsed.strategicRecommendations.map((r) => ({
          area: r.area || 'general',
          recommendation: r.recommendation || '',
          blogReference: r.blogReference || '',
        }))
      : [{ area: 'general', recommendation: 'Blog bazli degerlendirme tamamlanamadi.', blogReference: '' }],
    contentStrategyInsights: {
      toneAlignment: parsed.contentStrategyInsights?.toneAlignment || '',
      contentPillars: Array.isArray(parsed.contentStrategyInsights?.contentPillars)
        ? parsed.contentStrategyInsights.contentPillars
        : [],
      narrativeApproach: parsed.contentStrategyInsights?.narrativeApproach || '',
      topicSuggestions: Array.isArray(parsed.contentStrategyInsights?.topicSuggestions)
        ? parsed.contentStrategyInsights.topicSuggestions
        : [],
    },
    authorPerspective: parsed.authorPerspective || 'Yazar perspektifi olusturulamadi.',
    unconventionalInsights: Array.isArray(parsed.unconventionalInsights) && parsed.unconventionalInsights.length > 0
      ? parsed.unconventionalInsights
      : ['Gayrinizami icgoru olusturulamadi.'],
  };
}
