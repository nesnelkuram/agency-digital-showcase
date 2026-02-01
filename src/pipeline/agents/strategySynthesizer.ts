import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis, BusinessContextInput } from '../types';

export async function runStrategySynthesizer(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput,
  challengerOutput: ChallengerOutput | null,
  blogAdvisorOutput: BlogAdvisorOutput | null = null,
  businessContext?: BusinessContextInput
): Promise<SynthesizedAnalysis> {

  // Format target audience from strategist (segments, not personas)
  const taSegments = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === 'string'
    ? taSegments
    : `Birincil Segment: ${taSegments.primarySegment?.demographics || 'N/A'} — ${taSegments.primarySegment?.behavioralProfile || ''}\nIkincil Segment: ${taSegments.secondarySegment?.demographics || 'N/A'} — ${taSegments.secondarySegment?.behavioralProfile || ''}`;

  // Format value proposition reasoning
  const vpReasoning = strategistOutput.valuePropositionReasoning;
  const vpSummary = vpReasoning
    ? `\n- Urun/Hizmet: ${vpReasoning.whatBusinessProduces}\n- Temel Fayda: ${vpReasoning.coreBenefit}\n- Kimin Icin: ${vpReasoning.whoBenefits}\n- Fiyat Konumlandirmasi: ${vpReasoning.pricePositioning}\n- Odemeye Istekli Profil: ${vpReasoning.willingToPayProfile}`
    : '';

  // Build strategist summary
  const strategistSummary = `
### Strateji Uzmani Onerisi
- Arketip: ${strategistOutput.archetype}
- Gerekce: ${strategistOutput.archetypeRationale}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(', ')}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}${vpSummary}
- Hedef Kitle: ${targetAudienceSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}`;

  // Build competitive map summary
  let competitiveMapSummary = '';
  if (strategistOutput.competitiveMap && strategistOutput.competitiveMap.length > 0) {
    competitiveMapSummary = `\n\n### Rekabet Haritasi\n` +
      strategistOutput.competitiveMap.map((cm) =>
        `- vs ${cm.competitorName}: Avantajimiz: ${cm.ourAdvantage} | Dezavantajimiz: ${cm.ourWeakness}`
      ).join('\n');
  }

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

  // Build blog advisor summary (if available)
  let blogAdvisorSummary = '';
  if (blogAdvisorOutput) {
    blogAdvisorSummary = `

### Blog Strateji Danismani Degerlendirmesi (Stratejik Blog Danismani Perspektifi)
- Felsefi Uyum Skoru: ${blogAdvisorOutput.philosophicalAlignment.score}/10
- Gerekce: ${blogAdvisorOutput.philosophicalAlignment.rationale}
- Uyumlu Prensipler: ${blogAdvisorOutput.philosophicalAlignment.alignedPrinciples.join('; ') || 'Yok'}
- Celisen Prensipler: ${blogAdvisorOutput.philosophicalAlignment.conflictingPrinciples.join('; ') || 'Yok'}
- Stratejik Oneriler:
${blogAdvisorOutput.strategicRecommendations.map((r) => `  - [${r.area}] ${r.recommendation} (Kaynak: ${r.blogReference})`).join('\n')}
- Icerik Stratejisi:
  - Ton Uyumu: ${blogAdvisorOutput.contentStrategyInsights.toneAlignment}
  - Icerik Sutunlari: ${blogAdvisorOutput.contentStrategyInsights.contentPillars.join(', ')}
  - Anlati Yaklasimi: ${blogAdvisorOutput.contentStrategyInsights.narrativeApproach}
- Yazar Perspektifi: ${blogAdvisorOutput.authorPerspective}
- Gayrinizami Icgoruler:
${blogAdvisorOutput.unconventionalInsights.map((i) => `  - ${i}`).join('\n')}`;
  }

  // Build rich research context (if available)
  let researchContext = '';
  let sourceUrlsList = '';
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorNames = researchFindings.competitors.map((c) => `${c.name}${c.website ? ` (${c.website})` : ''}`).join(', ');
    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;

    researchContext = `

## Sektor Arastirmasi Verileri (Gercek Web Kaynaklari)
- Rakipler: ${competitorNames || 'Bilgi yok'}
- Pazar Buyuklugu: ${marketInfo.marketSize}
- Buyume Hizi: ${marketInfo.growthRate}
- Tuketici Trendleri: ${marketInfo.consumerTrends.join('; ') || 'Bilgi yok'}
- Hedef Kitle Demografisi: ${audience.demographics}
- Hedef Kitle Ihtiyaclari: ${audience.painPoints.join('; ') || 'Bilgi yok'}
- Firsatlar: ${researchFindings.opportunities.join('; ') || 'Bilgi yok'}
- Tehditler: ${researchFindings.threats.join('; ') || 'Bilgi yok'}
- Sektor Standartlari: ${researchFindings.sectorBenchmarks.join('; ') || 'Bilgi yok'}
- Kullanilan Kaynak Sayisi: ${researchFindings.sourcesUsed}`;

    if (researchFindings.sourceUrls && researchFindings.sourceUrls.length > 0) {
      sourceUrlsList = researchFindings.sourceUrls
        .slice(0, 20)
        .map((s) => `  - ${s.title}: ${s.url}`)
        .join('\n');
    }
  }

  const expertCount = 1 + (challengerOutput ? 1 : 0) + (blogAdvisorOutput ? 1 : 0);
  const debateInstruction = expertCount === 3
    ? 'Uc farkli uzmanin goruslerini sentezlemen gerekiyor: Strateji uzmani, seytan avukati ve blog strateji danismani (stratejik blog danismani perspektifi). Her ucunun en guclu argumanlarin birlestirerek, cesur ama temelli nihai stratejiyi olustur.'
    : challengerOutput
    ? 'Iki farkli uzmanin goruslerini inceleyip en iyi stratejiyi sentezlemen gerekiyor. Strateji uzmaninin onerisiyle seytan avukatinin elestirisini dengeleyerek, en guclu ve tutarli sonucu olustur.'
    : blogAdvisorOutput
    ? 'Strateji uzmaninin onerisi ve blog strateji danismaninin (stratejik blog danismani perspektifi) degerlendirmesini sentezleyerek nihai stratejiyi olustur.'
    : 'Strateji uzmaninin onerisini inceleyip, rafine ederek nihai stratejiyi olusturman gerekiyor. Karsi-analiz mevcut olmadigindan, kendi elestirel gozunle stratejiyi guclendirerek sentezle.';

  const sourceCount = researchFindings?.sourcesUsed || 0;

  // Build business context section for synthesizer
  const bc = businessContext;
  const businessContextSection = bc
    ? `
## Isletme Baglam Bilgileri (Dogrudan Musteri Beyani)
- Isletme Tanimi: ${bc.businessDescription || 'Belirtilmedi'}
- Bilinen Rakipler: ${bc.competitors || 'Belirtilmedi'}
- Cografi Kapsam: ${bc.geoScope || 'Belirtilmedi'}
- Dijital Platformlar: ${bc.digitalPresence?.join(', ') || 'Belirtilmedi'}
- Instagram Takipci: ${bc.instagramFollowers || 'Belirtilmedi'}
- Aylik Butce: ${bc.monthlyBudget || 'Belirtilmedi'}
- Isletme Asamasi: ${bc.businessStage || 'Belirtilmedi'}
- Basvuru Nedeni: ${bc.triggerReason || 'Belirtilmedi'}
`
    : '';

  // Budget-calibrated action plan instructions
  const budgetCalibration = bc?.monthlyBudget
    ? `\n12. BUTCE KALIBRASYONU: Musterinin aylik butcesi "${bc.monthlyBudget}" olarak belirtilmis. actionPlan'daki TUM onerileri bu butceye uygun olacak sekilde kalibre et. Butceyi asan oneriler YAPMA. Ornegin: "starter" (0-5K TL) butce icin "profesyonel video produksiyon" ONERME, bunun yerine "smartphone ile cekilen UGC icerik" gibi butce-uyumlu alternatifler sun.`
    : '';

  // Stage-calibrated owner instructions
  const stageCalibration = bc?.businessStage
    ? `\n13. ISLETME ASAMASI KALIBRASYONU: Isletme "${bc.businessStage}" asamasinda. actionPlan'daki "owner" alanlarini buna gore ayarla — yeni/"idea" asamasindaki isletmeler icin "Isletme sahibi" veya "Freelancer" yaz, buyuyen/yerlesik isletmeler icin "Sosyal medya yoneticisi", "Icerik ekibi" gibi pozisyonlar kullanabilirsin. Ayrica strateji onerileri isletmenin olgunluk seviyesine uygun olmali.`
    : '';

  // Digital presence calibration
  const digitalCalibration = bc?.digitalPresence
    ? `\n14. DIJITAL VARLIK KALIBRASYONU: Musterinin aktif oldugu platformlar: ${bc.digitalPresence.join(', ')}. ${bc.digitalPresence.includes('none') ? 'Musteri HICBIR platformda aktif DEGIL — actionPlan sifirdan dijital varlik olusturmaya odaklanmali.' : `Mevcut platformlari OPTIMIZE etme onerileri on planda olmali, yeni platform onerileri ikincil kalmali.`}`
    : '';

  // Trigger-based prioritization
  const triggerCalibration = bc?.triggerReason
    ? `\n15. TETIKLEYICI NEDEN ONCELIKLENDIRMESI: Musterinin basvuru nedeni "${bc.triggerReason}". actionPlan'in "immediate" fazini bu nedene dogrudan cevap verecek sekilde onceliklendir. Ornegin: "sales_drop" → satis artirici aksiyonlar once, "launch" → marka bilinirlik aksiyonlari once, "rebrand" → kimlik yenileme aksiyonlari once.`
    : '';

  const prompt = `Sen bir marka stratejisi basparlak direktorsun (CSO). ${debateInstruction}

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
- Veri Kalitesi: ${normalizedData.dataQualityScore}
- Tespit Edilen Oruntular: ${normalizedData.detectedPatterns.join('; ') || 'Yok'}
${businessContextSection}
## Uzman Gorusleri
${strategistSummary}
${competitiveMapSummary}
${challengerSummary}
${blogAdvisorSummary}
${researchContext}

${sourceUrlsList ? `## Arastirma Kaynaklari\n${sourceUrlsList}` : ''}

---

Tum verileri sentezleyerek asagidaki JSON yapisinda NIHAI marka stratejisi raporunu olustur:

{
  "brandPersonality": {
    "archetype": "Nihai Jung arktipi secimi (Turkce).",
    "traits": ["Markanin 3-5 temel kisilik ozelligi. SEKTORE OZGU, somut ozellikler."],
    "tone": "Markanin nihai iletisim tonu — ORNEK CUMLE ile",
    "voice": "Markanin nihai sesi — ORNEK CUMLE ile"
  },
  "positioning": {
    "statement": "Nihai konumlandirma cumlesi. SOMUT, akilda kalici, OLCULEBILIR. (1-2 cumle)",
    "targetAudience": "Hedef kitle ozet tanimi. (2-3 cumle)",
    "valuePropositionReasoning": {
      "whatBusinessProduces": "Bu isletmenin SOMUT urun/hizmet listesi",
      "coreBenefit": "Musteriye saglanan TEMEL fayda — tek cumle",
      "whoBenefits": "Bu faydadan DAVRANISSAL olarak kim yararlanir",
      "pricePositioning": "Fiyat konumlandirmasi RAKAMLARLA ve rakip karsilastirmasiyla",
      "willingToPayProfile": "Bu fiyati odemeye istekli kisi profili — gelir ve harcama aliskanligi"
    },
    "targetSegments": [
      {
        "segmentLabel": "Birincil Segment",
        "demographics": "Yas ARALIGI, lokasyon tipi, meslek GRUBU, gelir ARALIGI",
        "behavioralProfile": "Tuketim davranislari — SOMUT",
        "coreNeed": "Bu segmentin BU ISLETMEDEN beklentisi",
        "mediaHabits": "Hangi platformlar, ne siklikla",
        "purchaseTriggers": ["Satin alma tetikleyicileri — SPESIFIK"],
        "estimatedSegmentSize": "Turkiye'deki tahmini buyukluk — kaynak belirt"
      },
      {
        "segmentLabel": "Ikincil Segment",
        "demographics": "...",
        "behavioralProfile": "...",
        "coreNeed": "...",
        "mediaHabits": "...",
        "purchaseTriggers": ["..."],
        "estimatedSegmentSize": "..."
      }
    ],
    "differentiator": "Temel fark. (1-2 cumle)",
    "competitiveAdvantage": "Rekabet avantaji. (1-2 cumle)",
    "competitiveLandscape": "Pazarin genel haritasi: Premium segmentte kimler var, orta segmentte kimler var, ${normalizedData.businessName} nereye konumlanmali ve NEDEN. (2-3 cumle)",
    "alternativePositions": ["2-3 alternatif konumlandirma — B ve C plani"]
  },
  "visualWorld": {
    "moodKeywords": ["5-7 gorsel dunya anahtar kelimesi"],
    "colorPalette": [
      { "hex": "#hexkod", "name": "Renk adi (Turkce)", "usage": "primary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "secondary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "accent" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "neutral" }
    ],
    "typographyStyle": "Tipografi stili onerisi. (1-2 cumle)",
    "imageryStyle": "Gorsel icerik stili. (1-2 cumle)"
  },
  "contentStrategy": {
    "pillars": ["4-6 icerik sutunu"],
    "toneGuidelines": ["3-4 ton rehberi kurali"],
    "keyMessages": ["3-5 anahtar mesaj"],
    "hashtags": ["5-8 hashtag onerisi"]
  },
  "analysis": {
    "strengths": ["3-4 guclu yan — SOMUT kanitlarla"],
    "opportunities": ["3-4 firsat — HANGI rakibin HANGI acigini kullanarak"],
    "challenges": ["2-3 zorluk — SOMUT pazar kosullari ile"],
    "recommendations": [
      "ONERI 1: UYGULANABILIR aksiyon. Ornek: 'Instagram'da haftada 4 post + 2 Reel yayinlanarak organik erisim %30 arttirilabilir. Rakip X bu stratejiyle 6 ayda 50K takipci kazanmis.'",
      "ONERI 2: ...",
      "ONERI 3: ...",
      "ONERI 4: ..."
    ]
  },
  "actionPlan": {
    "immediate": [
      {
        "action": "Ilk 30 gun icinde yapilacak SOMUT adim. Ornek: 'Instagram isletme hesabi acilmasi, profil optimizasyonu ve ilk 15 icerik planlama'",
        "owner": "Bu isi yapacak ekip/kisi. Ornek: 'Sosyal medya yoneticisi'",
        "metric": "Basari olcutu. Ornek: 'Hesap acildi, 15 icerik taslagi hazir, bio optimize edildi'",
        "estimatedImpact": "Beklenen etki. Ornek: 'Dijital varlik olusturma — temel adim'"
      },
      { "action": "...", "owner": "...", "metric": "...", "estimatedImpact": "..." }
    ],
    "shortTerm": [
      {
        "action": "30-60 gun arasi yapilacak adim",
        "owner": "...",
        "metric": "...",
        "estimatedImpact": "..."
      }
    ],
    "mediumTerm": [
      {
        "action": "60-90 gun arasi yapilacak adim",
        "owner": "...",
        "metric": "...",
        "estimatedImpact": "..."
      }
    ]
  },
  "evidenceSummary": {
    "sourcesConsulted": ${sourceCount},
    "keySourceUrls": [${researchFindings?.sourceUrls?.slice(0, 5).map((s) => `{"title": "${s.title.replace(/"/g, '\\"')}", "url": "${s.url}"}`).join(', ') || ''}],
    "dataFreshness": "Ocak 2025 web arama verileri",
    "confidenceLevel": "${sourceCount > 5 ? 'Yuksek' : sourceCount > 0 ? 'Orta' : 'Dusuk'} — ${sourceCount} kaynak kullanildi"
  },
  "consultantIntro": "BU ALAN KRITIK — Raporun en basinda, isletme sahibine hitaben yazilmis, deneyimli bir marka danismaninin agzindan kisa bir giris metni. Sanki isletme sahibiyle ilk toplantida yuz yuze konusuyormus gibi yaz. Isletmenin icerisinde bulundugu pazarin gercekliginden bahset, rekabetin veya pazarin durumunu kisa ve net bir sekilde ciz, 'herkesin yaptigi seyleri yaparak fark yaratmak zor' benzeri bir farkindalik olustur. Her isletmenin durumu farkli olabilir — bazilari yogun rekabetle karsi karsiya, bazilari yeni bir pazara giriyor, bazilari dijitale ilk adimini atiyor. Tonu: Samimi ama otoriter, blog yazarligi yapan bir stratejistin dogal konusma uslubunda. Dogrudan isletme sahibine 'siz' diye hitap et. 3-5 cumle olmali. Klise ve jargon YASAK.",
  "synthesisRationale": "Bu sentezin NEDEN bu sekilde yapildiginin aciklamasi. Hangi uzman gorusleri benimsendi, hangileri reddedildi ve NEDEN? SOMUT referanslarla. (3-5 cumle)"
}

KRITIK KURALLAR — BU KURALLARA UYMAYAN RAPOR BASARISIZ SAYILIR:

1. ANTI-JARGON: Asagidaki ifadeleri KULLANMA:
   - "Dijital varlik guclendirilmeli" → YERINE: "Instagram'da haftada 4 post + 2 Reel ile organik erisim %30 arttirilabilir"
   - "Sinerji olusturulmali" → YERINE: "[Rakip X]'in zayif kaldigi [alan]'da farklilasmak icin [somut adim]"
   - "Paradigma degisimi", "butunsel yaklasim", "dinamik strateji" → TAMAMEN YASAK
   - "Kaliteli ve guvenilir" → YERINE: "${normalizedData.businessName}'in [somut ozelligi] sayesinde musteriler [somut fayda] elde eder"

2. UYGULANABILIRLIK: "recommendations" ve "actionPlan" HER maddesi bir proje yoneticisinin HEMEN BASLAYABILECEGI kadar net olmali.
   - "Marka kimlik calismasi yapilmali" → YERINE: "Logo, renk paleti ve tipografi rehberi iceren marka kimlik kilavuzu hazirlanmali. Icermesi gerekenler: logo varyasyonlari, renk kodlari (CMYK/RGB/HEX), tipografi hiyerarsisi, kullanim kurallari."

3. KANIT ZORUNLULUGU: "analysis" bolumundeki HER madde icin destekleyici veri goster.
   - "strengths" — hangi anket cevabi veya veri bunu destekliyor?
   - "opportunities" — hangi rakibin hangi acigi, hangi pazar trendi?
   - "challenges" — hangi pazar kosulu, hangi rakip tehdidi?

11. DAHILI JARGON YASAK — Bu rapor MUSTERIYE gosterilecek. Asagidaki terimleri KESINLIKLE KULLANMA:
   - "wizard", "wizard-anketi", "wizard-anketindeki", "score", "score1", "score2", "score3" → YERINE: "Ankete verdiginiz yanita gore..." veya "Degerlendirilme formundaki yanitlariniza gore..."
   - "agent", "pipeline", "multi-agent", "dataNormalizer", "brandStrategist", "brandChallenger", "blogAdvisor", "synthesizer" → HICBIRINI KULLANMA
   - "prompt", "LLM", "Gemini", "AI modeli" → KULLANMA
   - Dahili teknik referanslar yerine DOGAL bir dil kullan: "Analizimiz sonucunda...", "Degerlendirmemize gore..."

4. "positioning.competitiveLandscape" ISIMLI RAKIPLERLE pazar haritasi cikaracak.

5. "actionPlan" her fazda EN AZ 2, EN FAZLA 4 aksiyon icermeli. Her aksiyonun "metric" alani OLCULEBILIR olmali.

6. "brandPersonality.archetype" seciminde her iki uzmanin da goruslerini dikkate al.

7. "visualWorld.colorPalette" tam olarak 4 renk icermeli: primary, secondary, accent ve neutral.

8. ${challengerOutput ? 'Her iki uzmanin goruslerini referans goster.' : 'Strateji uzmaninin onerisini nasil rafine ettigini acikla.'}

9. Tum metinler TURKCE olmali.
10. Sadece JSON don, baska bir sey yazma.

16. DANISMA GIRIS METNI (consultantIntro): Bu metin raporun en basinda gosterilecek, isletme sahibinin ilk okuyacagi sey. Sanki tecrubeli bir strateji danismani olarak karsisinda oturuyorsun ve ona isinin gercekligini anlatiyorsun. Sektordeki durumu, onundeki firsatlari veya zorluklari kisa ve vurucu bir sekilde ozetle. Blog yazar uslubunda — samimi, dusunduren, bazen hafif provoke eden — ama ASLA klise degil. Her cumle bu SPESIFIK isletme icin yazilmis olmali, genel gecerligir laflar olmasin. "Siz" diye hitap et.${budgetCalibration}${stageCalibration}${digitalCalibration}${triggerCalibration}`;

  const parsed = await generateJSON<SynthesizedAnalysis>('pro', prompt, 'StrategySynthesizer', {
    temperature: 0.6,
    maxOutputTokens: 8192,
  });

  // Deep validation with fallbacks for all required nested fields
  const emptyActionItem = { action: '', owner: '', metric: '', estimatedImpact: '' };

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
      targetAudience: parsed.positioning?.targetAudience || (typeof strategistOutput.targetAudience === 'string'
        ? strategistOutput.targetAudience
        : `${strategistOutput.targetAudience.primarySegment?.demographics || ''} davranissal segment`),
      valuePropositionReasoning: parsed.positioning?.valuePropositionReasoning
        || strategistOutput.valuePropositionReasoning
        || { whatBusinessProduces: '', coreBenefit: '', whoBenefits: '', pricePositioning: '', willingToPayProfile: '' },
      targetSegments: Array.isArray(parsed.positioning?.targetSegments) && parsed.positioning.targetSegments.length > 0
        ? parsed.positioning.targetSegments
        : [strategistOutput.targetAudience.primarySegment, strategistOutput.targetAudience.secondarySegment].filter(Boolean),
      differentiator: parsed.positioning?.differentiator || strategistOutput.differentiator,
      competitiveAdvantage: parsed.positioning?.competitiveAdvantage || strategistOutput.competitiveAdvantage,
      competitiveLandscape: parsed.positioning?.competitiveLandscape || '',
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
        : ['Samimi ama profesyonel ol', 'Uzman bilgisini anlasilir sekilde paylas', 'Musteri odakli mesajlar kullan'],
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
    actionPlan: {
      immediate: Array.isArray(parsed.actionPlan?.immediate) && parsed.actionPlan.immediate.length > 0
        ? parsed.actionPlan.immediate.map((item) => ({ ...emptyActionItem, ...item }))
        : [],
      shortTerm: Array.isArray(parsed.actionPlan?.shortTerm) && parsed.actionPlan.shortTerm.length > 0
        ? parsed.actionPlan.shortTerm.map((item) => ({ ...emptyActionItem, ...item }))
        : [],
      mediumTerm: Array.isArray(parsed.actionPlan?.mediumTerm) && parsed.actionPlan.mediumTerm.length > 0
        ? parsed.actionPlan.mediumTerm.map((item) => ({ ...emptyActionItem, ...item }))
        : [],
    },
    evidenceSummary: {
      sourcesConsulted: parsed.evidenceSummary?.sourcesConsulted ?? sourceCount,
      keySourceUrls: Array.isArray(parsed.evidenceSummary?.keySourceUrls)
        ? parsed.evidenceSummary.keySourceUrls
        : (researchFindings?.sourceUrls?.slice(0, 5) || []),
      dataFreshness: parsed.evidenceSummary?.dataFreshness || 'Veri guncellik bilgisi mevcut degil',
      confidenceLevel: parsed.evidenceSummary?.confidenceLevel || `${sourceCount > 0 ? 'Orta' : 'Dusuk'} — ${sourceCount} kaynak`,
    },
    consultantIntro: parsed.consultantIntro || '',
    synthesisRationale: parsed.synthesisRationale || (challengerOutput
      ? `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi ile seytan avukatinin ${challengerOutput.alternativeArchetype} alternatifi degerlendirilmistir.`
      : `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi rafine edilerek nihai strateji olusturulmustur.`
    ),
  };
}
