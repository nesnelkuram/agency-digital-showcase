import { generateJSON } from '../geminiClient';
import type {
  NormalizedData,
  ResearchFindings,
  SynthesizedAnalysis,
  ChallengerOutput,
  ConsumerTestOutput,
  DigitalPresenceAnalysis,
  BusinessContextInput,
  ValueMaximizerOutput,
} from '../types';

export async function runBrandValueMaximizer(
  normalizedData: NormalizedData,
  _researchFindings: ResearchFindings | null,
  synthesizedAnalysis: SynthesizedAnalysis,
  challengerOutput: ChallengerOutput | null,
  _consumerTest: ConsumerTestOutput | null,
  digitalPresence: DigitalPresenceAnalysis | null,
  _businessContext?: BusinessContextInput,
): Promise<ValueMaximizerOutput> {

  const bName = normalizedData.businessName;
  const sector = normalizedData.sector;

  // --- Synthesizer ciktisi ozet ---
  const positioning = synthesizedAnalysis.positioning;
  const personality = synthesizedAnalysis.brandPersonality;
  const strategicDepth = synthesizedAnalysis.strategicDepth;

  // --- Dijital varlik ozet ---
  let digitalContext = '';
  if (digitalPresence) {
    const parts: string[] = [];
    parts.push(`Dijital Skor: ${digitalPresence.overallDigitalScore}/100`);
    if (digitalPresence.criticalGaps?.length) parts.push(`Kritik Eksikler: ${digitalPresence.criticalGaps.join('; ')}`);
    if (digitalPresence.website) {
      parts.push(`Website: ${digitalPresence.website.url} — Tasarim: ${digitalPresence.website.designQuality}/10`);
    }
    if (digitalPresence.instagram) {
      parts.push(`Instagram: ${digitalPresence.instagram.handle} — Etkilesim: ${digitalPresence.instagram.engagementLevel}`);
    }
    digitalContext = parts.join('\n');
  }

  // --- Challenger ciktisi ozet ---
  let challengerContext = '';
  if (challengerOutput) {
    const parts: string[] = [];
    if (challengerOutput.blindSpots?.length) parts.push(`Kor noktalar: ${challengerOutput.blindSpots.join('; ')}`);
    parts.push(`Risk degerlendirmesi: ${challengerOutput.riskAssessment}`);
    challengerContext = parts.join('\n');
  }

  const prompt = `Sen bir marka deger maksimizasyonu uzmanisin. Asagidaki verileri analiz ederek 2 parcalik bir cikti ureteceksin. JSON formatinda yanit ver.

---

## Isletme: ${bName}
## Sektor: ${sector}
## Genel Profil: ${normalizedData.overallProfile}

## Sentezlenmis Strateji Ciktisi
- Arketip: ${personality.archetype}
- Ozellikler: ${personality.traits.join(', ')}
- Ton: ${personality.tone}
- Ses: ${personality.voice}
- Konumlandirma: ${positioning.statement}
- Farklilik: ${positioning.differentiator}

${strategicDepth ? `## Stratejik Derinlik
- Donusum ifadesi: ${strategicDepth.transformationStatement}
- Marka dusmani: ${strategicDepth.brandEnemy}
- Deger seviyesi: ${strategicDepth.valueLevel}` : ''}

## Dijital Varlik Analizi
${digitalContext || 'Dijital varlik verisi yok.'}

## Challenger Analizi
${challengerContext || 'Challenger verisi yok.'}

---

ASAGIDAKI JSON YAPISINDA 2 BOLUM URET:

### 1. diagnosisSummary (object)
Isletmenin FARKINDA OLMADIGI 3-5 kritik konu (challenger + dijital analizden turetilmis).

- blindSpots: 3-5 maddelik liste. Her madde somut ve aksiyona donusturulebilir olmali.
  Ornekler: "Instagram'da satis odakli iceriklerin orani %80, marka hikayesi sifir"
  YASAK: "Dijital varlik guclendirilmeli" gibi genel gecerdir ifadeler.

### 2. emotionalNarrative (object)
Markanin KENDI sesinden/tonundan yaz. Arketip: ${personality.archetype}, Ton: ${personality.tone}, Ses: ${personality.voice}

- manifesto: 3-5 cumlelik marka manifestosu. Markanin dunya gorusunu, durusu ve vaadini icersin. Resmi degil, markanin KENDI dilinde.
- transformationStory: Musterinin "oncesi→sonrasi" hikayesi. Markanin hayatlarinda ne degistirdigini anlat.
- oneLinePromise: 10 kelimeyi gecmeyen, akilda kalici marka vaadi.

---

ONEMLI:
- TUM alanlari DOLDUR, hicbir alan bos birakilamaz.
- blindSpots EN AZ 3 madde olmali.
- Turkce yaz, teknik terimler disinda Ingilizce kullanma.
- SOMUT OL, jenerik kaliplar YASAK.

JSON FORMATI:
{
  "diagnosisSummary": {
    "blindSpots": ["...", "...", "..."]
  },
  "emotionalNarrative": {
    "manifesto": "",
    "transformationStory": "",
    "oneLinePromise": ""
  }
}`;

  const raw = await generateJSON<ValueMaximizerOutput>('flash', prompt, 'BrandValueMaximizer', {
    temperature: 0.7,
    maxOutputTokens: 2048,
  });

  // --- Validation & Fallbacks ---

  // diagnosisSummary
  const diagRaw = raw.diagnosisSummary;
  const blindSpots = (Array.isArray(diagRaw?.blindSpots) && diagRaw.blindSpots.length >= 1)
    ? diagRaw.blindSpots.filter(Boolean)
    : ['Dijital varlik eksiklikleri tam olarak fark edilmemis'];

  // emotionalNarrative
  const emoRaw = raw.emotionalNarrative;
  const manifesto = (typeof emoRaw?.manifesto === 'string' && emoRaw.manifesto.trim().length > 20)
    ? emoRaw.manifesto.trim()
    : `${bName} olarak, ${sector} sektorunde fark yaratan bir durus sergiliyoruz.`;

  const transformationStory = (typeof emoRaw?.transformationStory === 'string' && emoRaw.transformationStory.trim().length > 20)
    ? emoRaw.transformationStory.trim()
    : `Musterilerimiz bize gelmeden once yasadiklari belirsizligi, bizimle birlikte guven ve netlige donusturuyor.`;

  const oneLinePromise = (typeof emoRaw?.oneLinePromise === 'string' && emoRaw.oneLinePromise.trim().length > 5)
    ? emoRaw.oneLinePromise.trim()
    : `${bName} — farkin baslangici.`;

  return {
    consultantIntro: '', // No longer generated — removed from report
    diagnosisSummary: {
      perceptionVsReality: [], // No longer generated — removed from report
      blindSpots,
      criticalMisalignment: '', // No longer generated — removed from report
    },
    emotionalNarrative: {
      manifesto,
      transformationStory,
      oneLinePromise,
    },
    revenueImpact: { // No longer generated — removed from report
      currentState: '',
      growthDrivers: [],
      investmentToGrowthRatio: '',
    },
  };
}
