import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput, ChallengerOutput } from '../types';

export async function runBrandChallenger(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  strategistOutput: StrategistOutput,
  businessContext?: { brandWhy?: string; customerPerception?: string; existingBrandAssets?: string; futureVision?: string; businessStage?: string },
  adminNotes?: string
): Promise<ChallengerOutput> {

  // Build rich research context (if available)
  let researchContext = '';
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors
      .map((c) => `- ${c.name}${c.website ? ` (${c.website})` : ''}: ${c.positioning}
    Olcek: ${c.estimatedScale || 'Bilinmiyor'} | Sosyal: ${c.socialPresence || 'Bilinmiyor'}
    Guclu: ${c.strengths.join(', ')} | Zayif: ${c.weaknesses.join(', ')}`)
      .join('\n');

    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;

    researchContext = `
## Sektor Arastirmasi Verileri

### Rakipler (Dogrulanmis)
${competitorSummary || 'Bilgi yok'}

### Pazar Verileri
- Pazar Buyuklugu: ${marketInfo.marketSize}
- Buyume Hizi: ${marketInfo.growthRate}
- Tuketici Trendleri: ${marketInfo.consumerTrends.join('; ') || 'Bilgi yok'}

### Hedef Kitle Verileri
- Demografi: ${audience.demographics}
- Acil Ihtiyaclar: ${audience.painPoints.join('; ') || 'Bilgi yok'}
- Satin Alma: ${audience.purchaseBehavior}

### Firsatlar
${researchFindings.opportunities.map((o) => `- ${o}`).join('\n') || 'Bilgi yok'}

### Tehditler
${researchFindings.threats.map((t) => `- ${t}`).join('\n') || 'Bilgi yok'}

### Sektor Standartlari
${researchFindings.sectorBenchmarks.map((b) => `- ${b}`).join('\n') || 'Bilgi yok'}
`;
  }

  // Format strategist's target audience for context
  const taSegments = strategistOutput.targetAudience;
  const targetAudienceSummary = typeof taSegments === 'string'
    ? taSegments
    : `Birincil Segment: ${taSegments.primarySegment?.demographics || 'Belirtilmedi'} — ${taSegments.primarySegment?.behavioralProfile || ''}\nIkincil Segment: ${taSegments.secondarySegment?.demographics || 'Belirtilmedi'} — ${taSegments.secondarySegment?.behavioralProfile || ''}`;

  // Format value proposition reasoning for context
  const vpReasoning = strategistOutput.valuePropositionReasoning;
  const vpSummary = vpReasoning
    ? `\n- Urun/Hizmet: ${vpReasoning.whatBusinessProduces}\n- Temel Fayda: ${vpReasoning.coreBenefit}\n- Kimin Icin: ${vpReasoning.whoBenefits}\n- Fiyat Konumlandirmasi: ${vpReasoning.pricePositioning}`
    : '';

  // Brand maturity context
  const maturity = normalizedData.brandMaturity;
  const maturityContext = maturity
    ? `\n## Marka Olgunluk Seviyesi
- Seviye: ${maturity.level} (Skor: ${maturity.score}/12)
- Faktörler: İşletme Yaşı=${maturity.factors.businessAge}, Marka Varlıkları=${maturity.factors.brandAssets}, Dijital Varlık=${maturity.factors.digitalPresence}, Kitle Büyüklüğü=${maturity.factors.audienceSize}
- Rapor Odağı: ${maturity.reportFocus}`
    : '';

  // Business context deep signals
  const deepContext = businessContext
    ? `\n## Derin İşletme Sinyalleri
${businessContext.brandWhy ? `- Varoluş Amacı (WHY): ${businessContext.brandWhy}` : ''}
${businessContext.customerPerception ? `- Müşteri Algısı: ${businessContext.customerPerception}` : ''}
${businessContext.existingBrandAssets ? `- Mevcut Marka Varlıkları: ${businessContext.existingBrandAssets}` : ''}
${businessContext.futureVision ? `- 3 Yıllık Vizyon: ${businessContext.futureVision}` : ''}`
    : '';

  // Admin notes — critical expert override
  const adminNotesContext = adminNotes?.trim()
    ? `\n\n⚠️ KRITIK ADMIN NOTU — ZORUNLU BAGLAMSAL BILGI:\n${adminNotes.trim()}\nBu notu yazan uzman, isletmeyi yakindan taniyor. Elestirillerini bu bilgiye UYGUN yap. Bu notla celisen varsayimlar URETME. Ozellikle isletmenin ne is yaptigini bu nota gore degerlendir.\n`
    : '';

  const prompt = `Sen deneyimli bir marka danismanisin ve SEYTAN AVUKATI olarak gorev yapiyorsun. Bir baska strateji uzmani asagidaki marka konumlandirmasini onerdi. Senin gorevin bu stratejiyi ELESTIREL ve KANIT TABANLI gozle incelemek.

## Isletme Bilgileri
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}${maturityContext}${deepContext}${adminNotesContext}

## Onerilen Strateji (Strateji Uzmani Ciktisi)
- Arketip: ${strategistOutput.archetype}
- Arketip Gerekce: ${strategistOutput.archetypeRationale}
- Kisilik Ozellikleri: ${strategistOutput.traits.join(', ')}
- Iletisim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandirma: ${strategistOutput.positioningStatement}
- Hedef Kitle: ${targetAudienceSummary}${vpSummary}
- Farklilik: ${strategistOutput.differentiator}
- Rekabet Avantaji: ${strategistOutput.competitiveAdvantage}
${strategistOutput.brandEnemy ? `- Marka Dusmani: ${strategistOutput.brandEnemy}` : ''}
${strategistOutput.transformationStatement ? `- Donusum Ifadesi: ${strategistOutput.transformationStatement}` : ''}
${strategistOutput.believeReject ? `- Inanislar: ${strategistOutput.believeReject.believe?.join('; ')}\n- Redler: ${strategistOutput.believeReject.reject?.join('; ')}` : ''}
${strategistOutput.customerProblem ? `- Musteri Problemi (Dis): ${strategistOutput.customerProblem.external}\n- Musteri Problemi (Ic): ${strategistOutput.customerProblem.internal}\n- Musteri Problemi (Felsefi): ${strategistOutput.customerProblem.philosophical}` : ''}

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
  "counterPosition": "Onerilen stratejiye SOMUT VE KANITLI karsi-pozisyon. Hangi SEKTOR VERISI veya RAKIP BILGISI stratejinin zayif noktasini gosteriyor? (2-3 cumle, referanslarla)",
  "alternativeArchetype": "Alternatif bir Jung arktipi onerisi (Turkce)",
  "alternativeArchetypeRationale": "Neden bu alternatif arktipin DAHA UYGUN olabileceginin KANITLI aciklamasi. Hangi wizard cevaplari veya pazar verileri bu alternatifi destekliyor? (2-3 cumle)",
  "challengePoints": [
    "ELESTIRI 1: Somut sorun + KANIT. Ornek: 'Stratejist premium konumlanma oneriyor, ancak sektor arastirmasina gore [rakip X] zaten premium segmentte %40 pazar payina sahip. Yeni giris icin bu segment riskli.'",
    "ELESTIRI 2: Farkli bir alana odaklanan somut sorun + kanit.",
    "ELESTIRI 3: Uygulama riskleri veya gozden kacirilan faktor + kanit."
  ],
  "alternativePositionings": [
    "ALTERNATIF 1: Hangi rakibin hangi acigini kullanarak ne tarz bir konumlandirma yapilabilir? Somut cumle. (1-2 cumle)",
    "ALTERNATIF 2: Farkli bir hedef kitleye veya segmente yonelik alternatif. (1-2 cumle)"
  ],
  "riskAssessment": "Onerilen stratejinin uygulanmasi halinde ortaya cikabilecek SOMUT riskler. Hangi pazar kosulları, hangi rakip hamleleri, hangi tuketici davranisi degisikligi bu stratejiyi tehlikeye atabilir? (2-3 cumle)",
  "blindSpots": [
    "KOR NOKTA 1: Arastirma verilerinde gozuken ama stratejistin GORMEZDEN GELDIGI trend veya tehdit.",
    "KOR NOKTA 2: Eksik birakilmis onemli bir faktor."
  ],
  "onlynessTest": {
    "statement": "${normalizedData.businessName}, [kategoride] [fark] sunan TEK markadir. — Stratejistin konumlandirmasini Neumeier Onlyness formatina cevir.",
    "competitorSwaps": [
      { "competitor": "Rakip 1 adi", "stillValid": true, "reason": "Bu cumle rakip icin de gecerli mi, neden?" },
      { "competitor": "Rakip 2 adi", "stillValid": false, "reason": "..." }
    ],
    "verdict": "'strong' (hicbir rakip icin gecerli degil), 'weak' (1 rakip icin gecerli), 'generic' (cogu rakip icin gecerli — YENIDEN YAZILMALI)"
  },
  "distinctivenessScore": 75,
  "riskMitigationPlans": [
    {
      "risk": "Tespit edilen SOMUT risk",
      "likelihood": "yuksek/orta/dusuk",
      "impact": "yuksek/orta/dusuk",
      "mitigation": "Bu riski azaltmak icin SOMUT strateji",
      "earlyWarning": "Bu riskin gerceklesmeye basladigini gosteren erken sinyal"
    }
  ]
}

KRITIK KURALLAR:
1. Elestiriler YAPICI olmali — amac stratejiyi GELISTIRMEK, cokertmek degil.
2. HER elestiri KANIT icermeli: sektor verisi, rakip ornegi, tuketici trendi veya wizard cevabi referans gosterilmeli. KANIITSIZ elestiri = BASARISIZ rapor.
3. "challengePoints" 3-5 adet olmali. Her biri FARKLI bir alana odaklanmali: pazar, hedef kitle, rekabet, uygulama, iletisim.
4. "alternativePositionings" 2-3 adet olmali. Her biri SOMUT bir rakibin SOMUT bir acigini kullanmali.
5. "blindSpots" icin arastirma verisinde gordugun ama stratejistin kullanmadigi bilgileri isaret et.
6. BOS LAF YASAK: "Hedef kitle daha da daraltilabilir" gibi GENEL ifadeler YASAK. "Arastirmaya gore [segment X] %Y buyume gosteriyor, stratejist bunu dahil etmemis" gibi SPESIFIK ol.
7. ${hasResearch ? 'Sektor arastirmasi bulgularini DOGRUDAN referans goster. Rakip isimlerini kullan.' : 'Sektor arastirmasi mevcut degil, genel sektor bilgini kullanarak somut elestiriler sun.'}
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.
10. GROUNDING KONTROLU: Her iddianda arastirma verisinde kanit olup olmadigini belirt. Arastirma verisinde dogrudan kaniti OLMAYAN bir iddia yapiyorsan, bunu ACIKCA isaretle: "(Sektor genel bilgisine dayali — arastirmada dogrudan kanit bulunamadi)". Bu sayede stratejist hangi elestirilerin DOGRULANMIS veriye, hangilerinin VARSAYIMA dayandigini bilir.
11. OLGUNLUK KALIBRASYONU: ${maturity ? `Bu isletme "${maturity.level}" seviyesinde (${maturity.score}/12).` : 'Olgunluk verisi mevcut degil.'} Elestirini isletmenin bulundugu asamaya gore kalibre et:
   - pre_brand (0-3): Stratejistin temel kimlik onerilerine odaklan. Fazla sofistike strateji onerildiyse bunu elestir — once temel logo, isim tutarliligi, renk paleti olusturulmali.
   - emerging (4-6): Kimlik guclendirilmeli. Stratejist dijital varlik olmadan premium konumlanma oneriyorsa bunu sorgula.
   - developing (7-9): Strateji optimizasyonuna odaklan. Alternatif konumlandirmalar SOMUT rakip aciklariyla desteklenmeli.
   - mature (10-12): Buyume ve sadakat stratejilerini sorgula. Yeni pazar segmentleri, marka genislemesi riskleri.
12. WHY KONTROLU: ${businessContext?.brandWhy ? `Isletmenin varolus amaci: "${businessContext.brandWhy}". Stratejistin onerisi bu WHY ile tutarli mi? Arketip ve ton bu amaci yansitıyor mu? Tutarsizlik varsa acikca belirt.` : 'Varolus amaci (WHY) bilgisi mevcut degil — stratejistin arketip seciminin temelsiz olma riskini belirt.'}
13. MUSTERI ALGISI KONTROLU: ${businessContext?.customerPerception ? `Musteri gozunden gercek algi: "${businessContext.customerPerception}". Stratejistin onerisi ile gercek musteri algisi arasinda FARK var mi? Strateji musterinin zaten hissettigi degerleri guclendiriyor mu yoksa tamamen farkli bir yone mi gidiyor?` : 'Musteri algisi verisi yok — stratejistin onerisinin gercek musteri deneyimiyle dogrulanmadigini belirt.'}
14. VIZYON UYUMU: ${businessContext?.futureVision ? `3 yillik vizyon: "${businessContext.futureVision}". Onerilen strateji bu vizyona giden yolda mi yoksa farkli bir rotada mi? Kisa vadeli strateji uzun vadeli vizyonla celisiyor mu?` : ''}

15. RISK AZALTMA PLANLARI: "riskMitigationPlans" bolumunde riskAssessment'taki HER riski ayri bir plan olarak detaylandir. EN AZ 3 risk plani. Her plan icin SOMUT azaltma stratejisi ve ERKEN UYARI sinyali belirt. likelihood ve impact kombinasyonu "yuksek-yuksek" olan riskler ACIL isaret edilmeli.`;

  const parsed = await generateJSON<ChallengerOutput>('pro', prompt, 'BrandChallenger', {
    temperature: 0.8,
    maxOutputTokens: 8192,
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
    // Faz 3 — Onlyness testi + kalite
    onlynessTest: parsed.onlynessTest || undefined,
    distinctivenessScore: typeof parsed.distinctivenessScore === 'number' ? parsed.distinctivenessScore : undefined,
    riskMitigationPlans: Array.isArray(parsed.riskMitigationPlans) && parsed.riskMitigationPlans.length > 0
      ? parsed.riskMitigationPlans.map((p: any) => ({
          risk: p.risk || '',
          likelihood: p.likelihood || 'orta',
          impact: p.impact || 'orta',
          mitigation: p.mitigation || '',
          earlyWarning: p.earlyWarning || '',
        }))
      : undefined,
  };
}
