import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, ConsumerTestOutput } from '../types';

export async function runBrandStrategistRevision(
  normalizedData: NormalizedData,
  originalOutput: StrategistOutput,
  challengerOutput: ChallengerOutput | null,
  researchFindings: ResearchFindings | null,
  consumerTestOutput?: ConsumerTestOutput,
  adminNotes?: string,
  // Consensus-driven revision: when challenger unavailable, use consensus signals
  consensusRevisionReason?: string,
  consensusSuggestedWeakness?: string,
): Promise<StrategistOutput> {

  // Format original strategy
  const taSegments = originalOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === 'string'
    ? taSegments
    : `Birincil: ${taSegments.primarySegment?.demographics || 'N/A'} — ${taSegments.primarySegment?.behavioralProfile || ''}\nIkincil: ${taSegments.secondarySegment?.demographics || 'N/A'} — ${taSegments.secondarySegment?.behavioralProfile || ''}`;

  const vpReasoning = originalOutput.valuePropositionReasoning;
  const vpSummary = vpReasoning
    ? `\n- Urun/Hizmet: ${vpReasoning.whatBusinessProduces}\n- Temel Fayda: ${vpReasoning.coreBenefit}\n- Kimin Icin: ${vpReasoning.whoBenefits}\n- Fiyat: ${vpReasoning.pricePositioning}`
    : '';

  // Format challenger critiques (or consensus-driven fallback)
  const challengePointsList = challengerOutput
    ? challengerOutput.challengePoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : consensusRevisionReason
      ? `1. Çoklu model konsensüsü başarısız: ${consensusRevisionReason}`
      : '1. Konumlandırma yeterliliği sorgulandı — alternatif değerlendirilmeli';

  const blindSpotsList = challengerOutput
    ? challengerOutput.blindSpots.map((b, i) => `${i + 1}. ${b}`).join('\n')
    : consensusSuggestedWeakness
      ? `1. ${consensusSuggestedWeakness}`
      : '1. Bağımsız model doğrulaması yetersiz güven verdi';

  // Research context
  let researchContext = '';
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors
      .slice(0, 5)
      .map(c => `- ${c.name}: ${c.positioning} | Guclu: ${c.strengths.slice(0, 2).join(', ')}`)
      .join('\n');
    researchContext = `
## Sektor Verileri (Referans)
${competitorSummary}
- Pazar: ${researchFindings.marketData.marketSize}, Buyume: ${researchFindings.marketData.growthRate}
- Trendler: ${researchFindings.marketData.consumerTrends.join('; ') || 'N/A'}`;
  }

  // Build consumer test feedback section (if available)
  let consumerFeedbackSection = '';
  if (consumerTestOutput) {
    const topConcerns = consumerTestOutput.crossPersonaConcerns.join('; ');
    const refinements = consumerTestOutput.strategyRefinements.join('; ');
    const personaSummary = consumerTestOutput.personas
      .map(p => `- ${p.personaLabel}: Uyum=${p.alignmentScore}/100, Satin alma=${p.purchaseLikelihood}. Endiseler: ${p.concerns.slice(0, 2).join('; ')}`)
      .join('\n');

    consumerFeedbackSection = `

## TUKETICI SIMULASYONU SONUCLARI
Genel Pazar Uygunluk Skoru: ${consumerTestOutput.overallViabilityScore}/100
Pazar Hazirlik: ${consumerTestOutput.marketReadiness}

### Persona Tepkileri
${personaSummary}

### Ortak Endiseler
${topConcerns}

### Iyilestirme Onerileri
${refinements}

### En Guclu Eslesen: ${consumerTestOutput.strongestFit}
### En Zayif Eslesen: ${consumerTestOutput.weakestFit}`;
  }

  // Admin notes — critical expert override
  const adminNotesBlock = adminNotes?.trim()
    ? `\n\n⚠️ KRITIK ADMIN NOTU — REVIZYONDA KESINLIKLE DIKKATE AL:\n${adminNotes.trim()}\nBu bilgi isletmeyi taniyan uzman tarafindan yazilmistir. Revizyon sirasinda bu notla celisen duzeltmeler YAPMA.\n`
    : '';

  const revisionTrigger = challengerOutput
    ? 'Orijinal strateji önerilerini bir ŞEYTAN AVUKATI inceledi ve eleştiriler yaptı. Simdi bu eleştirileri tek tek değerlendirecek ve stratejini savunacak veya revize edeceksin.'
    : `Orijinal strateji önerisi ÇOKLU MODEL KONSENSÜS testinden geçemedi (skor < 60). Konumlandırma veya arketip seçiminde zayıflık tespit edildi. Stratejiyi bu sinyale göre güçlendirmen gerekiyor.`;

  const prompt = `Sen deneyimli bir marka strateji uzmanisin. ${revisionTrigger}

## Isletme
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Profil: ${normalizedData.overallProfile}${adminNotesBlock}

## ORIJINAL STRATEJIN
- Arketip: ${originalOutput.archetype}
- Gerekce: ${originalOutput.archetypeRationale}
- Ozellikler: ${originalOutput.traits.join(', ')}
- Ton: ${originalOutput.tone}
- Ses: ${originalOutput.voice}
- Konumlandirma: ${originalOutput.positioningStatement}
- Hedef Kitle: ${targetAudienceSummary}${vpSummary}
- Farklilik: ${originalOutput.differentiator}
- Rekabet Avantaji: ${originalOutput.competitiveAdvantage}

## ELEŞTİRİ / KONSENSÜS UYARILARI

${challengerOutput ? `### Karşı Pozisyon
${challengerOutput.counterPosition}

### Alternatif Arketip Önerisi
${challengerOutput.alternativeArchetype}: ${challengerOutput.alternativeArchetypeRationale}

### Risk Değerlendirmesi
${challengerOutput.riskAssessment}` : `### Konsensüs Uyarısı
${consensusRevisionReason || 'Çoklu model doğrulaması yetersiz güven skoru verdi.'}`}

### Eleştiri / Zayıflık Noktaları
${challengePointsList}

### Kör Noktalar
${blindSpotsList}
${researchContext}
${consumerFeedbackSection}

---

GOREV: ${consumerTestOutput ? 'Hem eleştiri/konsensüs sinyallerini hem de tüketici simülasyonunun geri bildirimlerini değerlendir' : 'Her eleştiriyi / konsensüs uyarısını tek tek değerlendir'}:
- Hakli olan elestirileri KABUL ET ve stratejiyi buna gore REVIZE ET
- Haksiz olan elestirileri KANITLARLA REDDET ve orijinal pozisyonunu koru${consumerTestOutput ? '\n- Tuketici endiselerini ciddiye al — dusuk uyum skorlu personaların sorunlarini gider' : ''}
- Kor noktalari gidermeye calis

REVIZE EDILMIS stratejiyi asagidaki JSON yapisinda don (ORIJINAL ile AYNI yapi):

{
  "archetype": "Revize edilmis veya orijinal arketip",
  "archetypeRationale": "Revize edilmis gerekce — hangi elestirilerin kabul/reddedildigini belirt (2-3 cumle)",
  "traits": ["Revize edilmis 3-5 kisilik ozelligi"],
  "tone": "Revize edilmis iletisim tonu",
  "voice": "Revize edilmis marka sesi",
  "positioningStatement": "Revize edilmis konumlandirma (1-2 cumle)",
  "valuePropositionReasoning": {
    "whatBusinessProduces": "...",
    "coreBenefit": "...",
    "whoBenefits": "...",
    "pricePositioning": "...",
    "willingToPayProfile": "..."
  },
  "targetAudience": {
    "primarySegment": {
      "segmentLabel": "Birincil Segment",
      "demographics": "...",
      "behavioralProfile": "...",
      "coreNeed": "...",
      "mediaHabits": "...",
      "purchaseTriggers": ["..."],
      "estimatedSegmentSize": "..."
    },
    "secondarySegment": {
      "segmentLabel": "Ikincil Segment",
      "demographics": "...",
      "behavioralProfile": "...",
      "coreNeed": "...",
      "mediaHabits": "...",
      "purchaseTriggers": ["..."],
      "estimatedSegmentSize": "..."
    },
    "marketSizeEstimate": "..."
  },
  "differentiator": "Revize edilmis farklilik (1-2 cumle)",
  "competitiveAdvantage": "Revize edilmis rekabet avantaji (1-2 cumle)",
  "competitiveMap": [
    {
      "competitorName": "...",
      "theirPosition": "...",
      "ourAdvantage": "...",
      "ourWeakness": "..."
    }
  ]
}

KRITIK KURALLAR:
1. Bu bir SAVUNMA + REVIZYON. Tamamen farkli bir strateji yazma — orijinali temel al.
2. Elestirilerin en az BIRINI kabul edip stratejiyi iyilestir. %100 reddetme = BASARISIZ.
3. archetypeRationale'de hangi elestirilerin kabul/reddedildigini ACIKCA belirt.
4. Challenger'in kor noktalarini gider — eksik birakilan alanlar icin somut eklemeler yap.
5. Orijinal yapiyi BOZMA — ayni StrategistOutput interface'ini korumalisin.
6. Tum metinler TURKCE olmali.
7. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<StrategistOutput>('flash', prompt, 'StrategistRevision', {
    temperature: 0.5,
    maxOutputTokens: 8192,
  });

  // Validate with fallbacks to original
  const defaultSegment = {
    segmentLabel: '', demographics: '', behavioralProfile: '',
    coreNeed: '', mediaHabits: '', purchaseTriggers: [] as string[], estimatedSegmentSize: '',
  };

  return {
    archetype: parsed.archetype || originalOutput.archetype,
    archetypeRationale: parsed.archetypeRationale || originalOutput.archetypeRationale,
    traits: Array.isArray(parsed.traits) && parsed.traits.length > 0
      ? parsed.traits
      : originalOutput.traits,
    tone: parsed.tone || originalOutput.tone,
    voice: parsed.voice || originalOutput.voice,
    positioningStatement: parsed.positioningStatement || originalOutput.positioningStatement,
    valuePropositionReasoning: parsed.valuePropositionReasoning || originalOutput.valuePropositionReasoning || {
      whatBusinessProduces: '', coreBenefit: '', whoBenefits: '', pricePositioning: '', willingToPayProfile: '',
    },
    targetAudience: parsed.targetAudience
      ? {
          primarySegment: { ...defaultSegment, ...parsed.targetAudience.primarySegment },
          secondarySegment: { ...defaultSegment, ...parsed.targetAudience.secondarySegment },
          marketSizeEstimate: parsed.targetAudience.marketSizeEstimate || originalOutput.targetAudience.marketSizeEstimate || '',
        }
      : originalOutput.targetAudience,
    differentiator: parsed.differentiator || originalOutput.differentiator,
    competitiveAdvantage: parsed.competitiveAdvantage || originalOutput.competitiveAdvantage,
    competitiveMap: Array.isArray(parsed.competitiveMap) && parsed.competitiveMap.length > 0
      ? parsed.competitiveMap
      : (originalOutput.competitiveMap || []),
  };
}
