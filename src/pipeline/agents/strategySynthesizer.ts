import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis, BusinessContextInput, DigitalPresenceAnalysis, CompetitorDiscoveryOutput, ConsumerTestOutput, DistilledAgentView, FrictionAnalysis } from '../types';
import { getSectorEnrichment } from '../sectorEnrichment';
import { getSectorFrameworkConfig } from '../sectorFrameworks';
import { FOGG_PROMPT_SNIPPET } from '../frameworks/fogg-behavior';

// ─── Distillation Layer ───────────────────────────────────────────────────────
// Condenses all agent outputs into a compact DistilledAgentView.
// Each agent contributes only its final decision, confidence signal, and primary
// risk — NOT raw reasoning text. This prevents "Lost in the Middle" degradation
// when all outputs are concatenated into the synthesizer prompt.
function distillAgentOutputs(
  strategistOutput: StrategistOutput,
  challengerOutput: ChallengerOutput | null,
  blogAdvisorOutput: BlogAdvisorOutput | null,
  researchFindings: ResearchFindings | null,
  consumerTestResult: ConsumerTestOutput | null,
  digitalPresence: DigitalPresenceAnalysis | null,
  competitorDiscovery: CompetitorDiscoveryOutput | null,
  frictionAnalysis: FrictionAnalysis | null,
): DistilledAgentView {
  // Determine dominant Aaker dimension
  let aakerDominantDimension: string | null = null;
  if (strategistOutput.aakerPersonality) {
    const ap = strategistOutput.aakerPersonality;
    const dims = [
      { name: 'Samimiyet', score: ap.sincerity },
      { name: 'Heyecan', score: ap.excitement },
      { name: 'Yetkinlik', score: ap.competence },
      { name: 'Sofistike', score: ap.sophistication },
      { name: 'Sağlamlık', score: ap.ruggedness },
    ];
    aakerDominantDimension = dims.reduce((a, b) => (b.score > a.score ? b : a)).name;
  }

  // Strategist primary/secondary segment
  const ta = strategistOutput.targetAudience;
  const primarySegmentCore = (typeof ta === 'object'
    ? `${ta.primarySegment?.demographics || ''} — ${ta.primarySegment?.behavioralProfile || ''}`
    : String(ta)
  ).slice(0, 100);
  const secondarySegmentCore = (typeof ta === 'object'
    ? `${ta.secondarySegment?.demographics || ''} — ${ta.secondarySegment?.behavioralProfile || ''}`
    : ''
  ).slice(0, 100);

  // Aaker framework score for archetype confidence
  const archetypeConfidence = strategistOutput._frameworkScores
    ?.find(s => s.framework?.toLowerCase().includes('aaker'))?.score
    ?? (strategistOutput.aakerPersonality ? 6 : 4);

  const distilled: DistilledAgentView = {
    strategist: {
      archetype: strategistOutput.archetype,
      archetypeConfidence,
      positioningCore: strategistOutput.positioningStatement.slice(0, 120),
      primarySegmentCore,
      secondarySegmentCore,
      differentiatorCore: strategistOutput.differentiator.slice(0, 100),
      valueLevel: strategistOutput.valueLevel ?? 'product',
      topCompetitorGaps: (strategistOutput.competitiveMap ?? [])
        .slice(0, 4)
        .map(c => `${c.competitorName}: avantaj=${c.ourAdvantage.slice(0, 60)}`),
      customerProblem: strategistOutput.customerProblem ?? null,
      transformationStatement: strategistOutput.transformationStatement ?? null,
      brandEnemy: strategistOutput.brandEnemy ?? null,
      aakerDominantDimension,
    },

    challenger: challengerOutput ? {
      verdict: (challengerOutput.distinctivenessScore ?? 50) >= 60 ? 'validated'
        : (challengerOutput.distinctivenessScore ?? 50) >= 30 ? 'challenged' : 'rejected',
      distinctivenessScore: challengerOutput.distinctivenessScore ?? 50,
      mainRisk: challengerOutput.riskAssessment.slice(0, 120),
      alternativeArchetype: challengerOutput.alternativeArchetype || null,
      strongestBlindSpot: (challengerOutput.blindSpots[0] ?? '').slice(0, 120),
      topChallengePoints: challengerOutput.challengePoints.slice(0, 3),
      onlynessVerdict: challengerOutput.onlynessTest?.verdict ?? null,
      identifiedCliches: challengerOutput.identifiedCliches ?? [],
      challengerAlternatives: (challengerOutput.challengerAlternatives ?? []).slice(0, 2),
      ruthlessFeedbackCore: (challengerOutput.ruthlessFeedback ?? '').slice(0, 150),
    } : null,

    blog: blogAdvisorOutput ? {
      philosophicalAlignmentScore: blogAdvisorOutput.philosophicalAlignment.score,
      topAlignedPrinciples: blogAdvisorOutput.philosophicalAlignment.alignedPrinciples.slice(0, 3),
      topConflictingPrinciples: blogAdvisorOutput.philosophicalAlignment.conflictingPrinciples.slice(0, 2),
      topRecommendations: blogAdvisorOutput.strategicRecommendations
        .slice(0, 3)
        .map(r => `[${r.area}] ${r.recommendation.slice(0, 80)}`),
      contentPillars: blogAdvisorOutput.contentStrategyInsights.contentPillars.slice(0, 4),
      narrativeApproach: blogAdvisorOutput.contentStrategyInsights.narrativeApproach,
    } : null,

    research: researchFindings && researchFindings.sourcesUsed !== 0 ? {
      marketSignal: researchFindings.marketData.growthRate,
      marketSize: researchFindings.marketData.marketSize,
      topCompetitorNames: researchFindings.competitors.slice(0, 5).map(c => c.name),
      mainOpportunity: (researchFindings.opportunities[0] ?? '').slice(0, 120),
      mainThreat: (researchFindings.threats[0] ?? '').slice(0, 120),
      topConsumerTrends: researchFindings.marketData.consumerTrends.slice(0, 3),
      dataConfidence: researchFindings.sourcesUsed >= 5 ? 'high'
        : researchFindings.sourcesUsed >= 2 ? 'medium' : 'low',
      sourcesUsed: researchFindings.sourcesUsed,
    } : null,

    consumerTest: consumerTestResult ? {
      viabilityScore: consumerTestResult.overallViabilityScore,
      strongestFit: consumerTestResult.strongestFit,
      weakestFit: consumerTestResult.weakestFit,
      topRefinements: (consumerTestResult.strategyRefinements ?? []).slice(0, 3),
      topCrossPersonaConcerns: (consumerTestResult.crossPersonaConcerns ?? []).slice(0, 2),
      marketReadiness: consumerTestResult.marketReadiness,
    } : null,

    digital: digitalPresence ? {
      overallScore: digitalPresence.overallDigitalScore,
      maturityLevel: digitalPresence.digitalMaturityLevel,
      topCriticalGaps: (digitalPresence.criticalGaps ?? []).slice(0, 3),
      topQuickWins: (digitalPresence.quickWins ?? []).slice(0, 3),
      websiteQuality: digitalPresence.website?.designQuality ?? null,
      websiteStrengths: (digitalPresence.website?.strengths ?? []).slice(0, 2),
      instagramEngagement: digitalPresence.instagram?.engagementLevel ?? null,
    } : null,

    competitorLandscape: competitorDiscovery ? {
      landscapeSummary: competitorDiscovery.competitiveLandscapeSummary.slice(0, 120),
      marketConcentration: competitorDiscovery.marketConcentration,
      topOpportunities: (competitorDiscovery.competitiveOpportunities ?? []).slice(0, 3),
      topThreats: (competitorDiscovery.competitiveThreats ?? []).slice(0, 3),
      digitalBenchmark: `web kalite ort. ${competitorDiscovery.digitalBenchmark?.avgWebsiteQuality ?? 'N/A'}/10, sosyal ort. ${competitorDiscovery.digitalBenchmark?.avgSocialFollowing ?? 'N/A'}`,
      topCompetitors: [...competitorDiscovery.knownCompetitors, ...competitorDiscovery.discoveredCompetitors]
        .slice(0, 5)
        .map(c => ({
          name: c.name,
          priceSegment: c.priceSegment,
          mainStrength: (c.strengths[0] ?? '').slice(0, 60),
          mainWeakness: (c.weaknesses[0] ?? '').slice(0, 60),
        })),
    } : null,

    friction: frictionAnalysis ? {
      biggestIllusion: frictionAnalysis.biggestIllusion,
      opportunityCost: frictionAnalysis.opportunityCost,
      criticalInsights: frictionAnalysis.strategicInsights
        .filter(i => i.urgency === 'critical')
        .slice(0, 2)
        .map(i => ({
          clientBelief: i.clientBelief.slice(0, 80),
          theInsight: i.theInsight.slice(0, 100),
          strategicPivot: i.strategicPivot.slice(0, 100),
        })),
    } : null,
  };

  return distilled;
}

export async function runStrategySynthesizer(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput,
  challengerOutput: ChallengerOutput | null,
  blogAdvisorOutput: BlogAdvisorOutput | null = null,
  businessContext?: BusinessContextInput,
  digitalPresence?: DigitalPresenceAnalysis | null,
  competitorDiscovery?: CompetitorDiscoveryOutput | null,
  consumerTestResult?: ConsumerTestOutput | null,
  adminNotes?: string,
  frictionAnalysis?: FrictionAnalysis | null,
): Promise<SynthesizedAnalysis> {

  // Build distilled view — replaces all verbose prose summary blocks
  const distilled = distillAgentOutputs(
    strategistOutput,
    challengerOutput,
    blogAdvisorOutput,
    researchFindings,
    consumerTestResult ?? null,
    digitalPresence ?? null,
    competitorDiscovery ?? null,
    frictionAnalysis ?? null,
  );

  // Sector-specific data injection via enrichment module (kept as-is — sector context is authoritative)
  let sectorSpecificContext = '';
  const sectorEnrichment = getSectorEnrichment(normalizedData.sector);
  const sectorFrameworkConfig = getSectorFrameworkConfig(normalizedData.sector);
  if (sectorEnrichment && researchFindings) {
    const sectorData = (researchFindings as any)[sectorEnrichment.dataFieldName];
    if (sectorData) {
      sectorSpecificContext = sectorEnrichment.formatForSynthesizer(sectorData);
    }
  }

  // Source URLs — kept separately for evidence section (not part of distilled)
  let sourceUrlsList = '';
  if (researchFindings?.sourceUrls?.length) {
    sourceUrlsList = researchFindings.sourceUrls
      .slice(0, 10)
      .map((s) => `  - ${s.title}: ${s.url}`)
      .join('\n');
  }

  const expertCount = 1 + (challengerOutput ? 1 : 0) + (blogAdvisorOutput ? 1 : 0) + (consumerTestResult ? 1 : 0);
  const expertNames: string[] = ['Strateji uzmani'];
  if (challengerOutput) expertNames.push('seytan avukati');
  if (blogAdvisorOutput) expertNames.push('stratejik felsefe danismani');
  if (consumerTestResult) expertNames.push('tuketici testi');
  const debateInstruction = expertCount >= 3
    ? `${expertCount} farkli uzmanin goruslerini sentezlemen gerekiyor: ${expertNames.join(', ')}. Her birinin en guclu argumanlarin birlestirerek, cesur ama temelli nihai stratejiyi olustur.${consumerTestResult ? ' Tuketici testi sonuclarini strateji kararlarinda ZORUNLU olarak dikkate al — dusuk uyum gosteren persona segmentlerinde stratejiyi revize et.' : ''}`
    : challengerOutput
    ? 'Iki farkli uzmanin goruslerini inceleyip en iyi stratejiyi sentezlemen gerekiyor. Strateji uzmaninin onerisiyle seytan avukatinin elestirisini dengeleyerek, en guclu ve tutarli sonucu olustur.'
    : blogAdvisorOutput
    ? 'Strateji uzmaninin onerisi ve stratejik felsefe danismaninin degerlendirmesini sentezleyerek nihai stratejiyi olustur.'
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
${bc.brandWhy ? `- Varoluş Amacı (WHY): ${bc.brandWhy}` : ''}
${bc.customerPerception ? `- Müşteri Algısı: ${bc.customerPerception}` : ''}
${bc.existingBrandAssets ? `- Mevcut Marka Varlıkları: ${bc.existingBrandAssets}` : ''}
${bc.futureVision ? `- 3 Yıllık Vizyon: ${bc.futureVision}` : ''}
`
    : '';

  // Brand maturity context
  const maturity = normalizedData.brandMaturity;
  const maturityContext = maturity
    ? `\n## Marka Olgunluk Seviyesi
- Seviye: ${maturity.level} (${maturity.score}/12)
- Rapor Odagi: ${maturity.reportFocus}
- Faktorler: Is yasi=${maturity.factors?.businessAge ?? 'N/A'}, Marka varligi=${maturity.factors?.brandAssets ?? 'N/A'}, Dijital=${maturity.factors?.digitalPresence ?? 'N/A'}, Kitle=${maturity.factors?.audienceSize ?? 'N/A'}`
    : '';

  // Budget-calibrated action plan instructions
  const budgetCalibration = bc?.monthlyBudget
    ? `\n12. BUTCE KALIBRASYONU: Musterinin aylik butcesi "${bc.monthlyBudget}" olarak belirtilmis. actionPlan'daki TUM onerileri bu butce seviyesine uygun olacak sekilde kalibre et. Butceyi asan oneriler YAPMA. Dusuk butce icin organik ve UGC agirlikli stratejiler, orta butce icin hibrit yaklasim, yuksek butce icin tam kapsamli dijital pazarlama onerileri sun. Net TL rakamlari YAZMA.`
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

  // Admin notes — critical expert override for final synthesis
  const adminNotesBlock = adminNotes?.trim()
    ? `\n\n⚠️ KRITIK ADMIN NOTU — NIHAI RAPORDA KESINLIKLE UYULMASI GEREKEN BILGI:\n${adminNotes.trim()}\nBu not, isletmeyi yakindan taniyan uzman tarafindan yazilmistir. Nihai sentez raporunda bu bilgiyi ZORUNLU olarak dikkate al. Bu notla celisen icerik KESINLIKLE raporda yer ALMAMALIDIR. Isletmenin ne is yaptigini, hangi sektorde oldugunu ve konumlandirmasini bu nota gore belirle.\n`
    : '';

  const prompt = `Sen bir marka stratejisi basparlak direktorsun (CSO). ${debateInstruction}

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
- Veri Kalitesi: ${normalizedData.dataQualityScore}
- Tespit Edilen Oruntular: ${normalizedData.detectedPatterns.join('; ') || 'Yok'}
${businessContextSection}${adminNotesBlock}${maturityContext}
## Ajan Kararları (Distilled Intelligence)
Her ajanın nihai kararı, güven sinyali ve birincil riski aşağıdaki yapısal formatta sunulmuştur.
Uzun gerekçeler yerine karar + kanıt + risk odaklı bu veriyi sentezle.

\`\`\`json
${JSON.stringify(distilled, null, 2)}
\`\`\`
${sectorSpecificContext ? `\n## Sektöre Özgü Veriler\n${sectorSpecificContext}` : ''}
${sourceUrlsList ? `\n## Araştırma Kaynakları\n${sourceUrlsList}` : ''}
${distilled.challenger?.identifiedCliches?.length
  ? `\n⚠️ KLİŞE ENGELİ — Challenger ajanı aşağıdaki kelimelerin stratejide JENERİK ve KANITSIZ kullanıldığını tespit etti. Nihai raporda bu kelimeleri KULLANMA ya da spesifik, kanıtlı bir bağlamda kullan:\nYasak kelimeler: ${distilled.challenger.identifiedCliches.join(', ')}\nChallenger'ın önerdiği alternatif konumlandırmalar: ${distilled.challenger.challengerAlternatives?.join(' | ') || 'yok'}`
  : ''
}

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
        "estimatedImpact": "Beklenen etki. Ornek: 'Dijital varlik olusturma — temel adim'",
        "motivationScore": "0-10: Bu aksiyonu yapma motivasyonu ne kadar guclu?",
        "abilityScore": "0-10: Bu aksiyonu yapmak ne kadar kolay?",
        "bottleneck": "motivation/ability/prompt/none — ana darbogazin adi",
        "requiredResources": "Bu aksiyonu yapmak icin ne gerekiyor?",
        "prerequisite": "Oncesinde tamamlanmasi gereken adim (varsa)"
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
  "synthesisRationale": "Bu sentezin NEDEN bu sekilde yapildiginin aciklamasi. Hangi uzman gorusleri benimsendi, hangileri reddedildi ve NEDEN? SOMUT referanslarla. (3-5 cumle)",
  "brandNarrative": {
    "elevatorPitch": "30 saniyelik tanitim metni. Birisi 'ne is yapiyorsunuz?' dediginde soylenmesi gereken 2-3 cumle. Dogal, ezbere degil, akilda kalici.",
    "socialMediaBio": "Instagram/LinkedIn bio metni. Max 150 karakter. Emoji kullanilabilir. Marka tonuna uygun.",
    "brandStory": "Marka hikayesi ozeti (about us sayfasi icin). 3-5 cumle. Kurucunun motivasyonu, markanin vaadi ve farki. Samimi ama profesyonel."
  },
  "intibaEngagement": {
    "recommendedServices": [
      {
        "service": "Hizmet adi (orn: Marka Kimlik Tasarimi, Sosyal Medya Yonetimi, Icerik Uretimi, Web Sitesi, SEO, Performans Reklam)",
        "description": "Neden bu hizmet bu isletme icin gerekli? 1-2 cumle, SOMUT gerekce.",
        "priority": "kritik/onemli/opsiyonel",
        "estimatedInvestment": "BU ALANI BOS BIRAK veya YAZMA. Hizmet fiyati belirtme."
      }
    ],
    "threeMonthRoadmap": "3 aylik yol haritasinda Intiba'nin rolu: Ay 1'de ne yapilir, Ay 2'de ne yapilir, Ay 3'te ne yapilir. SOMUT ciktilarla. (3-5 cumle)",
    "expectedOutcomes": ["3 ay sonunda beklenen OLCULEBILIR sonuclar — orn: 'Instagram takipci sayisi %50 artis', 'Web sitesi trafigi 2x'"],
    "clientReadinessNotes": "Musterinin hazirlik durumu hakkinda notlar. Operasyonel kapasite, dijital olgunluk, ekip ihtiyaci gibi konularda dikkat edilmesi gerekenler. (2-3 cumle)"
  },
  "perceptualMap": {
    "xAxis": { "label": "${sectorFrameworkConfig.perceptualMapAxes.xAxis.label}", "lowEnd": "${sectorFrameworkConfig.perceptualMapAxes.xAxis.lowEnd}", "highEnd": "${sectorFrameworkConfig.perceptualMapAxes.xAxis.highEnd}" },
    "yAxis": { "label": "${sectorFrameworkConfig.perceptualMapAxes.yAxis.label}", "lowEnd": "${sectorFrameworkConfig.perceptualMapAxes.yAxis.lowEnd}", "highEnd": "${sectorFrameworkConfig.perceptualMapAxes.yAxis.highEnd}" },
    "brandPosition": { "x": 0, "y": 0 },
    "competitorPositions": [{ "name": "Rakip adi", "x": 0, "y": 0 }]
  },
  "strategicDepth": {
    "customerProblem": {
      "external": "Musterinin yuzeysel, somut sorunu",
      "internal": "Bu sorunun yarattigi duygu (bunalmis, sinirli, guvensiz...)",
      "philosophical": "'Bu boyle olmamali' — ahlaki boyut"
    },
    "transformationStatement": "Musterimiz [X]'dan [Y]'a gecer — MAX 12 KELIME",
    "brandEnemy": "Markanin KARSI DURDUGU guc/aliskanlik/statukonun parcasi (rakip ismi DEGIL)",
    "weStandFor": ["'Inaniyoruz ki...' — 3 adet cesur, spesifik ilke"],
    "weStandAgainst": ["'Reddediyoruz...' — 3 adet. 'Kotu hizmet' gibi bos laf YASAK"],
    "valueLevel": "commodity/product/service/experience/transformation",
    "valueLevelUpgrade": "Bir ust basamaga cikmak icin SOMUT oneri. Orn: 'Urun satmaktan deneyim satmaya gecmek icin showroom'u interaktif deneyim alanina donusturun'",
    "culturalTension": {
      "expectation": "Toplumun/sektorun normatif beklentisi",
      "reality": "Insanlarin gercekte yasadigi",
      "opportunity": "Bu gerilimi cozen marka firsati"
    }
  },
  "brandCharacter": {
    "sliders": { "friendAuthority": 65, "youngMature": 40, "playfulSerious": 55, "massElite": 70 },
    "behaviors": [
      { "value": "Deger adi", "do": "Bu degerin gozlemlenebilir davranisi", "dont": "Bu degerin ANTI-davranisi (biz bunu YAPMAYIZ)", "example": "Somut durum ornegi" }
    ],
    "weAreThis": ["'Biz buyuz' — 3-4 adet DAVRANISSAL tanimla, tek kelime sifat YASAK"],
    "weAreNotThis": ["'Biz bu degiliz' — 3-4 adet. Negatif tanim pozitiften daha guclu farklilik yaratir"],
    "dinnerPartyDescription": "Eger bu marka bir insan olsaydi, bir aksam yemeginde nasil konusurdu? 2-3 cumle ile CANLANDIR. Giyim tarzi, konusma uslubi, dinleyenlerdeki izlenim."
  },
  "qualityMetrics": {
    "distinctivenessScore": 75,
    "onlynessTest": {
      "statement": "[Marka] [kategoride] [fark] sunan TEK markadir",
      "competitorSwaps": [{ "name": "Rakip", "stillValid": false }]
    },
    "genericPhraseCount": 0
  },
  "kpiFramework": {
    "northStar": { "metric": "Tek ve en onemli basari metrigi — donusum ifadesiyle baglantili", "currentEstimate": "Mevcut tahmini deger", "target90Day": "90 gun sonrasi hedef" },
    "leading": [
      { "metric": "Oncu metrik adi", "target": "Hedef deger", "measurementMethod": "Nasil olculecek" }
    ],
    "lagging": [
      { "metric": "Gecikme metrigi adi", "target": "Hedef deger", "measurementMethod": "Nasil olculecek" }
    ],
    "reviewCadence": "Haftalik/Aylik — ne siklikla gozden gecirilecek"
  },
  "strategyScenarios": {
    "conservative": { "description": "Tutucu senaryo aciklamasi", "investmentLevel": "Aylik yatirim araligi", "expectedOutcome": "3 ay sonunda beklenen sonuc", "timeframe": "Sonuc alma suresi", "risk": "Bu senaryonun riski" },
    "recommended": { "description": "Onerilen senaryo", "investmentLevel": "...", "expectedOutcome": "...", "timeframe": "...", "risk": "..." },
    "aggressive": { "description": "Agresif buyume senaryosu", "investmentLevel": "...", "expectedOutcome": "...", "timeframe": "...", "risk": "..." }
  },
  "brandClaim": {
    "claim": "Rakiplerin soylemedigi, bu markanin sahiplenebilecegi tek guclu Turkce iddia cumlesi. Kaynak: researchFindings rakip bosluklari + strategistOutput.differentiator. JENERIK OLMAMALI — 'Kaliteli hizmet sunuyoruz' gibi ifadeler YASAK. Markaya OZEL, rakip adina kullanilamayacak, keskin bir iddia olmali.",
    "claimRationale": "2-3 cumle: bu iddia neden bu markaya ait, hangi rekabet boslugundan geliyor, blog oruntuleri bunu nasil destekliyor",
    "blogEvidence": {
      "patternSummary": "blogAdvisorOutput veya semanticBlogResults'tan: bu tur markalarda ne is yariyor, hangi icerik yaklasimi en etkili",
      "sourceArticles": [
        { "slug": "makale-slug-1", "title": "Makale baslik 1" },
        { "slug": "makale-slug-2", "title": "Makale baslik 2" }
      ]
    },
    "languageGuide": {
      "usePhrases": [
        "Kullan: somut, markaya ozel ifade 1",
        "Kullan: somut, markaya ozel ifade 2",
        "Kullan: somut, markaya ozel ifade 3",
        "Kullan: somut, markaya ozel ifade 4",
        "Kullan: somut, markaya ozel ifade 5"
      ],
      "avoidPhrases": [
        "Kullanma: jenerik veya rakiplerle ayni dusen ifade 1",
        "Kullanma: jenerik veya rakiplerle ayni dusen ifade 2",
        "Kullanma: jenerik veya rakiplerle ayni dusen ifade 3",
        "Kullanma: jenerik veya rakiplerle ayni dusen ifade 4",
        "Kullanma: jenerik veya rakiplerle ayni dusen ifade 5"
      ],
      "toneExamples": [
        {
          "situation": "Musteri fiyat sorunca",
          "wrongWay": "Fiyatimiz biraz yuksek ama kalitemiz cok iyi",
          "rightWay": "Bu fiyat [SOMUT DEGER] icin — [neyi kapsiyor, rakipte ne eksik]"
        },
        {
          "situation": "Rakiple karsilastirilinca",
          "wrongWay": "Biz daha iyiyiz cunku kaliteliyiz",
          "rightWay": "Biz [SPESIFIK FARK] yapiyoruz, [rakip] ise [ne yapiyor/yapmıyor]"
        },
        {
          "situation": "Sosyal medyada tanitim",
          "wrongWay": "En iyi [sektor] hizmetini sunuyoruz",
          "rightWay": "[MARKA SESINE UYGUN SOMUT TANITIM CUMLESI — gercek metin]"
        }
      ]
    },
    "contentExamples": [
      {
        "channel": "instagram",
        "content": "GERCEK Instagram caption metni — hook + govde + CTA. Template degil, calistirilacak metin.",
        "note": "Hangi pillar, hangi format"
      },
      {
        "channel": "website_hero",
        "content": "H1: [Ana baslik — max 8 kelime]\nAlt baslik: [Destekleyici aciklama — max 15 kelime]",
        "note": "SEO + donusum odakli"
      },
      {
        "channel": "campaign_tagline",
        "content": "Kampanya slogani — max 6 kelime, akilda kalici, markaya ozel",
        "note": "Claim'den turetilmis"
      },
      {
        "channel": "email_subject",
        "content": "E-posta konu satiri — max 50 karakter, merak uyandiran",
        "note": "Acilma orani icin optimize"
      },
      {
        "channel": "linkedin",
        "content": "LinkedIn post metni — uzman perspektifi, insight paylasimi, marka sesiyle. 3-5 paragraf.",
        "note": "B2B veya ortaklik hedefli"
      },
      {
        "channel": "story",
        "content": "Instagram story metin katmani — max 2 satir, buyuk font. Swipe-up veya link icin CTA.",
        "note": "Gorsel uzerine eklenen metin"
      }
    ]
  },
  "strategicInsights": [
    {
      "clientBelief": "Müşteri neye inanıyor (beyan veya örüntü kaynağı)",
      "marketReality": "Veri/dijital/araştırma gerçekte ne gösteriyor",
      "theInsight": "Tek net 'Aha!' cümlesi — soyut değil, somut",
      "strategicPivot": "Bu yüzden şunu yap: somut, ölçülebilir eylem (rakip adı veya rakam içermeli)",
      "evidenceSources": ["wizard", "digital", "research", "competitor"],
      "urgency": "critical",
      "opportunityCostHint": "Bu inanç yüzünden kaybedilen somut fırsat (yoksa null)"
    }
  ]
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

5a. AKSIYON TASARIMI (B=MAP): actionPlan'daki HER aksiyona motivationScore (0-10) ve abilityScore (0-10) puanla. Her ikisi de 4'un altinda olan aksiyonlar icin darbogazin adini "bottleneck" olarak belirt ve aksiyonu KUCULT veya motivasyonu ARTIR. ${FOGG_PROMPT_SNIPPET ? 'Fogg B=MAP modeli kullan.' : ''}

6. "brandPersonality.archetype" seciminde her iki uzmanin da goruslerini dikkate al.

7. "visualWorld.colorPalette" tam olarak 4 renk icermeli: primary, secondary, accent ve neutral.

8. ${challengerOutput ? 'Her iki uzmanin goruslerini referans goster.' : 'Strateji uzmaninin onerisini nasil rafine ettigini acikla.'}

9. Tum metinler TURKCE olmali.
10. Sadece JSON don, baska bir sey yazma.

${distilled.friction ? `
27. ÜÇGENLEME İÇGÖRÜLERİ (strategicInsights): Friction analyzer ajanı müşterinin inançları ile gerçek pazar verilerini çarpıştırarak şu "Aha!" anlarını tespit etti:
En kritik illüzyon: "${distilled.friction.biggestIllusion}"
Fırsat maliyeti: "${distilled.friction.opportunityCost}"
${distilled.friction.criticalInsights.length > 0 ? `Kritik içgörüler:\n${distilled.friction.criticalInsights.map(i => `  - İnanç: ${i.belief} → Gerçek: ${i.reality} → Pivot: ${i.pivot}`).join('\n')}` : ''}

BU İÇGÖRÜLERİ "strategicInsights" dizisine ekle. Her içgörü:
- "theInsight" tek net "Aha!" cümlesi olmalı — soyut değil, somut
- "strategicPivot" yarın uygulanabilir bir eylem — rakip adı veya rakam içermeli
- "So What?" filtresi: "Bu bu müşteri için ne anlama geliyor?" sorusu her içgörüde zaten cevaplanmış olmalı
- "urgency" alanı "critical", "important" veya "useful" olmalı` : `
27. STRATEJİK İÇGÖRÜLER (strategicInsights): Üçgenleme ajanı mevcut değil. Strateji uzmanı ve challenger çıktılarından kendi "Aha!" içgörülerini üret. Her içgörü müşterinin neye inandığını ve gerçekte ne olduğunu çarpıştırmalı.`}

${budgetCalibration}${stageCalibration}${digitalCalibration}${triggerCalibration}
${maturity ? `
16. MARKA OLGUNLUK KALIBRASYONU: Isletme "${maturity.level}" seviyesinde (${maturity.score}/12). Rapor odagi: "${maturity.reportFocus}".
${maturity.level === 'pre_brand' ? '- PRE-BRAND ise: brandNarrative cok onemli (kimlik olusturma), contentStrategy ve hashtags BASIT tut, intibaEngagement\'da "Marka Kimlik Tasarimi" birinci oncelik.' : ''}
${maturity.level === 'emerging' ? '- EMERGING ise: kimlik guclendirme + dijital varlik olusturma. intibaEngagement\'da "Web Sitesi" ve "Sosyal Medya" birinci oncelik.' : ''}
${maturity.level === 'developing' ? '- DEVELOPING ise: strateji optimizasyonu, mevcut kanallari iyilestirme. intibaEngagement\'da "Icerik Uretimi" ve "Performans Reklam" birinci oncelik.' : ''}
${maturity.level === 'mature' ? '- MATURE ise: buyume stratejisi, topluluk olusturma, marka genisletme. intibaEngagement\'da "Marka Stratejisi Danismanligi" ve "Komunite Yonetimi" birinci oncelik.' : ''}` : ''}

17. INTIBA ENGAGEMENT: "intibaEngagement" bolumu bu raporun TICARI DONUSUM noktasidir. Musteri bu bolumu okudigunda "Intiba ile calismak istiyorum" demeli. recommendedServices EN AZ 3, EN FAZLA 6 hizmet icermeli. estimatedInvestment alanina fiyat veya TL rakami YAZMA — bu alan bos birakilmali.

18. BRAND NARRATIVE: "brandNarrative" bolumunde elevatorPitch DOGAL olmali, ezber gibi olmasin. socialMediaBio MAX 150 karakter. brandStory "hakkimizda" sayfasina konulabilecek kalitede.${bc?.brandWhy ? ` Musterinin belirttigi varolus amaci: "${bc.brandWhy}" — bunu narrative'in TEMELINDE kullan.` : ''}

19. PERCEPTUAL MAP: "perceptualMap" icin sektore UYGUN 2 eksen sec (orn: gastronomi icin "Fiyat vs Deneyim", tech icin "Karmasiklik vs Fiyat"). brandPosition ve competitorPositions -5 ile +5 arasinda SOMUT degerler. Arastirmada bulunan EN AZ 3 rakibi haritaya yerlestir.

20. STRATEJIK DERINLIK (strategicDepth): Stratejistin ciktisindaki customerProblem, transformationStatement, brandEnemy, believeReject ve valueLevel verilerini rafine et ve strategicDepth bolumune yerlestir. valueLevelUpgrade alaninda isletmenin deger merdiveninde bir ust basamaga nasil cikacagini SOMUT oner. culturalTension varsa sektore ozgu kulturel gerilimi ekle.

21. MARKA KARAKTERI (brandCharacter): Arketip etiketi KULLANMA. Onun yerine "dinnerPartyDescription" ile markayı bir aksam yemeginde nasil konusacak biri olarak CANLANDIR. behaviors dizisinde her deger icin YAPILACAK davranis + YAPILMAYACAK davranis + SOMUT ornek yaz. weAreThis/weAreNotThis ciftleri SPESIFIK olmali — "Kaliteli" degil "Her detayi dusunmus ama bunu gostermeden yapan" gibi.

22. KALITE METRIKLERI (qualityMetrics): distinctivenessScore 0-100 arasi (challenger'in onlyness testinden turet). onlynessTest'te konumlandirma ifadesini Neumeier formatina cevir ve en az 2 rakiple swap testi yap. genericPhraseCount'ta rapordaki jenerik ifade sayisini say (0 = mukemmel).

23. KPI FRAMEWORK: "kpiFramework" bolumunde North Star metrigi donusum ifadesiyle (transformationStatement) dogrudan baglantili olmali. "leading" metrikleri actionPlan'in "immediate" fazindaki ciktilari olcmeli. "lagging" metrikleri 90 gun sonunda gorulebilecek sonuc metrikleri olmali. EN AZ 2 leading ve 2 lagging metrik.

24. STRATEJI SENARYOLARI: "strategyScenarios" bolumunde 3 farkli senaryo sun. "conservative" dusuk olcekli, "recommended" orta olcekli, "aggressive" yuksek olcekli olmali. investmentLevel'da TL rakami YAZMA — sadece "Dusuk olcek", "Orta olcek", "Yuksek olcek" gibi genel ifadeler kullan.

25. SENARYO OLASILIK AGIRLIGI: strategyScenarios icin her senaryoya "probabilityWeight" (0-1, toplam=1) ve "decisionCriteria" (hangi kosulda bu senaryo secilir) ekle.

26. MARKA IDDIASI (brandClaim): claim alani MARKA SESINE UYGUN, RAKIPLERIN SOYLEMEDIGI, BU MARKAYA OZEL bir iddia olmali. usePhrases EN AZ 5, avoidPhrases EN AZ 5, toneExamples TAM 3 adet (fiyat/rakip/sosyal medya senaryolari). contentExamples GERÇEK KOPYA METINLERI olmali — "template" veya placeholder YASAK. Her channel icin farkli ve kullanima hazir metin yaz. blogEvidence.sourceArticles'ta gercek blog makalesi slug'lari kullan (bilmiyorsan genel aciklayici sluglar kullan, uydurma URL YAZMA).`;

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
    consultantIntro: '',
    synthesisRationale: parsed.synthesisRationale || (challengerOutput
      ? `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi ile seytan avukatinin ${challengerOutput.alternativeArchetype} alternatifi degerlendirilmistir.`
      : `Strateji uzmaninin ${strategistOutput.archetype} arketip onerisi rafine edilerek nihai strateji olusturulmustur.`
    ),
    // Faz 2 — New strategic depth outputs
    brandNarrative: parsed.brandNarrative && parsed.brandNarrative.elevatorPitch
      ? {
          elevatorPitch: parsed.brandNarrative.elevatorPitch,
          socialMediaBio: parsed.brandNarrative.socialMediaBio || '',
          brandStory: parsed.brandNarrative.brandStory || '',
          brandManifesto: parsed.brandNarrative.brandManifesto,
        }
      : undefined,
    intibaEngagement: parsed.intibaEngagement && Array.isArray(parsed.intibaEngagement.recommendedServices)
      ? {
          recommendedServices: parsed.intibaEngagement.recommendedServices.map((s: any) => ({
            service: s.service || '',
            description: s.description || '',
            priority: s.priority || 'onemli',
            estimatedInvestment: '',
          })),
          threeMonthRoadmap: parsed.intibaEngagement.threeMonthRoadmap || '',
          expectedOutcomes: Array.isArray(parsed.intibaEngagement.expectedOutcomes)
            ? parsed.intibaEngagement.expectedOutcomes
            : [],
          clientReadinessNotes: parsed.intibaEngagement.clientReadinessNotes || '',
        }
      : undefined,
    perceptualMap: parsed.perceptualMap && parsed.perceptualMap.xAxis
      ? {
          xAxis: parsed.perceptualMap.xAxis,
          yAxis: parsed.perceptualMap.yAxis,
          brandPosition: parsed.perceptualMap.brandPosition || { x: 0, y: 0 },
          competitorPositions: Array.isArray(parsed.perceptualMap.competitorPositions)
            ? parsed.perceptualMap.competitorPositions
            : [],
        }
      : undefined,
    // Faz 3 — Yapaylıktan uzaklaşma çıktıları
    strategicDepth: parsed.strategicDepth && parsed.strategicDepth.customerProblem
      ? {
          customerProblem: parsed.strategicDepth.customerProblem,
          transformationStatement: parsed.strategicDepth.transformationStatement || '',
          brandEnemy: parsed.strategicDepth.brandEnemy || strategistOutput.brandEnemy || '',
          weStandFor: Array.isArray(parsed.strategicDepth.weStandFor) ? parsed.strategicDepth.weStandFor : (strategistOutput.believeReject?.believe || []),
          weStandAgainst: Array.isArray(parsed.strategicDepth.weStandAgainst) ? parsed.strategicDepth.weStandAgainst : (strategistOutput.believeReject?.reject || []),
          valueLevel: parsed.strategicDepth.valueLevel || strategistOutput.valueLevel || 'service',
          valueLevelUpgrade: parsed.strategicDepth.valueLevelUpgrade || '',
          culturalTension: parsed.strategicDepth.culturalTension || undefined,
        }
      : undefined,
    brandCharacter: parsed.brandCharacter && parsed.brandCharacter.dinnerPartyDescription
      ? {
          sliders: parsed.brandCharacter.sliders || strategistOutput.personalitySliders || { friendAuthority: 50, youngMature: 50, playfulSerious: 50, massElite: 50 },
          behaviors: Array.isArray(parsed.brandCharacter.behaviors) ? parsed.brandCharacter.behaviors : [],
          weAreThis: Array.isArray(parsed.brandCharacter.weAreThis) ? parsed.brandCharacter.weAreThis : [],
          weAreNotThis: Array.isArray(parsed.brandCharacter.weAreNotThis) ? parsed.brandCharacter.weAreNotThis : [],
          dinnerPartyDescription: parsed.brandCharacter.dinnerPartyDescription,
        }
      : undefined,
    qualityMetrics: parsed.qualityMetrics
      ? {
          distinctivenessScore: typeof parsed.qualityMetrics.distinctivenessScore === 'number' ? parsed.qualityMetrics.distinctivenessScore : (challengerOutput?.distinctivenessScore || 50),
          onlynessTest: parsed.qualityMetrics.onlynessTest || (challengerOutput?.onlynessTest ? { statement: challengerOutput.onlynessTest.statement, competitorSwaps: challengerOutput.onlynessTest.competitorSwaps.map((s) => ({ name: s.competitor, stillValid: s.stillValid })) } : { statement: '', competitorSwaps: [] }),
          genericPhraseCount: typeof parsed.qualityMetrics.genericPhraseCount === 'number' ? parsed.qualityMetrics.genericPhraseCount : 0,
        }
      : undefined,
    kpiFramework: parsed.kpiFramework && parsed.kpiFramework.northStar
      ? {
          northStar: parsed.kpiFramework.northStar,
          leading: Array.isArray(parsed.kpiFramework.leading) ? parsed.kpiFramework.leading : [],
          lagging: Array.isArray(parsed.kpiFramework.lagging) ? parsed.kpiFramework.lagging : [],
          reviewCadence: parsed.kpiFramework.reviewCadence || 'Aylik',
        }
      : undefined,
    strategyScenarios: parsed.strategyScenarios && parsed.strategyScenarios.recommended
      ? {
          conservative: { ...parsed.strategyScenarios.conservative, probabilityWeight: parsed.strategyScenarios.conservative?.probabilityWeight, decisionCriteria: parsed.strategyScenarios.conservative?.decisionCriteria },
          recommended: { ...parsed.strategyScenarios.recommended, probabilityWeight: parsed.strategyScenarios.recommended?.probabilityWeight, decisionCriteria: parsed.strategyScenarios.recommended?.decisionCriteria },
          aggressive: { ...parsed.strategyScenarios.aggressive, probabilityWeight: parsed.strategyScenarios.aggressive?.probabilityWeight, decisionCriteria: parsed.strategyScenarios.aggressive?.decisionCriteria },
        }
      : undefined,
    brandClaim: parsed.brandClaim && parsed.brandClaim.claim
      ? {
          claim: parsed.brandClaim.claim,
          claimRationale: parsed.brandClaim.claimRationale || '',
          blogEvidence: {
            patternSummary: parsed.brandClaim.blogEvidence?.patternSummary || '',
            sourceArticles: Array.isArray(parsed.brandClaim.blogEvidence?.sourceArticles)
              ? parsed.brandClaim.blogEvidence.sourceArticles
              : [],
          },
          languageGuide: {
            usePhrases: Array.isArray(parsed.brandClaim.languageGuide?.usePhrases)
              ? parsed.brandClaim.languageGuide.usePhrases
              : [],
            avoidPhrases: Array.isArray(parsed.brandClaim.languageGuide?.avoidPhrases)
              ? parsed.brandClaim.languageGuide.avoidPhrases
              : [],
            toneExamples: Array.isArray(parsed.brandClaim.languageGuide?.toneExamples)
              ? parsed.brandClaim.languageGuide.toneExamples
              : [],
          },
          contentExamples: Array.isArray(parsed.brandClaim.contentExamples)
            ? parsed.brandClaim.contentExamples
            : [],
        }
      : undefined,
    strategicInsights: (() => {
      // First try: synthesizer's own output (enriched/refined)
      if (Array.isArray(parsed.strategicInsights) && parsed.strategicInsights.length > 0) {
        return parsed.strategicInsights
          .filter((i: any) => i.clientBelief && i.theInsight && i.strategicPivot)
          .map((i: any) => ({
            clientBelief: String(i.clientBelief || ''),
            marketReality: String(i.marketReality || ''),
            theInsight: String(i.theInsight || ''),
            strategicPivot: String(i.strategicPivot || ''),
            evidenceSources: Array.isArray(i.evidenceSources) ? i.evidenceSources : ['wizard'],
            urgency: (['critical', 'important', 'useful'].includes(i.urgency) ? i.urgency : 'important') as 'critical' | 'important' | 'useful',
            opportunityCostHint: i.opportunityCostHint || undefined,
          }));
      }
      // Fallback: use raw frictionAnalysis insights
      if (frictionAnalysis && frictionAnalysis.strategicInsights.length > 0) {
        return frictionAnalysis.strategicInsights;
      }
      return undefined;
    })(),
  };
}
