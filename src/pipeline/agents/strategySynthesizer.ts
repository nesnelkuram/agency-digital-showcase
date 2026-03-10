import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput, BlogAdvisorOutput, SynthesizedAnalysis, BusinessContextInput, DigitalPresenceAnalysis, CompetitorDiscoveryOutput } from '../types';
import { getSectorEnrichment } from '../sectorEnrichment';

export async function runStrategySynthesizer(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput,
  challengerOutput: ChallengerOutput | null,
  blogAdvisorOutput: BlogAdvisorOutput | null = null,
  businessContext?: BusinessContextInput,
  digitalPresence?: DigitalPresenceAnalysis | null,
  competitorDiscovery?: CompetitorDiscoveryOutput | null,
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

### Stratejik Felsefe Degerlendirmesi
- Felsefi Uyum Skoru: ${blogAdvisorOutput.philosophicalAlignment.score}/10
- Gerekce: ${blogAdvisorOutput.philosophicalAlignment.rationale}
- Uyumlu Prensipler: ${blogAdvisorOutput.philosophicalAlignment.alignedPrinciples.join('; ') || 'Yok'}
- Celisen Prensipler: ${blogAdvisorOutput.philosophicalAlignment.conflictingPrinciples.join('; ') || 'Yok'}
- Stratejik Oneriler:
${blogAdvisorOutput.strategicRecommendations.map((r) => `  - [${r.area}] ${r.recommendation}`).join('\n')}
- Icerik Stratejisi:
  - Ton Uyumu: ${blogAdvisorOutput.contentStrategyInsights.toneAlignment}
  - Icerik Sutunlari: ${blogAdvisorOutput.contentStrategyInsights.contentPillars.join(', ')}
  - Anlati Yaklasimi: ${blogAdvisorOutput.contentStrategyInsights.narrativeApproach}
- Stratejik Perspektif: ${blogAdvisorOutput.authorPerspective}
- Alternatif Icgoruler:
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

  // Sector-specific data injection via enrichment module
  let sectorSpecificContext = '';
  const sectorEnrichment = getSectorEnrichment(normalizedData.sector);
  if (sectorEnrichment && researchFindings) {
    const sectorData = (researchFindings as any)[sectorEnrichment.dataFieldName];
    if (sectorData) {
      sectorSpecificContext = sectorEnrichment.formatForSynthesizer(sectorData);
    }
  }

  // Build digital presence context (if available)
  let digitalPresenceContext = '';
  if (digitalPresence) {
    const parts: string[] = [];
    if (digitalPresence.website && digitalPresence.website.status === 'analyzed') {
      const w = digitalPresence.website;
      parts.push(`Web Sitesi (${w.url}): Tasarim kalitesi ${w.designQuality}/10. ${w.overallImpression}`);
      if (w.products.length > 0) parts.push(`  Urunler: ${w.products.slice(0, 5).map(p => `${p.name}${p.price ? ` (${p.price})` : ''}`).join(', ')}`);
      if (w.strengths.length > 0) parts.push(`  Web Guclu: ${w.strengths.join('; ')}`);
      if (w.weaknesses.length > 0) parts.push(`  Web Zayif: ${w.weaknesses.join('; ')}`);
    }
    if (digitalPresence.instagram && digitalPresence.instagram.status === 'analyzed') {
      const ig = digitalPresence.instagram;
      parts.push(`Instagram (@${ig.handle}): Etkilesim ${ig.engagementLevel}, paylasim sikligi ${ig.postingFrequency || 'bilinmiyor'}, gorsel tarzi: ${ig.visualStyle}`);
      if (ig.contentThemes.length > 0) parts.push(`  Icerik temalari: ${ig.contentThemes.join(', ')}`);
      if (ig.strengths.length > 0) parts.push(`  IG Guclu: ${ig.strengths.join('; ')}`);
      if (ig.weaknesses.length > 0) parts.push(`  IG Zayif: ${ig.weaknesses.join('; ')}`);
    }
    parts.push(`Dijital Olgunluk: ${digitalPresence.digitalMaturityLevel} (${digitalPresence.overallDigitalScore}/10)`);
    if (digitalPresence.criticalGaps.length > 0) parts.push(`Kritik Eksikler: ${digitalPresence.criticalGaps.join('; ')}`);
    if (digitalPresence.quickWins.length > 0) parts.push(`Hizli Kazanimlar: ${digitalPresence.quickWins.join('; ')}`);
    digitalPresenceContext = `\n\n## Dijital Varlik Analizi\n${parts.join('\n')}`;
  }

  // Build competitor discovery context (if available)
  let competitorDiscoveryContext = '';
  if (competitorDiscovery) {
    const allCompetitors = [...competitorDiscovery.knownCompetitors, ...competitorDiscovery.discoveredCompetitors];
    const competitorLines = allCompetitors.slice(0, 10).map(c =>
      `- ${c.name} (${c.source}): ${c.positioning}. Fiyat: ${c.priceSegment}. Dijital: ${c.digitalPresenceScore}/10. Guclu: ${c.strengths.slice(0, 2).join(', ')}. Zayif: ${c.weaknesses.slice(0, 2).join(', ')}`
    ).join('\n');
    competitorDiscoveryContext = `\n\n## Genisletilmis Rakip Analizi (${allCompetitors.length} rakip)
Rekabet Ortami: ${competitorDiscovery.competitiveLandscapeSummary}
Pazar Yogunlugu: ${competitorDiscovery.marketConcentration}
${competitorLines}
Giris Engelleri: ${competitorDiscovery.entryBarriers.join('; ') || 'Bilgi yok'}
Firsatlar: ${competitorDiscovery.competitiveOpportunities.join('; ') || 'Bilgi yok'}
Dijital Benchmark: Web kalite ort. ${competitorDiscovery.digitalBenchmark.avgWebsiteQuality}/10, Sosyal medya ort. ${competitorDiscovery.digitalBenchmark.avgSocialFollowing}`;
  }

  const expertCount = 1 + (challengerOutput ? 1 : 0) + (blogAdvisorOutput ? 1 : 0);
  const debateInstruction = expertCount === 3
    ? 'Uc farkli uzmanin goruslerini sentezlemen gerekiyor: Strateji uzmani, seytan avukati ve stratejik felsefe danismani. Her ucunun en guclu argumanlarin birlestirerek, cesur ama temelli nihai stratejiyi olustur.'
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
- Faktorler: Is yasi=${maturity.factors.businessAge}, Marka varligi=${maturity.factors.brandAssets}, Dijital=${maturity.factors.digitalPresence}, Kitle=${maturity.factors.audienceSize}`
    : '';

  // Budget-calibrated action plan instructions
  const budgetCalibration = bc?.monthlyBudget
    ? `\n12. BUTCE KALIBRASYONU: Musterinin aylik butcesi "${bc.monthlyBudget}" olarak belirtilmis. actionPlan'daki TUM onerileri bu butceye uygun olacak sekilde kalibre et. Butceyi asan oneriler YAPMA. Ornegin: "starter" (50-100K TL) butce icin yuksek produksiyonlu kampanyalar yerine organik ve UGC agirlikli stratejiler sun. "growth" (100-200K TL) icin hibrit yaklasim, "scale" (200-400K TL) icin tam kapsamli dijital pazarlama onerileri yap.`
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
${businessContextSection}${maturityContext}
## Uzman Gorusleri
${strategistSummary}
${competitiveMapSummary}
${challengerSummary}
${blogAdvisorSummary}
${researchContext}${sectorSpecificContext}
${digitalPresenceContext}
${competitorDiscoveryContext}

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
        "estimatedInvestment": "Tahmini aylik/proje bazli yatirim araligi (TL). Musterinin butcesiyle UYUMLU olmali."
      }
    ],
    "threeMonthRoadmap": "3 aylik yol haritasinda Intiba'nin rolu: Ay 1'de ne yapilir, Ay 2'de ne yapilir, Ay 3'te ne yapilir. SOMUT ciktilarla. (3-5 cumle)",
    "expectedOutcomes": ["3 ay sonunda beklenen OLCULEBILIR sonuclar — orn: 'Instagram takipci sayisi %50 artis', 'Web sitesi trafigi 2x'"],
    "clientReadinessNotes": "Musterinin hazirlik durumu hakkinda notlar. Operasyonel kapasite, dijital olgunluk, ekip ihtiyaci gibi konularda dikkat edilmesi gerekenler. (2-3 cumle)"
  },
  "perceptualMap": {
    "xAxis": { "label": "Birinci eksen etiketi (orn: Fiyat)", "lowEnd": "Dusuk uc (orn: Ekonomik)", "highEnd": "Yuksek uc (orn: Premium)" },
    "yAxis": { "label": "Ikinci eksen etiketi (orn: Deneyim)", "lowEnd": "Dusuk uc (orn: Fonksiyonel)", "highEnd": "Yuksek uc (orn: Deneyimsel)" },
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
  }
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

${budgetCalibration}${stageCalibration}${digitalCalibration}${triggerCalibration}
${maturity ? `
16. MARKA OLGUNLUK KALIBRASYONU: Isletme "${maturity.level}" seviyesinde (${maturity.score}/12). Rapor odagi: "${maturity.reportFocus}".
${maturity.level === 'pre_brand' ? '- PRE-BRAND ise: brandNarrative cok onemli (kimlik olusturma), contentStrategy ve hashtags BASIT tut, intibaEngagement\'da "Marka Kimlik Tasarimi" birinci oncelik.' : ''}
${maturity.level === 'emerging' ? '- EMERGING ise: kimlik guclendirme + dijital varlik olusturma. intibaEngagement\'da "Web Sitesi" ve "Sosyal Medya" birinci oncelik.' : ''}
${maturity.level === 'developing' ? '- DEVELOPING ise: strateji optimizasyonu, mevcut kanallari iyilestirme. intibaEngagement\'da "Icerik Uretimi" ve "Performans Reklam" birinci oncelik.' : ''}
${maturity.level === 'mature' ? '- MATURE ise: buyume stratejisi, topluluk olusturma, marka genisletme. intibaEngagement\'da "Marka Stratejisi Danismanligi" ve "Komunite Yonetimi" birinci oncelik.' : ''}` : ''}

17. INTIBA ENGAGEMENT: "intibaEngagement" bolumu bu raporun TICARI DONUSUM noktasidir. Musteri bu bolumu okudigunda "Intiba ile calismak istiyorum" demeli. recommendedServices EN AZ 3, EN FAZLA 6 hizmet icermeli. Her hizmetin estimatedInvestment alani musterinin belirttiegi butceyle UYUMLU olmali.

18. BRAND NARRATIVE: "brandNarrative" bolumunde elevatorPitch DOGAL olmali, ezber gibi olmasin. socialMediaBio MAX 150 karakter. brandStory "hakkimizda" sayfasina konulabilecek kalitede.${bc?.brandWhy ? ` Musterinin belirttigi varolus amaci: "${bc.brandWhy}" — bunu narrative'in TEMELINDE kullan.` : ''}

19. PERCEPTUAL MAP: "perceptualMap" icin sektore UYGUN 2 eksen sec (orn: gastronomi icin "Fiyat vs Deneyim", tech icin "Karmasiklik vs Fiyat"). brandPosition ve competitorPositions -5 ile +5 arasinda SOMUT degerler. Arastirmada bulunan EN AZ 3 rakibi haritaya yerlestir.

20. STRATEJIK DERINLIK (strategicDepth): Stratejistin ciktisindaki customerProblem, transformationStatement, brandEnemy, believeReject ve valueLevel verilerini rafine et ve strategicDepth bolumune yerlestir. valueLevelUpgrade alaninda isletmenin deger merdiveninde bir ust basamaga nasil cikacagini SOMUT oner. culturalTension varsa sektore ozgu kulturel gerilimi ekle.

21. MARKA KARAKTERI (brandCharacter): Arketip etiketi KULLANMA. Onun yerine "dinnerPartyDescription" ile markayı bir aksam yemeginde nasil konusacak biri olarak CANLANDIR. behaviors dizisinde her deger icin YAPILACAK davranis + YAPILMAYACAK davranis + SOMUT ornek yaz. weAreThis/weAreNotThis ciftleri SPESIFIK olmali — "Kaliteli" degil "Her detayi dusunmus ama bunu gostermeden yapan" gibi.

22. KALITE METRIKLERI (qualityMetrics): distinctivenessScore 0-100 arasi (challenger'in onlyness testinden turet). onlynessTest'te konumlandirma ifadesini Neumeier formatina cevir ve en az 2 rakiple swap testi yap. genericPhraseCount'ta rapordaki jenerik ifade sayisini say (0 = mukemmel).`;

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
            estimatedInvestment: s.estimatedInvestment || '',
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
  };
}
