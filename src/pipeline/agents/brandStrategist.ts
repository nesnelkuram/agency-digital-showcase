import { generateJSON } from '../geminiClient';
import { getSectorEnrichment } from '../sectorEnrichment';
import type { NormalizedData, ResearchFindings, StrategistOutput, BusinessContextInput } from '../types';

export async function runBrandStrategist(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  businessContext?: BusinessContextInput,
  adminNotes?: string
): Promise<StrategistOutput> {

  // Build structured answers summary
  const answersSummary = normalizedData.structuredAnswers
    .map((stage) => {
      const questions = stage.questions
        .map((q) => `  - ${q.question}: ${q.answerLabel}${q.score !== undefined ? ` (Skor: ${q.score})` : ''}`)
        .join('\n');
      return `### ${stage.stage}. ${stage.stageName}\n${questions}`;
    })
    .join('\n\n');

  // Build rich research context (if available)
  let researchContext = '';
  const hasResearch = researchFindings && researchFindings.sourcesUsed !== 0;
  if (hasResearch) {
    const competitorSummary = researchFindings.competitors
      .map((c) => `  - ${c.name}${c.website ? ` (${c.website})` : ''}: ${c.positioning}
    Olcek: ${c.estimatedScale || 'Bilinmiyor'} | Sosyal: ${c.socialPresence || 'Bilinmiyor'}
    Guclu: ${c.strengths.join(', ')} | Zayif: ${c.weaknesses.join(', ')}`)
      .join('\n');

    const marketInfo = researchFindings.marketData;
    const audience = researchFindings.targetAudienceInsights;

    researchContext = `
## Sektor Arastirmasi Bulgulari (Gercek Web Verileri)

### Rakipler
${competitorSummary || 'Rakip bilgisi bulunamadi'}

### Pazar Verileri
- Pazar Buyuklugu: ${marketInfo.marketSize}
- Buyume Hizi: ${marketInfo.growthRate}
- Anahtar Oyuncular: ${marketInfo.keyPlayers.join(', ') || 'Bilinmiyor'}
- Tuketici Trendleri: ${marketInfo.consumerTrends.join('; ') || 'Bilinmiyor'}

### Hedef Kitle Insight'lari (Arastirma Verisi)
- Demografi: ${audience.demographics}
- Psikografi: ${audience.psychographics}
- Acil Ihtiyaclar: ${audience.painPoints.join('; ') || 'Bilinmiyor'}
- Satin Alma Davranisi: ${audience.purchaseBehavior}

### Firsatlar
${researchFindings.opportunities.map((o) => `- ${o}`).join('\n') || 'Bilgi yok'}

### Tehditler
${researchFindings.threats.map((t) => `- ${t}`).join('\n') || 'Bilgi yok'}
`;
  }

  // Build competitive map JSON schema based on actual competitors
  const competitorNames = hasResearch
    ? researchFindings.competitors.map((c) => c.name)
    : [];
  const competitiveMapSchema = competitorNames.length > 0
    ? competitorNames.map((name) => `    { "competitorName": "${name}", "theirPosition": "...", "ourAdvantage": "...", "ourWeakness": "..." }`).join(',\n')
    : `    { "competitorName": "Rakip Adi", "theirPosition": "...", "ourAdvantage": "...", "ourWeakness": "..." }`;

  // Build business context section
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
${bc.customerPerception ? `- Müşteri Algısı (kendi sözleriyle): ${bc.customerPerception}` : ''}
${bc.existingBrandAssets ? `- Mevcut Marka Varlıkları: ${bc.existingBrandAssets}` : ''}
${bc.futureVision ? `- 3 Yıllık Vizyon: ${bc.futureVision}` : ''}
`
    : '';

  // Brand maturity context for conditional prompt behavior
  const maturity = normalizedData.brandMaturity;
  const maturityInstruction = maturity
    ? `\n14. MARKA OLGUNLUK SEVIYESI: Bu isletme "${maturity.level}" seviyesinde (skor: ${maturity.score}/12). Rapor odagi: "${maturity.reportFocus}".
${maturity.level === 'pre_brand' ? '- PRE-BRAND: Temel marka kimligi olusturmaya odaklan. Hashtag, content pillar gibi ileri seviye oneriler YAPMA. Once logo, renk, ton belirlenmeli.' : ''}
${maturity.level === 'emerging' ? '- EMERGING: Kimlik guclendirme + temel strateji. Dijital varlik sifirdan olusturulabilir.' : ''}
${maturity.level === 'developing' ? '- DEVELOPING: Strateji optimizasyonu. Mevcut varliklari optimize et, yeni kanallar oner.' : ''}
${maturity.level === 'mature' ? '- MATURE: Buyume ve sadakat odakli strateji. Premium konumlandirma, marka genisletme, komunite olusturma.' : ''}`
    : '';

  // Budget-aware pricing instruction
  const budgetInstruction = bc?.monthlyBudget
    ? `\n12. BUTCE UYUMU: Musterinin aylik butcesi "${bc.monthlyBudget}" olarak belirtilmis. valuePropositionReasoning.pricePositioning alaninda bu butceyi dikkate al. Isletmenin olcegine uygun fiyat konumlandirmasi yap.`
    : '';

  // Stage-aware instruction
  const stageInstruction = bc?.businessStage
    ? `\n13. ISLETME ASAMASI: Isletme "${bc.businessStage}" asamasinda. Buna gore strateji onerileri kalibre et — yeni isletme icin marka bilinirligine, yerlesik isletme icin pazar payi buyutmeye odaklan.`
    : '';

  // Admin notes — critical expert override
  const adminNotesSection = adminNotes?.trim()
    ? `\n\n⚠️ KRITIK ADMIN NOTU — ZORUNLU BAGLAMSAL BILGI:\n${adminNotes.trim()}\nBu notu yazan uzman, isletmeyi yakindan taniyor. Stratejini bu bilgiye UYGUN olustur. Bu notla CELISEN varsayimlar veya cikarimlar YAPMA. Ozellikle isletmenin faaliyet alani, sektoru veya konumlandirmasi hakkinda bu notla celisen bir yorum KESINLIKLE uretme.\n`
    : '';

  // JTBD + StoryBrand context from business context
  const customerContext = bc ? `
${bc.customerJob ? `- Müşterinin Kiraladığı İş (JTBD): ${bc.customerJob}` : ''}
${bc.customerStruggle ? `- Müşterinin Mücadelesi: ${bc.customerStruggle}` : ''}
${bc.brandEnemy ? `- Sektördeki Düşman/Karşı Olunan: ${bc.brandEnemy}` : ''}
${bc.alternativeToUs ? `- Biz Olmasaydık Müşteri Ne Yapardı: ${bc.alternativeToUs}` : ''}` : '';

  // Sector-specific cultural tensions (hardcoded, zero hallucination)
  const sectorEnrichment = getSectorEnrichment(normalizedData.sector);
  const culturalTensionsContext = sectorEnrichment?.culturalTensions?.length
    ? `\n## Sektörel Kültürel Gerilimler (Kanıta Dayalı)
Bu sektörde bilinen kültürel gerilimler — bunlardan EN AZ BİRİNİ culturalTension çıktısında kullan veya bunlardan ilham alarak işletmeye özel bir gerilim tanımla:
${sectorEnrichment.culturalTensions.map((ct, i) => `${i + 1}. BEKLENTİ: "${ct.expectation}" → GERÇEKLİK: "${ct.reality}" → FIRSAT: "${ct.opportunity}"`).join('\n')}\n`
    : '';

  const prompt = `Sen dunyanin en iyi marka stratejistlerinden birisin. Senden istenen bir form doldurmak DEGIL — gercek bir stratejik DUSUNME sureci yurutmek.

## ADIM 1: ONCE DUSUN — Musterinin Dunyasini Anla

Verileri okumadan once su sorulari cevapla:
- Bu isletmenin musterisi hayatinda ne ile mucadele ediyor?
- Bu musterinin DIS problemi (somut sorun), IC problemi (hissettikleri) ve FELSEFI problemi ("bu boyle olmamali") nedir?
- Musteri bu markaya "hangi ISI yapmasi icin" basvuruyor? (Jobs-to-be-Done)
- Bu marka olmasaydi, musteri ne yapardi? (Gercek alternatifler)
- Bu sektorde herkesin soyledigi ama kimsenin yapmadigi sey ne? (Kulturel gerilim)
- Bu marka neye KARSI? Dusmani kim/ne? (Statukonun hangi parcasi?)

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}
${businessContextSection}${adminNotesSection}${customerContext}
## Yapilandirilmis Cevaplar
${answersSummary || 'Cevap bilgisi mevcut degil'}

## Tespit Edilen Oruntular
${normalizedData.detectedPatterns.map((p) => `- ${p}`).join('\n') || 'Oruntu tespit edilmedi'}

## Celiskiler
${normalizedData.contradictions.length > 0 ? normalizedData.contradictions.map((c) => `- ${c}`).join('\n') : 'Celiski tespit edilmedi'}

## Veri Kalitesi: ${normalizedData.dataQualityScore}
${researchContext}${culturalTensionsContext}
---

## ADIM 2: STRATEJI URET

Dusunme surecine dayanarak asagidaki JSON yapisinda strateji olustur:

{
  "archetype": "Jung arketiplerinden en uygun olan (Turkce). Bu etiket DAHILI referans olarak kullanilir, raporun ana ciktisi DEGILDIR.",
  "archetypeRationale": "KANITLARLA aciklama — hangi wizard cevaplari, hangi sektor verileri bu secimi destekliyor? (3-5 cumle)",
  "traits": ["3-5 kisilik ozelligi. DAVRANISSAL CUMLE olarak yaz, tek kelime YASAK. Ornek: 'Konforlu olmaktansa dogru olmayi tercih eder' yerine 'Yenilikci' YAZMA."],
  "tone": "ORNEK CUMLE ile goster: 'Sicak ve samimi — ornegin: Hosgeldiniz! Sizin icin en iyisini bulmaya haziriz.'",
  "voice": "ORNEK CUMLE ile goster: 'Bilgili ama ukala olmayan — ornegin: Bu konuda sunu bilmeniz faydali olur...'",
  "positioningStatement": "[Hedef kitle] icin [fark] sunan [marka] dir. SOMUT ve OLCULEBILIR. (1-2 cumle)",
  "valuePropositionReasoning": {
    "whatBusinessProduces": "SOMUT urun/hizmet listesi.",
    "coreBenefit": "TEMEL fayda — tek cumle.",
    "whoBenefits": "DAVRANISSAL tanimla.",
    "pricePositioning": "RAKAMLARLA: 'Orta-ust: 400g 89 TL — Nutella 59 TL, Nusret 129 TL'",
    "willingToPayProfile": "Gelir seviyesi, harcama aliskanligi."
  },
  "targetAudience": {
    "primarySegment": {
      "segmentLabel": "Birincil Segment",
      "demographics": "Yas ARALIGI, lokasyon tipi, meslek GRUBU, gelir ARALIGI",
      "behavioralProfile": "SOMUT tuketim davranislari",
      "coreNeed": "Bu segmentin BU ISLETMEDEN beklentisi",
      "mediaHabits": "Platformlar + siklik",
      "purchaseTriggers": ["3-5 SPESIFIK tetikleyici"],
      "estimatedSegmentSize": "KAYNAK belirt"
    },
    "secondarySegment": { "segmentLabel": "Ikincil Segment", "demographics": "...", "behavioralProfile": "...", "coreNeed": "...", "mediaHabits": "...", "purchaseTriggers": ["..."], "estimatedSegmentSize": "..." },
    "marketSizeEstimate": "TAM ve SAM tahmini"
  },
  "differentiator": "SOMUT ve OLCULEBILIR fark — 'X rakibinin sunmadigi Y'. (1-2 cumle)",
  "competitiveAdvantage": "Neden musteriler X, Y, Z yerine bu markayi secmeli? SOMUT kanit. (1-2 cumle)",
  "competitiveMap": [
${competitiveMapSchema}
  ],
  "personalitySliders": {
    "friendAuthority": 50,
    "youngMature": 50,
    "playfulSerious": 50,
    "massElite": 50
  },
  "brandEnemy": "Bu markanin KARSI DURDUGU guc. Rakip degil — sektordeki kotu aliskanlik, statukonun yanlis parcasi, musterinin mucadele ettigi guc. Ornek: 'Standartlastirilmis, ruhsuz konaklama deneyimi' veya 'Musterinin uzman olmadigi konularda yalniz birakilmasi'",
  "believeReject": {
    "believe": ["'Inaniyoruz ki...' — 3 adet. Markanin savundugu ilkeler. Cesur, spesifik, baska markaya ait OLAMAYACAK kadar ozgun."],
    "reject": ["'Reddediyoruz...' — 3 adet. Markanin KARSI OLDUGU seyler. 'Kotu hizmet' gibi bos laflar YASAK — 'Musteriye tek bedene sigar cozum sunmayi reddediyoruz' gibi SPESIFIK."]
  },
  "customerProblem": {
    "external": "Musterinin YUZEYSEL, SOMUT sorunu. Ornek: 'Guvenilir otel bulmak zor'",
    "internal": "Bu sorunun yarattigi DUYGU. Ornek: 'Bilmedigim yerde kandirilacikmisim gibi hissediyorum'",
    "philosophical": "'Bu boyle olmamali' — AHLAKI boyut. Ornek: 'Herkes konforlu ve guvenli seyahat edebilmeli'"
  },
  "transformationStatement": "Musterimiz [X]'dan [Y]'a gecer. MAKSIMUM 12 KELIME. Ornek: 'Arasmadan bunalan yolcu → guvenle rezervasyon yapan gezgin'",
  "valueLevel": "Bu isletme ne satiyor: 'commodity' | 'product' | 'service' | 'experience' | 'transformation'. Emtia=fiyat farki yok, Urun=kalite farki, Hizmet=kolaylik farki, Deneyim=his farki, Donusum=kimlik degisimi."
}

## ADIM 3: DOGRULA

Urettigin stratejiyi su testlerden gecir:
- ANTI-JENERIK TESTI: "traits" ve "positioningStatement" icinde su kelimeler VARSA YENIDEN YAZ: "yenilikci", "tutkulu", "kaliteli", "musteri odakli", "mukemmellik", "lider", "benzersiz", "dinamik", "guvenilir" (baglamsiz kullanildiginda).
- RAKIP SWAP TESTI: positioningStatement'te "${normalizedData.businessName}" yerine en buyuk rapibin adini koy. Hala gecerli mi? Gecerliyse DAHA SPESIFIK yeniden yaz.
- TUTARLILIK TESTI: personalitySliders degerleri, tone, traits, brandEnemy birbiriyle uyumlu mu? "Eglenceli" tone ama "ciddi" slider = tutarsizlik.

KRITIK KURALLAR:
1. KANIT ZORUNLULUGU: Her iddia icin kaynak goster. Kanitlanmayan iddia = BASARISIZ rapor.
2. BOS LAF YASAK: HER MARKAYA soylenebilecek sifatlar YASAK. "${normalizedData.businessName}'e OZGU ol.
3. SEGMENT KURALLARI: Kurgusal karakter YASAK ("Ayse, 32" gibi isim YAZMA). Segmentler DAVRANISSAL. purchaseTriggers SPESIFIK.
4. "competitiveMap"de arastirmada bulunan HER rakip icin somut avantaj/dezavantaj belirt.
5. traits DAVRANISSAL CUMLE formatinda olmali — tek kelime sifat YASAK. "Yenilikci" degil "Her projede alisilmisin disina cikmayi tercih eden, konfor alanindan cikmaktan korkmayan" gibi.
6. "tone" ve "voice"da ORNEK CUMLE ver.
7. ${hasResearch ? 'Sektor arastirmasi bulgularini TUM alanlarda referans olarak kullan. Rakip isimlerini DOGRUDAN kullan.' : 'Sektor arastirmasi mevcut degil, wizard verilerinden yola cikarak en somut stratejiyi olustur.'}
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.
10. personalitySliders: 0-100 arasi. 0=sol uc, 100=sag uc. 50=notr YASAK — bir pozisyon AL. friendAuthority: 0=cok yakin arkadas, 100=sarsılmaz otorite. youngMature: 0=genc ve enerjik, 100=olgun ve deneyimli. playfulSerious: 0=eglenceli ve rahat, 100=ciddi ve resmi. massElite: 0=herkes icin, 100=seckin azinlik icin.
11. brandEnemy RAKIP ISMI OLMAMALI — bir guc, aliskanlik, statukonun parcasi olmali.${budgetInstruction}${stageInstruction}${maturityInstruction}
${bc?.brandWhy ? `\n15. VAROLUS AMACI: "${bc.brandWhy}" — Bu WHY, markanin tum stratejisinin TEMELI. Arketip, ton, dusmanN, inanislar bu amaca UYUMLU olmali.` : ''}
${bc?.customerPerception ? `\n16. MUSTERI ALGISI: "${bc.customerPerception}" — GERCEK veri. Stratejiyi buna dayandirmak en akilli hamle.` : ''}`;

  const parsed = await generateJSON<StrategistOutput>('pro', prompt, 'BrandStrategist', {
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  // Validate and provide fallbacks for required fields
  const defaultSegment = {
    segmentLabel: 'Belirtilmedi',
    demographics: 'Belirtilmedi',
    behavioralProfile: 'Belirtilmedi',
    coreNeed: 'Belirtilmedi',
    mediaHabits: 'Belirtilmedi',
    purchaseTriggers: ['Belirtilmedi'],
    estimatedSegmentSize: 'Belirtilmedi',
  };

  const defaultValuePropReasoning = {
    whatBusinessProduces: 'Belirtilmedi',
    coreBenefit: 'Belirtilmedi',
    whoBenefits: 'Belirtilmedi',
    pricePositioning: 'Belirtilmedi',
    willingToPayProfile: 'Belirtilmedi',
  };

  return {
    archetype: parsed.archetype || 'Yaratici',
    archetypeRationale: parsed.archetypeRationale || 'Arketip secimi mevcut verilerle belirlenmistir.',
    traits: Array.isArray(parsed.traits) && parsed.traits.length > 0 ? parsed.traits : ['Sektore ozgu ozellik belirlenemedi'],
    tone: parsed.tone || 'Profesyonel ve samimi',
    voice: parsed.voice || 'Bilgili ve ulasılabilir',
    positioningStatement: parsed.positioningStatement || `${normalizedData.businessName}, ${normalizedData.sector} sektorunde fark yaratan bir markadir.`,
    valuePropositionReasoning: parsed.valuePropositionReasoning
      ? { ...defaultValuePropReasoning, ...parsed.valuePropositionReasoning }
      : defaultValuePropReasoning,
    targetAudience: {
      primarySegment: parsed.targetAudience?.primarySegment
        ? { ...defaultSegment, ...parsed.targetAudience.primarySegment }
        : defaultSegment,
      secondarySegment: parsed.targetAudience?.secondarySegment
        ? { ...defaultSegment, ...parsed.targetAudience.secondarySegment }
        : defaultSegment,
      marketSizeEstimate: parsed.targetAudience?.marketSizeEstimate || 'Tahmin mevcut degil',
    },
    differentiator: parsed.differentiator || 'Farklilik bilgisi belirlenememistir.',
    competitiveAdvantage: parsed.competitiveAdvantage || 'Rekabet avantaji bilgisi belirlenememistir.',
    competitiveMap: Array.isArray(parsed.competitiveMap) && parsed.competitiveMap.length > 0
      ? parsed.competitiveMap
      : [],
    // Faz 3 — Stratejik derinlik
    personalitySliders: parsed.personalitySliders || undefined,
    brandEnemy: parsed.brandEnemy || undefined,
    believeReject: parsed.believeReject || undefined,
    customerProblem: parsed.customerProblem || undefined,
    transformationStatement: parsed.transformationStatement || undefined,
    valueLevel: parsed.valueLevel || undefined,
  };
}
