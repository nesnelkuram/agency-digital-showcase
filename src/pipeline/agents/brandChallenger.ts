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
    Guclu: ${(c.strengths || []).join(', ')} | Zayif: ${(c.weaknesses || []).join(', ')}`)
      .join('\n');

    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;

    researchContext = `
## Sektor Arastirmasi Verileri

### Rakipler (Dogrulanmis)
${competitorSummary || 'Bilgi yok'}

### Pazar Verileri
- Pazar Buyuklugu: ${marketInfo?.marketSize || 'Bilgi yok'}
- Buyume Hizi: ${marketInfo?.growthRate || 'Bilgi yok'}
- Tuketici Trendleri: ${marketInfo?.consumerTrends?.join('; ') || 'Bilgi yok'}

### Hedef Kitle Verileri
- Demografi: ${audience?.demographics || 'Bilgi yok'}
- Acil Ihtiyaclar: ${audience?.painPoints?.join('; ') || 'Bilgi yok'}
- Satin Alma: ${audience?.purchaseBehavior || 'Bilgi yok'}

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
- Faktörler: İşletme Yaşı=${maturity.factors?.businessAge ?? 'N/A'}, Marka Varlıkları=${maturity.factors?.brandAssets ?? 'N/A'}, Dijital Varlık=${maturity.factors?.digitalPresence ?? 'N/A'}, Kitle Büyüklüğü=${maturity.factors?.audienceSize ?? 'N/A'}
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

  const prompt = `Sen bu analiz pipeline'inin brandChallenger (Strateji Eleştirmeni ve Şeytan Avukatı) ajanısın.
Felsefen Harry Dry (Marketing Examples) ekolüne dayanır:
- İnsanlar ürünleri değil, acı noktalarının (pain points) çözülmesini satın alırlar.
- "Zeki (clever)" olmaya çalışma, "Net (clear)" ol.
- Soyut kelimeler satmaz, somut vaatler satar. Sıfatları öldür, fiilleri kullan.

Görevin: brandStrategist'in ürettiği stratejiyi üç acımasız teste tabi tutmak, pazarlama klişelerini avlamak ve strateji strategySynthesizer aşamasına geçmeden ayaklarının yere basmasını sağlamak.

## 🛑 KIRMIZI ÇİZGİLER (Bunları içeren her stratejiyi anında eleştir):
1. ROMANTİK KLİŞELER: "Sanat, ruh, tutku, büyü, rüya, hayal, ilham, estetik yolculuk..." — Müşteriler şantiyede sanat değil, zamanında biten sorunsuz montaj arar.
2. ALTI BOŞ JENERİK SIFATLAR: "Yenilikçi, dinamik, kaliteli, lider, en iyi, premium deneyim, benzersiz..." — Kanıtı olmayan hiçbir sıfatı kabul etme.
3. ÜRÜN ODAKLILIK: Müşterinin ne alacağını (örn. 5mm LVT parke) anlatan stratejiler yerine müşterinin ne hissedeceğini ve hangi dertten kurtulacağını (örn. çizilmeyen zemin, ustalarla uğraşmama rahatlığı) anlatacak şekilde düzeltmeye zorla.

---

## İşletme Bilgileri
- İşletme: ${normalizedData.businessName}
- Sektör: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}${maturityContext}${deepContext}${adminNotesContext}

## Önerilen Strateji (Strateji Uzmanı Çıktısı)
- Arketip: ${strategistOutput.archetype}
- Arketip Gerekçe: ${strategistOutput.archetypeRationale}
- Kişilik Özellikleri: ${strategistOutput.traits.join(', ')}
- İletişim Tonu: ${strategistOutput.tone}
- Marka Sesi: ${strategistOutput.voice}
- Konumlandırma: ${strategistOutput.positioningStatement}
- Hedef Kitle: ${targetAudienceSummary}${vpSummary}
- Farklılık: ${strategistOutput.differentiator}
- Rekabet Avantajı: ${strategistOutput.competitiveAdvantage}
${strategistOutput.brandEnemy ? `- Marka Düşmanı: ${strategistOutput.brandEnemy}` : ''}
${strategistOutput.transformationStatement ? `- Dönüşüm İfadesi: ${strategistOutput.transformationStatement}` : ''}
${strategistOutput.believeReject ? `- İnanışlar: ${strategistOutput.believeReject.believe?.join('; ')}\n- Redler: ${strategistOutput.believeReject.reject?.join('; ')}` : ''}
${strategistOutput.customerProblem ? `- Müşteri Problemi (Dış): ${strategistOutput.customerProblem.external}\n- Müşteri Problemi (İç): ${strategistOutput.customerProblem.internal}\n- Müşteri Problemi (Felsefi): ${strategistOutput.customerProblem.philosophical}` : ''}

## Normalize Edilmiş Veri
### Tespit Edilen Örüntüler
${normalizedData.detectedPatterns.map((p) => `- ${p}`).join('\n') || 'Örüntü yok'}
### Çelişkiler
${normalizedData.contradictions.length > 0 ? normalizedData.contradictions.map((c) => `- ${c}`).join('\n') : 'Çelişki yok'}
### Veri Kalitesi: ${normalizedData.dataQualityScore}
${researchContext}
---

## 🔍 UYGULANMASI GEREKEN 3 ACIMASIZ TEST:

**TEST 1 — The "Onlyness" (Teklik) Testi:**
Stratejistin "Konumlandırma" cümlesini al. Marka adını çıkarıp en büyük rakibinin adını koy.
Eğer cümle hâlâ mantıklı ve doğru geliyorsa → o strateji ÇÖPTÜR.
Markaya ait gerçek farklılaşma bulana kadar eleştir. "onlynessTest.verdict" alanına yansıt.

**TEST 2 — Acı Noktası (Pain-Point) Testi:**
Strateji müşterinin gerçek dünyadaki rasyonel acısını (zaman kaybı, gizli maliyet, bozuk ürün, usta stresi) çözüyor mu?
Yoksa sadece "güzel görünmeyi" mi vaat ediyor? Sadece estetik vaat ediyorsa → "ruthlessFeedback"e "Operasyonel Gerçeklik" eleştirisi yaz.

**TEST 3 — Operasyonel Çelişki Testi:**
Markanın fiziksel kapasitesiyle (bayi ağı sayısı, üretim kapasitesi, ekip büyüklüğü) stratejistin vaadi çelişiyor mu?
"Bayi ağı üzerinden bu lüks standart nasıl korunacak?" gibi zor soruları masaya yatır. "operationalContradictions" alanına yaz.

---

Yukarıdaki stratejiyi eleştirel gözle inceleyerek şu JSON yapısında karşı-analiz oluştur:

{
  "counterPosition": "Önerilen stratejiye SOMUT VE KANITLI karşı-pozisyon. Hangi SEKTÖR VERİSİ veya RAKİP BİLGİSİ stratejinin zayıf noktasını gösteriyor? (2-3 cümle, referanslarla)",
  "alternativeArchetype": "Alternatif bir Jung arketipi önerisi (Türkçe)",
  "alternativeArchetypeRationale": "Neden bu alternatif arktipin DAHA UYGUN olabileceğinin KANITLI açıklaması. (2-3 cümle)",
  "challengePoints": [
    "ELEŞTİRİ 1: Somut sorun + KANIT (pazar odaklı). Ör: 'Stratejist premium konumlanma öneriyor, ancak [rakip X] zaten premium segmentte — bu segment doymuş.'",
    "ELEŞTİRİ 2: Farklı alana odaklanan somut sorun + kanıt (hedef kitle odaklı).",
    "ELEŞTİRİ 3: Uygulama riskleri veya gözden kaçırılan faktör (operasyonel odaklı)."
  ],
  "alternativePositionings": [
    "ALTERNATİF 1: Hangi rakibin hangi acığını kullanarak ne tarz konumlandırma yapılabilir? (1-2 cümle)",
    "ALTERNATİF 2: Farklı bir hedef kitleye veya segmente yönelik alternatif. (1-2 cümle)"
  ],
  "riskAssessment": "Önerilen stratejinin uygulanması halinde ortaya çıkabilecek SOMUT riskler. (2-3 cümle)",
  "blindSpots": [
    "KÖR NOKTA 1: Araştırma verilerinde gözüken ama stratejistin GÖRMEZDEN GELDİĞİ trend/tehdit. 'Bilerek mi öncelenilmedi?' sorusunun cevabıyla birlikte.",
    "KÖR NOKTA 2: Eksik bırakılmış önemli bir faktör."
  ],
  "onlynessTest": {
    "statement": "[Marka] [kategoride] [fark] sunan TEK markadır — KİM İÇİN: [hedef kitle], NASIL KANITLANIR: [kanıt]",
    "competitorSwaps": [
      { "competitor": "Rakip 1 adı", "stillValid": true, "reason": "Bu cümle rakip için de geçerli mi, neden?" },
      { "competitor": "Rakip 2 adı", "stillValid": false, "reason": "..." }
    ],
    "verdict": "strong / weak / generic"
  },
  "distinctivenessScore": 0,
  "identifiedCliches": [
    "Stratejide tespit edilen klişe/romantik/jenerik kelime veya ifade — (ör: 'kaliteli hizmet', 'lider firma', 'sanat ve tutku')"
  ],
  "ruthlessFeedback": "Harry Dry tonunda, acımasız ama yapıcı, NET eleştiri metni. Ne yanlış, neden yanlış, nasıl düzeltilmeli? Soyut laflardan kaçın, fiil kullan. (3-5 cümle)",
  "operationalContradictions": [
    "Markanın mevcut fiziksel/operasyonel durumu ile vaat edilen strateji arasındaki uçurumlar. Ör: '135 bayide şeffaf fiyatlandırmayı nasıl kontrol edeceksin?'"
  ],
  "challengerAlternatives": [
    "Klişelerden arındırılmış, doğrudan acı noktasına vuran, SOMUT ve RASYONELalternatif konumlandırma önerisi 1.",
    "Alternatif konumlandırma önerisi 2."
  ],
  "riskMitigationPlans": [
    {
      "risk": "Tespit edilen SOMUT risk",
      "likelihood": "yuksek/orta/dusuk",
      "likelihoodScore": 0.0,
      "impact": "yuksek/orta/dusuk",
      "impactScore": 1,
      "expectedValue": 0.0,
      "mitigation": "Bu riski azaltmak için SOMUT strateji",
      "earlyWarning": "Bu riskin gerçekleşmeye başladığını gösteren erken sinyal"
    }
  ]
}

KRİTİK KURALLAR:
1. ELEŞTİRİLER YAPICI OLMALI — amaç stratejiyi GELİŞTİRMEK, çökertmek değil.
2. HER eleştiri KANIT içermeli: sektör verisi, rakip örneği, tüketici trendi veya anket cevabı referans gösterilmeli. KANITSIZ eleştiri = BAŞARISIZ rapor.
3. "challengePoints" 3-5 adet, her biri FARKLI alana odaklanmalı: pazar, hedef kitle, rekabet, uygulama, iletişim.
4. "alternativePositionings" 2-3 adet, her biri SOMUT rakibin SOMUT acığını kullanmalı.
5. "identifiedCliches": Stratejistin kullandığı romantic/jenerik kelime ve ifadeleri listele. KIRMIZI ÇİZGİ kategorilerinden geçir. Boş dizi döndürme — en az 1 klişe bul ya da "Klişe tespit edilmedi, strateji spesifik" de.
6. "ruthlessFeedback": Pain-point testini geç, geçemezse açıkça söyle. Soyut vaat mı, somut çözüm mü? Harry Dry gibi yaz: kısa, net, fiil ağırlıklı.
7. "operationalContradictions": Marka kapasitesini (bilinen bayi/ekip/üretim ölçeği) stratejinin vaatleriyle karşılaştır. Veri yoksa "(kapasite verisi yok — varsayım)" yaz.
8. "challengerAlternatives": Bu iki alternatif, strategySynthesizer'ın seçim yapabileceği kalitede olmalı. Klişesiz, acı noktasına vuran, rakip boşluğuna dayalı.
9. "distinctivenessScore": 0-100. Onlyness testi geçti ve identifiedCliches boşsa → 70+. Generic verdict aldıysa → 30 altı.
10. GROUNDING KONTROLÜ: Araştırma verisinde doğrudan kanıtı OLMAYAN iddialara "(araştırmada doğrudan kanıt bulunamadı — sektör genel bilgisi)" ekle.
11. OLGUNLUK KALİBRASYONU: ${maturity ? `Bu işletme "${maturity.level}" seviyesinde (${maturity.score}/12).` : 'Olgunluk verisi mevcut değil.'}
   - pre_brand: Temel kimlik önerilerine odaklan. Fazla sofistike strateji eleştir.
   - emerging: Dijital varlık yokken premium konumlanma öneriliyorsa sorgula.
   - developing: Alternatif konumlandırmalar SOMUT rakip açıklarıyla desteklenmeli.
   - mature: Büyüme ve sadakat stratejilerini sorgula. Marka genişlemesi risklerini değerlendir.
12. WHY KONTROLÜ: ${businessContext?.brandWhy ? `İşletmenin varoluş amacı: "${businessContext.brandWhy}". Strateji bu WHY ile tutarlı mı? Tutarsızlık varsa açıkça belirt.` : 'Varoluş amacı (WHY) bilgisi yok — arketip seçiminin temelsiz olma riskini belirt.'}
13. MÜŞTERİ ALGISI KONTROLÜ: ${businessContext?.customerPerception ? `Müşteri gözünden gerçek algı: "${businessContext.customerPerception}". Strateji ile gerçek müşteri algısı arasında fark var mı?` : 'Müşteri algısı verisi yok — stratejistin önerisinin gerçek müşteri deneyimiyle doğrulanmadığını belirt.'}
14. VİZYON UYUMU: ${businessContext?.futureVision ? `3 yıllık vizyon: "${businessContext.futureVision}". Önerilen strateji bu vizyona giden yolda mı?` : ''}
15. KANTİTATİF RİSK MATRİSİ: riskMitigationPlans'daki her risk için likelihoodScore (0-1) ve impactScore (1-10) SAYISAL değer ver. expectedValue = likelihoodScore × impactScore. Riskler expectedValue'ya göre BÜYÜKTEN KÜÇÜĞE sıralanmalı. EN AZ 3 risk planı.
16. ${hasResearch ? 'Sektör araştırması bulgularını DOĞRUDAN referans göster. Rakip isimlerini kullan.' : 'Sektör araştırması mevcut değil — genel sektör bilginle somut eleştiriler sun.'}
17. Tüm metinler TÜRKÇE olmali. Sadece JSON dön, başka bir şey yazma.`;

  const parsed = await generateJSON<ChallengerOutput>('pro', prompt, 'BrandChallenger', {
    temperature: 0.8,
    maxOutputTokens: 8192,
  });

  // Validate and provide fallbacks
  return {
    counterPosition: parsed.counterPosition || 'Strateji genel olarak tutarlı, ancak alternatif bakış açıları dikkate alınmalı.',
    alternativeArchetype: parsed.alternativeArchetype || 'Bilge',
    alternativeArchetypeRationale: parsed.alternativeArchetypeRationale || 'Alternatif arketip değerlendirmesi mevcut verilerle sınırlıdır.',
    challengePoints: Array.isArray(parsed.challengePoints) && parsed.challengePoints.length > 0
      ? parsed.challengePoints
      : ['Hedef kitle tanımı daraltılmalı', 'Rekabet avantajı somut hale getirilmeli', 'Uygulama planı detaylandırılmalı'],
    alternativePositionings: Array.isArray(parsed.alternativePositionings) && parsed.alternativePositionings.length > 0
      ? parsed.alternativePositionings
      : ['Alternatif konumlandırma belirlenememiştir'],
    riskAssessment: parsed.riskAssessment || 'Risk değerlendirmesi için daha fazla veri gerekmektedir.',
    blindSpots: Array.isArray(parsed.blindSpots) && parsed.blindSpots.length > 0
      ? parsed.blindSpots
      : ['Dijital dönüşüm süreci yeterince ele alınmamış olabilir'],
    // Onlyness testi + kalite
    onlynessTest: parsed.onlynessTest || undefined,
    distinctivenessScore: typeof parsed.distinctivenessScore === 'number' ? parsed.distinctivenessScore : undefined,
    riskMitigationPlans: Array.isArray(parsed.riskMitigationPlans) && parsed.riskMitigationPlans.length > 0
      ? parsed.riskMitigationPlans.map((p: any) => ({
          risk: p.risk || '',
          likelihood: p.likelihood || 'orta',
          likelihoodScore: typeof p.likelihoodScore === 'number' ? Math.max(0, Math.min(1, p.likelihoodScore)) : undefined,
          impact: p.impact || 'orta',
          impactScore: typeof p.impactScore === 'number' ? Math.max(1, Math.min(10, p.impactScore)) : undefined,
          expectedValue: (typeof p.likelihoodScore === 'number' && typeof p.impactScore === 'number')
            ? Math.round(p.likelihoodScore * p.impactScore * 100) / 100
            : undefined,
          mitigation: p.mitigation || '',
          earlyWarning: p.earlyWarning || '',
        }))
      : undefined,
    // Harry Dry Ekolu
    identifiedCliches: Array.isArray(parsed.identifiedCliches) ? parsed.identifiedCliches : [],
    ruthlessFeedback: parsed.ruthlessFeedback || undefined,
    operationalContradictions: Array.isArray(parsed.operationalContradictions) && parsed.operationalContradictions.length > 0
      ? parsed.operationalContradictions
      : undefined,
    challengerAlternatives: Array.isArray(parsed.challengerAlternatives) && parsed.challengerAlternatives.length > 0
      ? parsed.challengerAlternatives
      : undefined,
  };
}
