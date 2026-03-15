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
  researchFindings: ResearchFindings | null,
  synthesizedAnalysis: SynthesizedAnalysis,
  challengerOutput: ChallengerOutput | null,
  consumerTest: ConsumerTestOutput | null,
  digitalPresence: DigitalPresenceAnalysis | null,
  businessContext?: BusinessContextInput,
): Promise<ValueMaximizerOutput> {

  const bName = normalizedData.businessName;
  const sector = normalizedData.sector;

  // --- Rakip isimleri (research + businessContext) ---
  const researchCompetitors = (researchFindings?.competitors || [])
    .map(c => c.name)
    .filter(Boolean);
  const declaredCompetitors = (businessContext?.competitors || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const allCompetitors = [...new Set([...researchCompetitors, ...declaredCompetitors])];

  // --- Pazar verileri ---
  const marketInfo = researchFindings?.marketData;
  const marketContext = marketInfo
    ? `Pazar buyuklugu: ${marketInfo.marketSize || 'Bilinmiyor'}. Buyume: ${marketInfo.growthRate || 'Bilinmiyor'}. Trendler: ${marketInfo.consumerTrends?.join(', ') || 'Yok'}.`
    : '';

  // --- BusinessContext ozet ---
  const bc = businessContext;
  const bcLines: string[] = [];
  if (bc?.businessDescription) bcLines.push(`Isletme tanimi: ${bc.businessDescription}`);
  if (bc?.geoScope) bcLines.push(`Cografi kapsam: ${bc.geoScope}`);
  if (bc?.businessStage) bcLines.push(`Isletme asamasi: ${bc.businessStage}`);
  if (bc?.monthlyBudget) bcLines.push(`Aylik butce: ${bc.monthlyBudget}`);
  if (bc?.instagramFollowers) bcLines.push(`Instagram takipci: ${bc.instagramFollowers}`);
  if (bc?.digitalPresence?.length) bcLines.push(`Dijital platformlar: ${bc.digitalPresence.join(', ')}`);
  if (bc?.triggerReason) bcLines.push(`Basvuru nedeni: ${bc.triggerReason}`);
  if (bc?.brandWhy) bcLines.push(`Marka WHY: ${bc.brandWhy}`);
  if (bc?.customerPerception) bcLines.push(`Musteri algisi: ${bc.customerPerception}`);
  if (bc?.futureVision) bcLines.push(`3 yillik vizyon: ${bc.futureVision}`);
  if (bc?.customerJob) bcLines.push(`Musteri JTBD: ${bc.customerJob}`);
  if (bc?.customerStruggle) bcLines.push(`Musteri mucadele: ${bc.customerStruggle}`);
  if (bc?.brandEnemy) bcLines.push(`Marka dusmani: ${bc.brandEnemy}`);

  // --- Synthesizer ciktisi ozet ---
  const positioning = synthesizedAnalysis.positioning;
  const personality = synthesizedAnalysis.brandPersonality;
  const actionPlan = synthesizedAnalysis.actionPlan;
  const strategicDepth = synthesizedAnalysis.strategicDepth;

  // --- Dijital varlik ozet ---
  let digitalContext = '';
  if (digitalPresence) {
    const parts: string[] = [];
    parts.push(`Dijital Skor: ${digitalPresence.overallDigitalScore}/100`);
    parts.push(`Olgunluk: ${digitalPresence.digitalMaturityLevel}`);
    if (digitalPresence.criticalGaps?.length) parts.push(`Kritik Eksikler: ${digitalPresence.criticalGaps.join('; ')}`);
    if (digitalPresence.quickWins?.length) parts.push(`Hizli Kazanimlar: ${digitalPresence.quickWins.join('; ')}`);
    if (digitalPresence.website) {
      parts.push(`Website: ${digitalPresence.website.url} — Tasarim: ${digitalPresence.website.designQuality}/10, Mobil: ${digitalPresence.website.mobileOptimized ? 'Evet' : 'Hayir'}`);
      if (digitalPresence.website.weaknesses?.length) parts.push(`Website Zayifliklari: ${digitalPresence.website.weaknesses.join('; ')}`);
    }
    if (digitalPresence.instagram) {
      parts.push(`Instagram: ${digitalPresence.instagram.handle} — Takipci: ${digitalPresence.instagram.followerRange || 'Bilinmiyor'}, Etkilesim: ${digitalPresence.instagram.engagementLevel}`);
      if (digitalPresence.instagram.weaknesses?.length) parts.push(`Instagram Zayifliklari: ${digitalPresence.instagram.weaknesses.join('; ')}`);
    }
    digitalContext = parts.join('\n');
  }

  // --- Challenger ciktisi ozet ---
  let challengerContext = '';
  if (challengerOutput) {
    const parts: string[] = [];
    parts.push(`Karsi pozisyon: ${challengerOutput.counterPosition}`);
    if (challengerOutput.blindSpots?.length) parts.push(`Kor noktalar: ${challengerOutput.blindSpots.join('; ')}`);
    parts.push(`Risk degerlendirmesi: ${challengerOutput.riskAssessment}`);
    if (challengerOutput.distinctivenessScore !== undefined) parts.push(`Benzersizlik skoru: ${challengerOutput.distinctivenessScore}/100`);
    if (challengerOutput.onlynessTest) parts.push(`Onlyness sonucu: ${challengerOutput.onlynessTest.verdict} — "${challengerOutput.onlynessTest.statement}"`);
    challengerContext = parts.join('\n');
  }

  // --- Consumer test ozet ---
  let consumerContext = '';
  if (consumerTest) {
    const parts: string[] = [];
    parts.push(`Genel uygulanabilirlik: ${consumerTest.overallViabilityScore}/100`);
    parts.push(`Pazar hazirlik: ${consumerTest.marketReadiness}`);
    parts.push(`En guclu uyum: ${consumerTest.strongestFit}`);
    parts.push(`En zayif uyum: ${consumerTest.weakestFit}`);
    if (consumerTest.crossPersonaConcerns?.length) parts.push(`Ortak endsiseler: ${consumerTest.crossPersonaConcerns.join('; ')}`);
    consumerContext = parts.join('\n');
  }

  // --- Wizard cevaplari ozet ---
  const wizardAnswers = normalizedData.structuredAnswers
    .flatMap(s => s.questions.map(q => `${q.question}: ${q.answerLabel || q.answer}`))
    .join('\n');

  // --- Action plan ozet ---
  const actionPlanSummary = [
    ...(actionPlan?.immediate || []).map(a => `[Acil] ${a.action} — Etki: ${a.estimatedImpact}`),
    ...(actionPlan?.shortTerm || []).map(a => `[Kisa] ${a.action} — Etki: ${a.estimatedImpact}`),
    ...(actionPlan?.mediumTerm || []).map(a => `[Orta] ${a.action} — Etki: ${a.estimatedImpact}`),
  ].join('\n');

  const prompt = `Sen bir marka deger maksimizasyonu uzmanisin. Asagidaki TUM verileri analiz ederek 4 parcalik bir deger raporu ureteceksin. JSON formatinda yanit ver.

---

## Isletme: ${bName}
## Sektor: ${sector}
## Genel Profil: ${normalizedData.overallProfile}

## Isletme Baglam Bilgileri
${bcLines.join('\n') || 'Detay belirtilmemis.'}

## Wizard Cevaplari (Isletme Sahibinin Kendi Beyanlari)
${wizardAnswers}

## Bilinen Rakipler
${allCompetitors.length > 0 ? allCompetitors.join(', ') : 'Belirtilmemis'}

## Pazar Gercekligi
${marketContext || 'Pazar verisi mevcut degil.'}

## Sentezlenmis Strateji Ciktisi
- Arketip: ${personality.archetype}
- Ozellikler: ${personality.traits.join(', ')}
- Ton: ${personality.tone}
- Ses: ${personality.voice}
- Konumlandirma: ${positioning.statement}
- Farklilik: ${positioning.differentiator}
- Rekabet Avantaji: ${positioning.competitiveAdvantage}
- Rekabet Haritasi: ${positioning.competitiveLandscape || 'Yok'}

${strategicDepth ? `## Stratejik Derinlik
- Donusum ifadesi: ${strategicDepth.transformationStatement}
- Marka dusmani: ${strategicDepth.brandEnemy}
- Savundugumuz: ${strategicDepth.weStandFor?.join('; ') || 'Yok'}
- Karsi oldugumuz: ${strategicDepth.weStandAgainst?.join('; ') || 'Yok'}
- Deger seviyesi: ${strategicDepth.valueLevel}
- Ust basamak onerisi: ${strategicDepth.valueLevelUpgrade || 'Yok'}
- Kulturel gerilim: ${strategicDepth.culturalTension ? `${strategicDepth.culturalTension.expectation} vs ${strategicDepth.culturalTension.reality} → ${strategicDepth.culturalTension.opportunity}` : 'Yok'}` : ''}

## Dijital Varlik Analizi
${digitalContext || 'Dijital varlik verisi yok.'}

## Challenger Analizi
${challengerContext || 'Challenger verisi yok.'}

## Tuketici Testi Sonuclari
${consumerContext || 'Tuketici testi verisi yok.'}

## Aksiyon Plani
${actionPlanSummary || 'Aksiyon plani yok.'}

---

ASAGIDAKI JSON YAPISINDA 4 BOLUM URET:

### 1. consultantIntro (string — 4-6 cumle)
Bir marka strateji danismaninin isletme sahibiyle ILK TOPLANTIDA yuz yuze oturarak yapacagi ACILIS KONUSMASI.

ZORUNLU KURALLAR:
- RAKIP ISIMLERINI KULLAN: "${allCompetitors.slice(0, 3).join(', ')}" gibi GERCEK isimleri yaz. "Rakipler" kelimesi YASAK.
- SOMUT GERCEKLIK: "${bName}" adini, kurulis hikayesini, sektordeki konumunu kullan. GENEL GECERDIR laflar YASAK.
- STRATEJIK ICGORU: Bu isletmenin ASIL savasinin ne oldugunu TEK CUMLEDE soyle.
- YONLENDIRME: Son cumlede "simdi bunu birlikte analiz edecegiz" tarzinda kapat ama SOMUT olarak neyi analiz ettigini soyle.
- "SIZ" DIYE HITAP ET. Samimi ve profesyonel.
- PROFESYONEL VE GUVEN VEREN ton kullan. Isletme sahibine saygiyla hitap et.
- Somut veriler ve arastirma bulgulariyla destekle. Spekulasyon YAPMA.
- Samimi ama otoriter degil — danismanlik tonunda, bilgi paylasir gibi.
- Isletmenin guclu yanlarini ONCE kabul et, sonra gelisim alanlarini belirt.
- Litmus test: Isletme adini degistirsen cumle ANLAMSIZLASMALI.

YASAKLI KALIPLAR:
- "Rekabetin yogun oldugu bir sektorde faaliyet gosteriyorsunuz"
- "Markanizi farklilastirmaniz gerekiyor"
- "Dijital dunyada gorunur olmaniz onemli"
- "Kaliteli urunleriniz ile one cikabilirsiniz"

### 2. diagnosisSummary (object)
Algi vs Gerceklik analizi. Wizard cevaplarinda isletme sahibinin SOYLEDIKLERI ile sentezlenmis strateji ve dijital varlik verisinin GOSTERDIKLERINI kiyasla.

- perceptionVsReality: En az 3, en fazla 5 madde. Her biri:
  - perception: Isletme sahibinin soyledigi/iddia ettigi sey
  - reality: Verilerin gosterdigi gercek durum
  - gap: Aradaki uyumsuzluk
  - recommendation: Bu gapi kapatmak icin ozel oneri
- blindSpots: Isletme sahibinin FARKINDA OLMADIGI 2-3 kritik konu (challenger + dijital analizden)
- criticalMisalignment: TEK CUMLEDE en kritik uyumsuzluk

### 3. emotionalNarrative (object)
Markanin KENDI sesinden/tonundan yaz. Arketip: ${personality.archetype}, Ton: ${personality.tone}, Ses: ${personality.voice}

- manifesto: 3-5 cumlelik marka manifestosu. Markanin dunya gorusunu, durusu ve vaadini icersin. Resmi degil, markanin KENDI dilinde.
- transformationStory: Musterinin "oncesi→sonrasi" hikayesi. Markanin hayatlarinda ne degistirdigini anlat.
- oneLinePromise: 10 kelimeyi gecmeyen, akilda kalici marka vaadi.

### 4. revenueImpact (object)
Somut is etkisi analizi. Aksiyon planindaki maddelerle ve dijital eksikliklerle DOGRUDAN baglantili ol.

- currentState: Isletmenin su anki dijital/marka durumunun 2-3 cumlelik ozeti. Rakamsal veriler kullan (dijital skor, takipci, vb.)
- growthDrivers: En az 3, en fazla 5 buyume kaldiraci. Her biri:
  - driver: Spesifik aksiyon (aksiyon plani maddelerinden turetilmis)
  - estimatedImpact: Tahmini etki (orn: "organik trafik %40 artis", "direkt rezervasyon orani %15→%30")
  - timeframe: Gercekci zaman dilimi
- investmentToGrowthRatio: BU ALANI BOS BIRAK. Yatirim-buyume orani belirtme.

---

ONEMLI:
- TUM alanlari DOLDUR, hicbir alan bos birakilamaz.
- perceptionVsReality EN AZ 3 madde olmali.
- growthDrivers EN AZ 3 madde olmali.
- Turkce yaz, teknik terimler disinda Ingilizce kullanma.
- Tum verileri CROSS-REFERENCE et: wizard cevaplari + strateji + dijital analiz + challenger + tuketici testi.

- KANIT ZINCIRI: Her growthDriver icin impactHypothesis (varsayim), assumptions (varsayimlar listesi) ve confidenceLevel (verified/grounded/inferred/speculative) zorunlu. "verified" = arastirma verisine dayali, "grounded" = framework + veri sentezi, "inferred" = AI cikarimi ama mantikli, "speculative" = varsayim agirlikli.
- ETKI BUYUKLUGU SIRASI: growthDrivers'i tahmini etkiye gore BUYUKTEN KUCUGE sirala.
- ILK 90 GUN FILTRESI: Her driver icin "ilk 90 gunde olculebilir mi?" sorusunu cevapla.

JSON FORMATI:
{
  "consultantIntro": "string",
  "diagnosisSummary": {
    "perceptionVsReality": [{ "perception": "", "reality": "", "gap": "", "recommendation": "" }],
    "blindSpots": [""],
    "criticalMisalignment": ""
  },
  "emotionalNarrative": {
    "manifesto": "",
    "transformationStory": "",
    "oneLinePromise": ""
  },
  "revenueImpact": {
    "currentState": "",
    "growthDrivers": [{ "driver": "", "estimatedImpact": "", "timeframe": "", "impactHypothesis": "Bu tahmin su varsayima dayaniyor: [X]", "assumptions": ["Varsayim 1", "Varsayim 2"], "confidenceLevel": "verified/grounded/inferred/speculative" }],
    "investmentToGrowthRatio": ""
  }
}`;

  const raw = await generateJSON<ValueMaximizerOutput>('flash', prompt, 'BrandValueMaximizer', {
    temperature: 0.7,
    maxOutputTokens: 4096,
  });

  // --- Validation & Fallbacks ---

  // consultantIntro
  const consultantIntro = (typeof raw.consultantIntro === 'string' && raw.consultantIntro.trim().length > 20)
    ? raw.consultantIntro.trim()
    : `${bName} olarak ${sector} sektorunde konumlanmaniz, mevcut veriler isiginda yeniden degerlendirilmeyi bekliyor. Simdi bunu birlikte inceleyecegiz.`;

  // diagnosisSummary
  const diagRaw = raw.diagnosisSummary;
  const perceptionVsReality = (Array.isArray(diagRaw?.perceptionVsReality) && diagRaw.perceptionVsReality.length >= 1)
    ? diagRaw.perceptionVsReality.map(item => ({
        perception: item.perception || 'Belirtilmemis',
        reality: item.reality || 'Veri yetersiz',
        gap: item.gap || 'Belirsiz',
        recommendation: item.recommendation || 'Daha fazla analiz gerekli',
      }))
    : [{
        perception: 'Isletme sahibi mevcut konumunu yeterli goruyor',
        reality: 'Dijital veriler farkli bir tablo ciziyor',
        gap: 'Algi-gerceklik farki mevcut',
        recommendation: 'Detayli dijital analiz yapilmali',
      }];

  const blindSpots = (Array.isArray(diagRaw?.blindSpots) && diagRaw.blindSpots.length >= 1)
    ? diagRaw.blindSpots.filter(Boolean)
    : ['Dijital varlik eksiklikleri tam olarak fark edilmemis'];

  const criticalMisalignment = (typeof diagRaw?.criticalMisalignment === 'string' && diagRaw.criticalMisalignment.trim().length > 5)
    ? diagRaw.criticalMisalignment.trim()
    : 'Marka algisi ile dijital gerceklik arasinda belirgin bir kopukluk mevcut.';

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

  // revenueImpact
  const revRaw = raw.revenueImpact;
  const currentState = (typeof revRaw?.currentState === 'string' && revRaw.currentState.trim().length > 10)
    ? revRaw.currentState.trim()
    : `${bName} su anda ${sector} sektorunde dijital donusum asamasinda.`;

  const growthDrivers = (Array.isArray(revRaw?.growthDrivers) && revRaw.growthDrivers.length >= 1)
    ? revRaw.growthDrivers.map(d => ({
        driver: d.driver || 'Dijital varlik iyilestirmesi',
        estimatedImpact: d.estimatedImpact || 'Olculebilir iyilesme bekleniyor',
        timeframe: d.timeframe || '3-6 ay',
        impactHypothesis: d.impactHypothesis || undefined,
        assumptions: Array.isArray(d.assumptions) ? d.assumptions : undefined,
        confidenceLevel: (['verified', 'grounded', 'inferred', 'speculative'] as const).includes(d.confidenceLevel) ? d.confidenceLevel : undefined,
      }))
    : [{
        driver: 'Dijital varlik optimizasyonu',
        estimatedImpact: 'Organik erisimde %20-30 artis',
        timeframe: '3-6 ay',
      }];

  const investmentToGrowthRatio = (typeof revRaw?.investmentToGrowthRatio === 'string' && revRaw.investmentToGrowthRatio.trim().length > 10)
    ? revRaw.investmentToGrowthRatio.trim()
    : 'Stratejik dijital yatirimla olculebilir buyume hedeflenebilir.';

  return {
    consultantIntro,
    diagnosisSummary: {
      perceptionVsReality,
      blindSpots,
      criticalMisalignment,
    },
    emotionalNarrative: {
      manifesto,
      transformationStory,
      oneLinePromise,
    },
    revenueImpact: {
      currentState,
      growthDrivers,
      investmentToGrowthRatio,
    },
  };
}
