import { createGeminiModel, safeParseJSON } from '../geminiClient';
import type { NormalizedData, ResearchFindings, StrategistOutput } from '../types';

export async function runBrandStrategist(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null
): Promise<StrategistOutput> {
  const model = createGeminiModel('pro', {
    temperature: 0.7,
    maxOutputTokens: 3072,
  });

  // Build structured answers summary
  const answersSummary = normalizedData.structuredAnswers
    .map((stage) => {
      const questions = stage.questions
        .map((q) => `  - ${q.question}: ${q.answerLabel}${q.score !== undefined ? ` (Skor: ${q.score})` : ''}`)
        .join('\n');
      return `### ${stage.stage}. ${stage.stageName}\n${questions}`;
    })
    .join('\n\n');

  // Build research context (if available)
  let researchContext = '';
  if (researchFindings && researchFindings.sourcesUsed > 0) {
    const competitorSummary = researchFindings.competitors
      .map((c) => `  - ${c.name}: ${c.positioning} | Guclu: ${c.strengths.join(', ')} | Zayif: ${c.weaknesses.join(', ')}`)
      .join('\n');

    researchContext = `
## Sektor Arastirmasi Bulgulari
### Rakipler
${competitorSummary || 'Rakip bilgisi bulunamadi'}

### Pazar Trendleri
${researchFindings.marketTrends.map((t) => `- ${t}`).join('\n') || 'Trend bilgisi bulunamadi'}

### Firsatlar
${researchFindings.opportunities.map((o) => `- ${o}`).join('\n') || 'Firsat bilgisi bulunamadi'}

### Tehditler
${researchFindings.threats.map((t) => `- ${t}`).join('\n') || 'Tehdit bilgisi bulunamadi'}
`;
  }

  const prompt = `Sen deneyimli bir marka stratejistisin. Asagidaki veriyi analiz ederek markanin konumlandirilmasi icin detayli bir strateji olustur.

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
  "archetypeRationale": "Bu arketype neden secildiginin detayli aciklamasi. Cevaplardan hangi veriler bu secimi destekliyor? (3-4 cumle)",
  "traits": ["Markanin 3-5 temel kisilik ozelligi"],
  "tone": "Markanin iletisim tonu (ornegin: Sicak ve samimi, Uzman ve guvenilir, Cesur ve yenilikci)",
  "voice": "Markanin sesi (ornegin: Bilgili ama ukala olmayan, Gelenege bagli ama yenilikciye acik)",
  "positioningStatement": "Markanin konumlandirma cumlesi. '[Hedef kitle] icin [fark yaratan ozellik] sunan [marka/isletme] dir' formatinda olmali. (1-2 cumle)",
  "targetAudience": "Hedef kitle tanimi. Demografik ve psikografik ozellikleri icerir. (2-3 cumle)",
  "differentiator": "Markayi rakiplerinden ayiran temel fark. Somut ve olculebilir olmali. (1-2 cumle)",
  "competitiveAdvantage": "Markanin rekabet avantaji. Neden musteriler bu markayi tercih etmeli? (1-2 cumle)"
}

ONEMLI KURALLAR:
1. Arketip seciminde wizard cevaplarini ve skor dagilimini dikkate al. Ozellikle "Kayip Duygusu", "Iletisim Tonu", "Ikna Yontemi" ve "Kriz Tepkisi" cevaplari arketip belirleme icin kritik.
2. "archetypeRationale" alaninda neden bu arktipi sectigini somut verilerle acikla. Hangi cevaplar ve oruntular bu secimi destekliyor?
3. "traits" listesinde sektore ozgu kisilik ozellikleri belirt. Genel kaliplardan kacin.
4. "positioningStatement" somut, net ve akilda kalici olmali.
5. "targetAudience" hem demografik (yas, gelir, lokasyon) hem psikografik (degerler, yasam tarzi, motivasyonlar) bilgileri icermeli.
6. "differentiator" ve "competitiveAdvantage" birbirini tamamlamali ama tekrarlamamali.
7. ${researchFindings && researchFindings.sourcesUsed > 0 ? 'Sektor arastirmasi bulgularini konumlandirma ve rekabet avantajinda kullan.' : 'Sektor arastirmasi mevcut degil, wizard verilerinden yola cikarak en iyi stratejiyi olustur.'}
8. Tum metinler TURKCE olmali.
9. Sadece JSON don, baska bir sey yazma.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const responseText = result.response.text();
  const parsed = safeParseJSON<StrategistOutput>(responseText, 'BrandStrategist');

  // Validate and provide fallbacks for required fields
  return {
    archetype: parsed.archetype || 'Yaratici',
    archetypeRationale: parsed.archetypeRationale || 'Arketip secimi mevcut verilerle belirlenmistir.',
    traits: Array.isArray(parsed.traits) && parsed.traits.length > 0 ? parsed.traits : ['Yenilikci', 'Guvenilir', 'Samimi'],
    tone: parsed.tone || 'Profesyonel ve samimi',
    voice: parsed.voice || 'Bilgili ve ulasılabilir',
    positioningStatement: parsed.positioningStatement || `${normalizedData.businessName}, ${normalizedData.sector} sektorunde fark yaratan bir markadir.`,
    targetAudience: parsed.targetAudience || 'Hedef kitle bilgisi belirlenememistir.',
    differentiator: parsed.differentiator || 'Farklilik bilgisi belirlenememistir.',
    competitiveAdvantage: parsed.competitiveAdvantage || 'Rekabet avantaji bilgisi belirlenememistir.',
  };
}
