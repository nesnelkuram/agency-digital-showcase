import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, BlogAdvisorOutput } from '../types';
import personaProfile from '../../persona/data/personaProfile.json';

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

  // Build persona knowledge context from personaProfile.json
  const beliefsList = personaProfile.coreBeliefs
    .map((b, i) => `${i + 1}. ${b}`)
    .join('\n');

  const thinkingPatternsSummary = personaProfile.thinkingPatterns
    .slice(0, 6)
    .map((tp) => `- ${tp.pattern}`)
    .join('\n');

  const antiPatternsList = personaProfile.antiPatterns
    .map((a) => `- ${a}`)
    .join('\n');

  const expertiseList = personaProfile.topicExpertise
    .map((e) => `- ${e}`)
    .join('\n');

  const prompt = `Sen deneyimli bir marka strateji uzmanisin. Asagida sana ait dunya gorusu, temel inanclar ve dusunce yaklasimi tanimlanmistir. Bu cerceveden strateji degerlendirmesi yapacaksin.

## Dunya Gorusun
${personaProfile.worldview}

## Temel Inanclarin
${beliefsList}

## Dusunce Yaklasimin
${thinkingPatternsSummary}

## Uzmanlik Alanlarin
${expertiseList}

## Iletisim Tarzin
- Ton: ${personaProfile.communicationStyle.tone}
- Dil: ${personaProfile.communicationStyle.vocabulary}
- Cumle yapisi: ${personaProfile.communicationStyle.sentenceStructure}

## YAPMA (Anti-Pattern)
${antiPatternsList}

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

Yukaridaki stratejiyi KENDI DUNYA GORUSUN ve INANCLARIN cercevesinde degerlendir. Asagidaki JSON yapisinda don:

{
  "philosophicalAlignment": {
    "score": 7,
    "rationale": "Onerilen stratejinin senin felsefi cercevene ne kadar uyumlu oldugu. Kendi dusuncelerinle, birinci sahis olarak acikla. (2-3 cumle)",
    "alignedPrinciples": [
      "UYUMLU INANC 1: Senin hangi temel inancin bu stratejiyi destekliyor? Kendi sozlerinle acikla.",
      "UYUMLU INANC 2: ..."
    ],
    "conflictingPrinciples": [
      "CELISEN INANC 1: Senin hangi temel inancin bu stratejiyle celisiyor? Neden? Kendi sozlerinle acikla.",
      "CELISEN INANC 2: ..."
    ]
  },
  "strategicRecommendations": [
    {
      "area": "positioning",
      "recommendation": "Temel inanclarinin isiginda bu markaya somut bir oneri. Ornek: 'Kisitlamalari yaraticiliga donusturmek icin [X] yapilmali.'",
      "sourceInsight": "Bu oneriyi destekleyen dusunce yaklasimin veya inancinin kisa ozeti"
    },
    {
      "area": "differentiation",
      "recommendation": "Farklilasma icin kendi dusunce cercevenden bir uygulama onerisi",
      "sourceInsight": "Bu oneriyi destekleyen dusunce yaklasimin"
    },
    {
      "area": "content",
      "recommendation": "Icerik stratejisi icin kendi iletisim yaklasiminden bir oneri",
      "sourceInsight": "Bu oneriyi destekleyen dusunce yaklasimin"
    }
  ],
  "contentStrategyInsights": {
    "toneAlignment": "Bu markanin iletisim tonunun senin bakis acinla nasil iliskilendirilecegi. (1-2 cumle)",
    "contentPillars": [
      "ICERIK SUTUNU 1: Temel inanclarindan esinlenerek bu markaya ozgu bir icerik sutunu",
      "ICERIK SUTUNU 2: ...",
      "ICERIK SUTUNU 3: ..."
    ],
    "narrativeApproach": "Bu markanin hikaye anlatim yaklasimi nasil olmali? Senin dusunce yontemlerinden (hikaye, provokasyon, karsilastirma) hangisi uygun? (1-2 cumle)",
    "topicSuggestions": [
      "KONU 1: Dusunce yaklasimlarindan esinlenerek bu markaya ozel bir icerik konusu onerisi",
      "KONU 2: ...",
      "KONU 3: ...",
      "KONU 4: ...",
      "KONU 5: ..."
    ]
  },
  "authorPerspective": "Bu markayi incelesen ne derdin? Cesur, dogrudan, birinci sahis perspektifinden 3-5 cumlelik bir degerlendirme yaz. KENDI dusuncelerin olarak — hicbir dis kaynaga referans verme.",
  "unconventionalInsights": [
    "ALTERNATIF BAKIS 1: Temel inanclarin isiginda, geleneksel pazarlama yaklasimlarindan farkli, cesur bir oneri. (1-2 cumle)",
    "ALTERNATIF BAKIS 2: Sira disi bir bakis acisi veya strateji onerisi. (1-2 cumle)"
  ]
}

KRITIK KURALLAR:
1. Hicbir dis kaynaga, makaleye, yaziya veya blog yapisina referans VERME. Bunlar SENIN dusuncelerin, baska birinin degil.
2. "authorPerspective" alaninda BIRINCI SAHIS perspektifinden yaz — "Bana gore...", "Ben bu markaya baktigimda..." gibi dogal ifadeler kullan.
3. "contentPillars" 3-5 adet olmali, HER biri senin dusunce cercevenden esinlenmeli ama BU MARKAYA OZEL olmali.
4. "topicSuggestions" 5-7 adet olmali, HER biri senin dusunce yaklasimini bu markaya uygulayan somut konular.
5. "strategicRecommendations" 3-5 adet, her biri FARKLI bir alana odaklanmali: positioning, differentiation, content, audience, competition.
6. "unconventionalInsights" 2-3 adet, GELENEKSEL pazarlama mantigi DISINDA dusun.
7. score degeri DUSUK (3-4) ise stratejinin neden SIRADAN ve CESARET EKSIK oldugunu acikla. YUKSEK (8-9) ise neden GUCLU ve FARKLI oldugunu belirt.
8. "sourceInsight" alani KISA olmali (1 cumle) — hangi inancin veya dusunce yaklasiminin bu oneriyi destekledigini belirt.
9. Disaridan bakildiginda "baska biri konusuyor" hissi OLMAMALI. Bu degerlendirme tamamen SENIN ic sesin.
10. Tum metinler TURKCE olmali.
11. Sadece JSON don, baska bir sey yazma.`;

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
          sourceInsight: r.sourceInsight || '',
        }))
      : [{ area: 'general', recommendation: 'Stratejik degerlendirme tamamlanamadi.', sourceInsight: '' }],
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
    authorPerspective: parsed.authorPerspective || 'Stratejik perspektif olusturulamadi.',
    unconventionalInsights: Array.isArray(parsed.unconventionalInsights) && parsed.unconventionalInsights.length > 0
      ? parsed.unconventionalInsights
      : ['Alternatif bakis acisi olusturulamadi.'],
  };
}
