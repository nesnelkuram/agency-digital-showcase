import { createGeminiModel, safeParseJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, SynthesizedAnalysis } from '../types';

export async function runStrategySynthesizer(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput,
  challengerOutput: ChallengerOutput | null
): Promise<SynthesizedAnalysis> {
  const model = createGeminiModel('pro', {
    temperature: 0.6,
    maxOutputTokens: 4096,
  });

  // Build strategist summary
  const strategistSummary = `
### Strateji Uzmani Onerisi
- Arketip: ${strategistOutput.archetype}
- Gerekce: ${strategistOutput.archetypeRationale}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(', ')}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}
- Hedef Kitle: ${strategistOutput.targetAudience}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}`;

  // Build challenger summary (if available)
  let challengerSummary = '';
  if (challengerOutput) {
    challengerSummary = `

### Seytan Avukati Karsi-Analizi
- Karsi Pozisyon: ${challengerOutput.counterPosition}
- Alternatif Arketip: ${challengerOutput.alternativeArchetype}
- Alternatif Arketip Gerekce: ${challengerOutput.alternativeArchetypeRationale}
- Elestiri Noktalari:
${challengerOutput.challengePoints.map((p) => `  - ${p}`).join('\n')}
- Alternatif Konumlandirmalar:
${challengerOutput.alternativePositionings.map((p) => `  - ${p}`).join('\n')}
- Risk Degerlendirmesi: ${challengerOutput.riskAssessment}
- Kor Noktalar:
${challengerOutput.blindSpots.map((b) => `  - ${b}`).join('\n')}`;
  }

  // Build research context (if available)
  let researchContext = '';
  if (researchFindings && researchFindings.sourcesUsed > 0) {
    const competitorNames = researchFindings.competitors.map((c) => c.name).join(', ');
    researchContext = `

## Sektor Arastirmasi Ozeti
- Rakipler: ${competitorNames || 'Bilgi yok'}
- Pazar Trendleri: ${researchFindings.marketTrends.slice(0, 3).join('; ') || 'Bilgi yok'}
- Firsatlar: ${researchFindings.opportunities.slice(0, 3).join('; ') || 'Bilgi yok'}
- Tehditler: ${researchFindings.threats.slice(0, 3).join('; ') || 'Bilgi yok'}
- Sektor Standartlari: ${researchFindings.sectorBenchmarks.slice(0, 3).join('; ') || 'Bilgi yok'}`;
  }

  const debateInstruction = challengerOutput
    ? 'Iki farkli uzmanin goruslerini inceleyip en iyi stratejiyi sentezlemen gerekiyor. Strateji uzmaninin onerisiyle seytan avukatinin elestirisini dengeleyerek, en guclu ve tutarli sonucu olustur.'
    : 'Strateji uzmaninin onerisini inceleyip, rafine ederek nihai stratejiyi olusturman gerekiyor. Karsi-analiz mevcut olmadigindan, kendi elestirel gozunle stratejiyi guclendirerek sentezle.';

  const prompt = `Sen bir marka stratejisi basparlak direktorsun (CSO). ${debateInstruction}

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
- Veri Kalitesi: ${normalizedData.dataQualityScore}
- Tespit Edilen Oruntular: ${normalizedData.detectedPatterns.join('; ') || 'Yok'}

## Uzman Gorusleri
${strategistSummary}
${challengerSummary}
${researchContext}

---

Tum verileri sentezleyerek asagidaki JSON yapisinda NIHAI marka stratejisi raporunu olustur:

{
  "brandPersonality": {
    "archetype": "Nihai Jung arktipi secimi (Turkce). Strateji uzmani ve seytan avukatinin goruslerini degerlendirerek en uygun arktipi sec.",
    "traits": ["Markanin 3-5 temel kisilik ozelligi. Her biri somut ve sektore ozgu olmali."],
    "tone": "Markanin nihai iletisim tonu",
    "voice": "Markanin nihai sesi"
  },
  "positioning": {
    "statement": "Nihai konumlandirma cumlesi. Net, akilda kalici ve farklilik yaratan bir ifade. (1-2 cumle)",
    "targetAudience": "Hedef kitle tanimi. Demografik ve psikografik ozellikleri icerir. (2-3 cumle)",
    "differentiator": "Markayi rakiplerinden ayiran temel fark. (1-2 cumle)",
    "competitiveAdvantage": "Markanin rekabet avantaji. (1-2 cumle)",
    "alternativePositions": ["2-3 adet alternatif konumlandirma onerisi. Ana konumlandirma basarisiz olursa B ve C plani olarak kullanilabilir."]
  },
  "visualWorld": {
    "moodKeywords": ["5-7 adet gorsel dunya anahtar kelimesi. Markanin gorsel kimligini tanimlayan kavramlar."],
    "colorPalette": [
      { "hex": "#hexkod", "name": "Renk adi (Turkce)", "usage": "Kullanim alani (primary/secondary/accent/neutral)" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "secondary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "accent" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "neutral" }
    ],
    "typographyStyle": "Tipografi stili onerisi. Hangi font aileleri ve stilleri kullanilmali? (1-2 cumle)",
    "imageryStyle": "Fotograf ve gorsel icerik stili. Nasil gorseller kullanilmali? (1-2 cumle)"
  },
  "contentStrategy": {
    "pillars": ["4-6 adet icerik sutunu. Her biri markanin farkli bir yonunu one cikaran tematik alan."],
    "toneGuidelines": ["3-4 adet ton rehberi kurali. Markanin iletisiminde uyulmasi gereken kurallar."],
    "keyMessages": ["3-5 adet anahtar mesaj. Markanin surekli iletmesi gereken temel mesajlar."],
    "hashtags": ["5-8 adet hashtag onerisi. # isareti ile baslayan, Turkce veya sektore uygun etiketler."]
  },
  "analysis": {
    "strengths": ["3-4 adet markanin guclu yanlari"],
    "opportunities": ["3-4 adet markanin degerlendirmesi gereken firsatlar"],
    "challenges": ["2-3 adet markanin karsilasabilecegi zorluklar"],
    "recommendations": ["4-6 adet stratejik oneri. Her biri somut, uygulanabilir ve onceliklendirilebilir olmali."]
  },
  "synthesisRationale": "Bu sentezin neden bu sekilde yapildiginin aciklamasi. Strateji uzmani ve seytan avukatinin hangi gorisleri benimsendi, hangileri reddedildi ve neden? Nihai kararlarin arkasindaki mantik. (3-5 cumle)"
}

ONEMLI KURALLAR:
1. "brandPersonality.archetype" seciminde her iki uzmanin da goruslerini dikkate al. Eger seytan avukatinin alternatif arktipi daha guclu kanit sunuyorsa onu sec, yoksa strateji uzmaninin onerisiyle devam et.
2. "positioning.alternativePositions" hem strateji uzmaninin hem seytan avukatinin alternatif onerilerini icermeli.
3. "visualWorld.colorPalette" tam olarak 4 renk icermeli: primary, secondary, accent ve neutral. Renk hex kodlari gercekci ve sektore uygun olmali. Ornegin: FMCG icin dogal tonlar, tech icin modern renkler, saglik icin guven veren tonlar.
4. "visualWorld.moodKeywords" 5-7 adet olmali. Bu kelimeler markanin gorsel dunysinin rehberi olacak.
5. "contentStrategy.pillars" 4-6 adet olmali. Her bir sutun farkli bir icerik kategorisini temsil etmeli.
6. "contentStrategy.hashtags" 5-8 adet olmali ve # isaretiyle baslamali.
7. "analysis.recommendations" 4-6 adet olmali. Onerilerin oncelik sirasina gore siralanmasi tercih edilir.
8. "synthesisRationale" sentez kararlarinin arkasindaki mantigi acik ve net bir sekilde ortaya koymali. ${challengerOutput ? 'Her iki uzmanin goruslerini referans gostermeli.' : 'Strateji uzmaninin onerisini nasil rafine ettigini aciklamali.'}
9. Tum metinler TURKCE olmali.
10. Sadece JSON don, baska bir sey yazma.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const responseText = result.response.text();
  const parsed = safeParseJSON<SynthesizedAnalysis>(responseText, 'StrategySynthesizer');

  // Deep validation with fallbacks for all required nested fields
  return {
    brandPersonality: {
      archetype: parsed.brandPersonality?.archetype || strategistOutput.archetype,
      traits: Array.isArray(parsed.brandPersonality?.traits) && parsed.brandPersonality.traits.length > 0
        ? parsed.brandPersonality.traits
        : strategistOutput.traits,
      tone: parsed.brandPersonality?.tone || strategistOutput.tone,
      voice: parsed.brandPersonality?.voice || strategistOutput.voice,
    },
    positioning: {
      statement: parsed.positioning?.statement || strategistOutput.positioningStatement,
      targetAudience: parsed.positioning?.targetAudience || strategistOutput.targetAudience,
      differentiator: parsed.positioning?.differentiator || strategistOutput.differentiator,
      competitiveAdvantage: parsed.positioning?.competitiveAdvantage || strategistOutput.competitiveAdvantage,
      alternativePositions: Array.isArray(parsed.positioning?.alternativePositions) && parsed.positioning.alternativePositions.length > 0
        ? parsed.positioning.alternativePositions
        : (challengerOutput?.alternativePositionings || ['Alternatif konumlandirma belirtilmemistir']),
    },
    visualWorld: {
      moodKeywords: Array.isArray(parsed.visualWorld?.moodKeywords) && parsed.visualWorld.moodKeywords.length >= 5
        ? parsed.visualWorld.moodKeywords
        : ['Modern', 'Temiz', 'Guvenilir', 'Profesyonel', 'Samimi'],
      colorPalette: Array.isArray(parsed.visualWorld?.colorPalette) && parsed.visualWorld.colorPalette.length === 4
        ? parsed.visualWorld.colorPalette
        : [
            { hex: '#2563EB', name: 'Ana Mavi', usage: 'primary' },
            { hex: '#10B981', name: 'Taze Yesil', usage: 'secondary' },
            { hex: '#F59E0B', name: 'Sicak Sari', usage: 'accent' },
            { hex: '#6B7280', name: 'Notr Gri', usage: 'neutral' },
          ],
      typographyStyle: parsed.visualWorld?.typographyStyle || 'Modern sans-serif tipografi, okunakli ve profesyonel.',
      imageryStyle: parsed.visualWorld?.imageryStyle || 'Dogal isikli, samimi ve profesyonel fotograflar.',
    },
    contentStrategy: {
      pillars: Array.isArray(parsed.contentStrategy?.pillars) && parsed.contentStrategy.pillars.length >= 4
        ? parsed.contentStrategy.pillars
        : ['Marka Hikayesi', 'Sektor Uzmanligi', 'Musteri Deneyimleri', 'Yenilik ve Trendler'],
      toneGuidelines: Array.isArray(parsed.contentStrategy?.toneGuidelines) && parsed.contentStrategy.toneGuidelines.length >= 3
        ? parsed.contentStrategy.toneGuidelines
        : ['Samimi ama profesyonel ol', 'Uzman bilgisini anlasilir sekilde paylas', 'Mozusteri odakli mesajlar kullan'],
      keyMessages: Array.isArray(parsed.contentStrategy?.keyMessages) && parsed.contentStrategy.keyMessages.length >= 3
        ? parsed.contentStrategy.keyMessages
        : ['Kalite ve guven odakli mesajlar', 'Fark yaratan ozellikler', 'Musteri basari hikayeleri'],
      hashtags: Array.isArray(parsed.contentStrategy?.hashtags) && parsed.contentStrategy.hashtags.length >= 5
        ? parsed.contentStrategy.hashtags
        : [`#${normalizedData.businessName.replace(/\s+/g, '')}`, `#${normalizedData.sector}`, '#MarkaStratejisi', '#DijitalDonusum', '#Turkiye'],
    },
    analysis: {
      strengths: Array.isArray(parsed.analysis?.strengths) && parsed.analysis.strengths.length >= 3
        ? parsed.analysis.strengths
        : ['Marka vizyonu net', 'Sektore uygun konumlandirma', 'Guclu deger onerisi'],
      opportunities: Array.isArray(parsed.analysis?.opportunities) && parsed.analysis.opportunities.length >= 3
        ? parsed.analysis.opportunities
        : ['Dijital kanallar ile buyume', 'Yeni pazar segmentleri', 'Icerik pazarlama firsatlari'],
      challenges: Array.isArray(parsed.analysis?.challenges) && parsed.analysis.challenges.length >= 2
        ? parsed.analysis.challenges
        : ['Rekabet yogunlugu', 'Marka bilinirligini artirma ihtiyaci'],
      recommendations: Array.isArray(parsed.analysis?.recommendations) && parsed.analysis.recommendations.length >= 4
        ? parsed.analysis.recommendations
        : ['Dijital varlik guclendirilmeli', 'Icerik stratejisi uygulanmali', 'Marka kimlik rehberi olusturulmali', 'Hedef kitle arastirmasi derinlestirilmeli'],
    },
    synthesisRationale: parsed.synthesisRationale || (challengerOutput
      ? `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi ile seytan avukatinin ${challengerOutput.alternativeArchetype} alternatifi degerlendirilmistir. Nihai strateji, her iki bakis acisinin guclu yanlarini birlestirerek olusturulmustur.`
      : `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi rafine edilerek nihai strateji olusturulmustur. Karsi-analiz mevcut olmadigindan, mevcut veriler ve sektor bilgisi ile strateji guclendirilmistir.`
    ),
  };
}
