import { generateJSON } from '../geminiClient';
import type {
  NormalizedData,
  ResearchFindings,
  StrategistOutput,
  BusinessContextInput,
  ConsumerTestOutput,
} from '../types';

export async function runConsumerTest(
  normalizedData: NormalizedData,
  strategistOutput: StrategistOutput,
  researchFindings: ResearchFindings | null,
  businessContext?: BusinessContextInput,
): Promise<ConsumerTestOutput> {

  // Build strategy summary for consumer personas to react to
  const ta = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof ta === 'string'
    ? ta
    : `${ta.primarySegment?.demographics || 'Belirtilmedi'} — ${ta.primarySegment?.behavioralProfile || ''}`;

  const strategySummary = `
- Marka Arktipi: ${strategistOutput.archetype}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(', ')}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}
- Hedef Kitle: ${targetAudienceSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}`;

  // Build target segment info
  const segments = typeof ta === 'string' ? [] : [ta.primarySegment, ta.secondarySegment].filter(Boolean);
  const segmentInfo = segments.map(s =>
    `- ${s.segmentLabel}: ${s.demographics} | ${s.behavioralProfile} | Ihtiyac: ${s.coreNeed}`
  ).join('\n');

  // Research context for realistic personas
  let researchContext = '';
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const audience = researchFindings.targetAudienceInsights;
    researchContext = `
## Pazar Arastirmasi Verileri
- Hedef Kitle Demografisi: ${audience.demographics}
- Psikografi: ${audience.psychographics}
- Temel Ihtiyaclar: ${audience.painPoints.join('; ') || 'Bilgi yok'}
- Satin Alma Davranisi: ${audience.purchaseBehavior}
- Tuketici Trendleri: ${researchFindings.marketData.consumerTrends.join('; ') || 'Bilgi yok'}`;
  }

  // Business context
  const bcSection = businessContext ? `
## Isletme Baglami
- Sektor: ${normalizedData.sector}
- Cografi Kapsam: ${businessContext.geoScope || 'Belirtilmedi'}
- Isletme Asamasi: ${businessContext.businessStage || 'Belirtilmedi'}
- Aylik Butce: ${businessContext.monthlyBudget || 'Belirtilmedi'}` : '';

  const prompt = `Sen bir pazar arastirma uzmanisin. Asagidaki marka stratejisini 4 farkli sentetik tuketici personasina "gosterecek" ve her birinin tepkisini simule edeceksin.

## Isletme
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Profil: ${normalizedData.overallProfile}
${bcSection}

## Sentezlenmis Marka Stratejisi
${strategySummary}

## Hedef Segmentler
${segmentInfo || 'Segment bilgisi mevcut degil'}
${researchContext}

---

GOREV: 4 farkli tuketici personasi olustur ve her birine bu markayi "goster". Her persona FARKLI bir demografik ve psikografik profilden olmali:
1. BIRINCIL HEDEF — Stratejinin tam olarak hedefledigi ideal musteri
2. IKINCIL HEDEF — Stratejinin ikincil segmentinden bir musteri
3. SINIR MUSTERI — Hedef kitlenin kenarinda olan, ikna edilmesi zor ama degerli bir musteri
4. BEKLENMEYEN ADAY — Stratejinin HEDEFLEMEDIGI ama potansiyel olarak cekilebilecek surpriz bir segment

Her persona icin:
- Bu markanin mesaji, tonu ve konumlandirmasi kendisine hitap ediyor mu?
- Hangi noktalar cekici, hangileri itici?
- Satin alma ihtimali nedir?
- Bu personaya en etkili mesaj ne olurdu?

Asagidaki JSON yapisinda don:

{
  "overallViabilityScore": 0-100 arasi genel pazar uygunluk skoru,
  "personas": [
    {
      "personaLabel": "Persona adi/tanimi. Ornek: 'Kariyerine odakli milenyum profesyonel'",
      "demographics": "Yas, cinsiyet, lokasyon, meslek, gelir araligi",
      "psychographics": "Yasam tarzi, degerler, ilgi alanlari, medya aliskanliklari",
      "painPoints": ["Bu kisinin gunluk hayattaki 2-3 somut sorunu/ihtiyaci"],
      "alignmentScore": 0-100 arasi marka-persona uyum skoru,
      "resonancePoints": ["Bu marka benim icin ... cunku ...", "Bu mesaj bende ... hissettiriyor"],
      "concerns": ["Ama su kisim beni durdurur: ...", "Su konuda suphelerim var: ..."],
      "purchaseLikelihood": "yuksek/orta/dusuk/cok_dusuk",
      "recommendedMessageAngle": "Bu personaya en etkili ulasim mesaji/yaklasimi (1-2 cumle)"
    }
  ],
  "strongestFit": "En iyi eslesen persona ve NEDEN (1-2 cumle)",
  "weakestFit": "En zayif eslesen persona ve NEDEN (1-2 cumle)",
  "crossPersonaConcerns": ["Tum personalarda ortaya cikan ortak endise/soru (2-3 madde)"],
  "strategyRefinements": ["Tuketici testi sonucunda ortaya cikan somut iyilestirme onerisi (3-4 madde)"],
  "marketReadiness": "hazir/iyilestirme_gerekli/yeniden_dusunulmeli"
}

KRITIK KURALLAR:
1. Her persona GERCEKCI olmali — Turkiye pazarindaki gercek tuketici profilleri.
2. "resonancePoints" ve "concerns" BIRINCI SAHIS perspektifinden yazilmali ("Ben bu markaya guvenirdim cunku..." gibi).
3. "alignmentScore" TUTARLI olmali: yuksek skor + cok endise = TUTARSIZ.
4. "strategyRefinements" SOMUT ve UYGULANABILIR olmali — "daha iyi iletisim kur" gibi genel laflar YASAK.
5. "overallViabilityScore" 4 personanin ortalamasi degil — genel pazar potansiyelinin degerlendirmesi.
6. 4 persona olmali — ne az ne cok.
7. Tum metinler TURKCE olmali.
8. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<ConsumerTestOutput>('flash', prompt, 'ConsumerTest', {
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  // Validate and provide fallbacks
  const personas = Array.isArray(parsed.personas) && parsed.personas.length > 0
    ? parsed.personas.map(p => ({
        personaLabel: p.personaLabel || 'Tanimlanmamis Persona',
        demographics: p.demographics || 'Belirtilmedi',
        psychographics: p.psychographics || 'Belirtilmedi',
        painPoints: Array.isArray(p.painPoints) ? p.painPoints : [],
        alignmentScore: typeof p.alignmentScore === 'number' ? Math.max(0, Math.min(100, p.alignmentScore)) : 50,
        resonancePoints: Array.isArray(p.resonancePoints) ? p.resonancePoints : [],
        concerns: Array.isArray(p.concerns) ? p.concerns : [],
        purchaseLikelihood: (['yuksek', 'orta', 'dusuk', 'cok_dusuk'] as const).includes(p.purchaseLikelihood)
          ? p.purchaseLikelihood
          : 'orta' as const,
        recommendedMessageAngle: p.recommendedMessageAngle || 'Mesaj onerisi mevcut degil',
      }))
    : [];

  return {
    overallViabilityScore: typeof parsed.overallViabilityScore === 'number'
      ? Math.max(0, Math.min(100, parsed.overallViabilityScore))
      : 50,
    personas,
    strongestFit: parsed.strongestFit || 'Belirlenemedi',
    weakestFit: parsed.weakestFit || 'Belirlenemedi',
    crossPersonaConcerns: Array.isArray(parsed.crossPersonaConcerns) ? parsed.crossPersonaConcerns : [],
    strategyRefinements: Array.isArray(parsed.strategyRefinements) ? parsed.strategyRefinements : [],
    marketReadiness: (['hazir', 'iyilestirme_gerekli', 'yeniden_dusunulmeli'] as const).includes(parsed.marketReadiness)
      ? parsed.marketReadiness
      : 'iyilestirme_gerekli' as const,
  };
}
