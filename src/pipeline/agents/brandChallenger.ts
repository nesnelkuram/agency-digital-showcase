import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput } from '../types';

export async function runBrandChallenger(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput
): Promise<ChallengerOutput> {

  // Build research context (if available)
  let researchContext = '';
  if (researchFindings && researchFindings.sourcesUsed > 0) {
    const competitorSummary = researchFindings.competitors
      .map((c) => `- ${c.name}: ${c.positioning}`)
      .join('\n');

    researchContext = `
## Sektor Arastirmasi Ozeti
### Rakipler
${competitorSummary || 'Bilgi yok'}

### Pazar Trendleri
${researchFindings.marketTrends.map((t) => `- ${t}`).join('\n') || 'Bilgi yok'}

### Tehditler
${researchFindings.threats.map((t) => `- ${t}`).join('\n') || 'Bilgi yok'}
`;
  }

  const prompt = `Sen deneyimli bir marka danismanisin ve seytan avukati olarak gorev yapiyorsun. Bir baska strateji uzmani asagidaki marka konumlandirmasini onerdi. Senin gorevin bu stratejiyi elestirel gozle incelemek ve alternatif bakis acilari sunmak.

## Isletme Bilgileri
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
- Hedef Kitle: ${strategistOutput.targetAudience}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}

## Normalize Edilmis Veri
### Tespit Edilen Oruntular
${normalizedData.detectedPatterns.map((p) => `- ${p}`).join('\n') || 'Oruntu yok'}

### Celiskiler
${normalizedData.contradictions.length > 0 ? normalizedData.contradictions.map((c) => `- ${c}`).join('\n') : 'Celiski yok'}

### Veri Kalitesi: ${normalizedData.dataQualityScore}
${researchContext}
---

Yukaridaki stratejiyi elestirel gozle inceleyerek asagidaki JSON yapisinda bir karsi-analiz olustur:

{
  "counterPosition": "Onerilen stratejiye karsi genel bir karsi-pozisyon. Stratejinin temel zayifligini veya gozden kacirilan noktayi acikla. (2-3 cumle)",
  "alternativeArchetype": "Alternatif bir Jung arktipi onerisi (Turkce)",
  "alternativeArchetypeRationale": "Neden bu alternatif arktipin de dusunulmesi gerektiginin aciklamasi. Hangi veriler bu alternatifi destekliyor? (2-3 cumle)",
  "challengePoints": [
    "Stratejideki potansiyel sorun veya zayif nokta 1",
    "Stratejideki potansiyel sorun veya zayif nokta 2",
    "Stratejideki potansiyel sorun veya zayif nokta 3"
  ],
  "alternativePositionings": [
    "Alternatif konumlandirma onerisi 1 (1-2 cumle)",
    "Alternatif konumlandirma onerisi 2 (1-2 cumle)"
  ],
  "riskAssessment": "Onerilen stratejinin uygulanmasi halinde ortaya cikabilecek risklerin genel degerlendirmesi. (2-3 cumle)",
  "blindSpots": [
    "Stratejistin gozden kacirdigi veya yeterince dikkate almadigi nokta 1",
    "Stratejistin gozden kacirdigi veya yeterince dikkate almadigi nokta 2"
  ]
}

ONEMLI KURALLAR:
1. Elestiriler yapici olmali, yikici degil. Amac stratejiyi gelistirmek, cokertmek degil.
2. "counterPosition" genel bir karsi gorus sunmali, ama tamamen karsi cikmayin. Eksik kalan yonlere odaklanin.
3. "alternativeArchetype" farkli bir perspektif sunmali. Onerilen arketiple tamamen celismek zorunda degil ama farkli bir aci getirmeli.
4. "challengePoints" 3-5 adet somut sorun veya zayif nokta icermeli. Her biri farkli bir alana (pazar, hedef kitle, rekabet, uygulama, iletisim) odaklanmali.
5. "alternativePositionings" 2-3 adet alternatif konumlandirma cumlesi icermeli.
6. "riskAssessment" stratejinin uygulanmasinda ortaya cikabilecek operasyonel, pazarlama ve algi risklerini degerlendirmeli.
7. "blindSpots" 2-3 adet gozden kacirilan veya hafife alinan noktayi belirtmeli.
8. ${researchFindings && researchFindings.sourcesUsed > 0 ? 'Sektor arastirmasi bulgularini elestirinizde referans olarak kullanin.' : 'Sektor arastirmasi mevcut degil, genel sektor bilginizi kullanin.'}
9. Tum metinler TURKCE olmali.
10. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<ChallengerOutput>('pro', prompt, 'BrandChallenger', {
    temperature: 0.8,
    maxOutputTokens: 2048,
  });

  // Validate and provide fallbacks
  return {
    counterPosition: parsed.counterPosition || 'Strateji genel olarak tutarli, ancak alternatif bakis acilari dikkate alinmali.',
    alternativeArchetype: parsed.alternativeArchetype || 'Bilge',
    alternativeArchetypeRationale: parsed.alternativeArchetypeRationale || 'Alternatif arketip degerlendirmesi mevcut verilerle sinirlidir.',
    challengePoints: Array.isArray(parsed.challengePoints) && parsed.challengePoints.length > 0
      ? parsed.challengePoints
      : ['Hedef kitle tanimi daha da daraltilabilir', 'Rekabet avantaji daha somut hale getirilebilir', 'Uygulama plani detaylandirilmali'],
    alternativePositionings: Array.isArray(parsed.alternativePositionings) && parsed.alternativePositionings.length > 0
      ? parsed.alternativePositionings
      : ['Alternatif konumlandirma belirlenememistir'],
    riskAssessment: parsed.riskAssessment || 'Risk degerlendirmesi icin daha fazla veri gerekmektedir.',
    blindSpots: Array.isArray(parsed.blindSpots) && parsed.blindSpots.length > 0
      ? parsed.blindSpots
      : ['Dijital donusum sureci yeterince ele alinmamis olabilir', 'Musteri deneyimi perspektifi guclendirilmeli'],
  };
}
