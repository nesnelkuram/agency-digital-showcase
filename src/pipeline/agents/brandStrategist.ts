import { generateJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput } from '../types';

export async function runBrandStrategist(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null
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
  const hasResearch = researchFindings && researchFindings.sourcesUsed > 0;
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

  const prompt = `Sen deneyimli bir marka stratejistisin. Asagidaki veriyi analiz ederek markanin konumlandirilmasi icin detayli ve KANIT TABANLI bir strateji olustur.

## Isletme Profili
- Isletme: ${normalizedData.businessName}
- Sektor: ${normalizedData.sector}
- Genel Profil: ${normalizedData.overallProfile}

## Yapilandirilmis Cevaplar
${answersSummary || 'Cevap bilgisi mevcut degil'}

## Tespit Edilen Oruntular
${normalizedData.detectedPatterns.map((p) => `- ${p}`).join('\n') || 'Oruntu tespit edilmedi'}

## Celiskiler
${normalizedData.contradictions.length > 0 ? normalizedData.contradictions.map((c) => `- ${c}`).join('\n') : 'Celiski tespit edilmedi'}

## Veri Kalitesi: ${normalizedData.dataQualityScore}
${researchContext}
---

Yukaridaki tum verileri analiz ederek asagidaki JSON yapisinda bir marka stratejisi olustur:

{
  "archetype": "Jung arketiplerinden en uygun olan (Turkce: Bakim Veren, Yaratici, Bilge, Kahraman, Asi, Sihirbaz, Asik, Soytari, Masum, Kasif, Kral, Siradan Adam)",
  "archetypeRationale": "Bu arketype neden secildiginin KANITLARLA aciklamasi. Hangi wizard cevaplari, hangi sektor verileri, hangi rakip konumlandirmalari bu secimi destekliyor? (3-5 cumle, somut referanslarla)",
  "traits": ["Markanin 3-5 temel kisilik ozelligi. Her biri SEKTORE OZGU ve OLCULEBILIR olmali. 'Yenilikci' gibi genel sifatlar YASAK."],
  "tone": "Markanin iletisim tonu. ORNEK CUMLE ile goster: 'Sicak ve samimi — ornegin: Hosgeldiniz! Sizin icin en iyisini bulmaya haziriz.'",
  "voice": "Markanin sesi. ORNEK CUMLE ile goster: 'Bilgili ama ukala olmayan — ornegin: Bu konuda sunu bilmeniz faydali olur...'",
  "positioningStatement": "Markanin konumlandirma cumlesi. FORMAT: '[Hedef kitle] icin [fark yaratan ozellik] sunan [marka] dir.' — SOMUT ve OLCULEBILIR olacak. (1-2 cumle)",
  "targetAudience": {
    "primaryPersona": {
      "name": "Turkce bir isim, yas ve sehir. Ornek: 'Ayse, 32, Istanbul Kadikoy'",
      "demographics": "Yas, cinsiyet, gelir duzeyi, egitim, meslek, lokasyon — SOMUT rakamlarla",
      "psychographics": "Degerleri, yasam tarzi, motivasyonlari — sektore ozgu detaylarla",
      "painPoints": ["Bu kisinin en buyuk 2-3 sikayeti/ihtiyaci — sektore ozgu, gercekci"],
      "mediaHabits": "Hangi sosyal medya platformlarini, ne siklikla, ne icin kullaniyor",
      "decisionDrivers": ["Satin alma kararini etkileyen 2-3 faktor — fiyat, kalite, kolaylik vb."]
    },
    "secondaryPersona": {
      "name": "Farkli bir profil — ornek: 'Mehmet, 45, Ankara Cankaya'",
      "demographics": "...",
      "psychographics": "...",
      "painPoints": ["..."],
      "mediaHabits": "...",
      "decisionDrivers": ["..."]
    },
    "marketSizeEstimate": "Bu hedef kitlenin Turkiye'deki tahmini buyuklugu (kisi sayisi veya hanehalki)"
  },
  "differentiator": "Markayi rakiplerinden ayiran temel fark. SOMUT ve OLCULEBILIR: 'X rakibinin sunmadigi Y hizmetini sunuyoruz' gibi. (1-2 cumle)",
  "competitiveAdvantage": "Markanin rekabet avantaji. Neden musteriler X, Y, Z yerine bu markayi secmeli? SOMUT kanit ile. (1-2 cumle)",
  "competitiveMap": [
${competitiveMapSchema}
  ]
}

KRITIK KURALLAR:
1. KANIT ZORUNLULUGU: Her iddia icin kaynak goster. "Premium" diyorsan wizard cevabi veya sektor verisinden NEDEN premium oldugunu acikla. Kanitlanmayan iddia = BASARISIZ rapor.
2. BOS LAF YASAK: "Yenilikci ve dinamik", "kaliteli ve guvenilir", "musteri odakli" gibi HER MARKAYA soylenebilecek sifatlar YASAK. "${normalizedData.businessName}'in [somut ozelliginden] kaynaklanan [somut avantaj]" gibi SPESIFIK ol.
3. PERSONA SOMUTLUGU: "Genc profesyoneller" veya "orta-ust gelir grubu" gibi GENEL ifadeler YASAK. Isim, yas, sehir, gelir rakamı, somut aliskanlik — bir insan gibi tanimla.
4. "competitiveMap" alaninda arastirmada bulunan HER rakip icin somut avantaj/dezavantaj belirt. Yoksa en az 2 rakip tanimla.
5. "archetypeRationale" alaninda hangi wizard cevaplari (soru ID veya icerik) ve hangi sektor verileri bu secimi destekledigini ACIKCA belirt.
6. "tone" ve "voice" alanlarinda ORNEK CUMLE ver — soyut tanimlama yerine gercek bir cumle yaz.
7. ${hasResearch ? 'Sektor arastirmasi bulgularini TUM alanlarda referans olarak kullan. Rakip isimlerini DOGRUDAN kullan.' : 'Sektor arastirmasi mevcut degil, wizard verilerinden yola cikarak en somut stratejiyi olustur. Genel sifatlardan kacin.'}
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<StrategistOutput>('pro', prompt, 'BrandStrategist', {
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  // Validate and provide fallbacks for required fields
  const defaultPersona = {
    name: 'Belirtilmedi',
    demographics: 'Belirtilmedi',
    psychographics: 'Belirtilmedi',
    painPoints: ['Belirtilmedi'],
    mediaHabits: 'Belirtilmedi',
    decisionDrivers: ['Belirtilmedi'],
  };

  return {
    archetype: parsed.archetype || 'Yaratici',
    archetypeRationale: parsed.archetypeRationale || 'Arketip secimi mevcut verilerle belirlenmistir.',
    traits: Array.isArray(parsed.traits) && parsed.traits.length > 0 ? parsed.traits : ['Sektore ozgu ozellik belirlenemedi'],
    tone: parsed.tone || 'Profesyonel ve samimi',
    voice: parsed.voice || 'Bilgili ve ulasılabilir',
    positioningStatement: parsed.positioningStatement || `${normalizedData.businessName}, ${normalizedData.sector} sektorunde fark yaratan bir markadir.`,
    targetAudience: {
      primaryPersona: parsed.targetAudience?.primaryPersona
        ? { ...defaultPersona, ...parsed.targetAudience.primaryPersona }
        : defaultPersona,
      secondaryPersona: parsed.targetAudience?.secondaryPersona
        ? { ...defaultPersona, ...parsed.targetAudience.secondaryPersona }
        : defaultPersona,
      marketSizeEstimate: parsed.targetAudience?.marketSizeEstimate || 'Tahmin mevcut degil',
    },
    differentiator: parsed.differentiator || 'Farklilik bilgisi belirlenememistir.',
    competitiveAdvantage: parsed.competitiveAdvantage || 'Rekabet avantaji bilgisi belirlenememistir.',
    competitiveMap: Array.isArray(parsed.competitiveMap) && parsed.competitiveMap.length > 0
      ? parsed.competitiveMap
      : [],
  };
}
