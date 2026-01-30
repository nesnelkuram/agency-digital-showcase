import { generateJSON } from '../geminiClient';
import { resolveAnswers, STAGE_NAMES, STAGE_QUESTION_IDS, QUESTION_MAP } from '../prompts';
import type { PipelineInput, NormalizedData } from '../types';

export async function runDataNormalizer(input: PipelineInput): Promise<NormalizedData> {

  const { contact, sector, wizard, requestedServices } = input;
  const resolvedQA = resolveAnswers(sector, wizard.answers, wizard.scores);

  const stageResultsSummary = (wizard.stageResults || [])
    .map((s: any) => `- ${s.title || 'Asama'}: ${s.description || ''} (Skor: ${s.score ?? 'N/A'})`)
    .join('\n');

  const servicesList = (requestedServices || [])
    .map((s) => s.title)
    .join(', ');

  const prompt = `Sen bir veri normalizasyon uzmanisisin. Asagidaki ham marka degerlendirme wizard verisini yapilandirilmis ve normalize edilmis bir formata donustur.

## Isletme Bilgileri
- Isletme Adi: ${contact.businessName}
- Sektor: ${sector}
- Talep Edilen Hizmetler: ${servicesList || 'Belirtilmedi'}

## Asama Sonuclari
${stageResultsSummary || 'Asama sonucu bulunamadi'}

## Detayli Soru-Cevaplar
${resolvedQA || 'Cevap bulunamadi'}

---

Yukaridaki ham verileri analiz ederek asagidaki JSON yapisinda bir cikti uret:

{
  "sector": "sektor adi",
  "businessName": "isletme adi",
  "structuredAnswers": [
    {
      "stage": 0,
      "stageName": "Asama adi",
      "questions": [
        {
          "id": "soru id",
          "question": "soru metni",
          "answer": "ham cevap degeri",
          "answerLabel": "insanlar icin okunabilir cevap etiketi",
          "score": 0
        }
      ]
    }
  ],
  "detectedPatterns": ["Cevaplar arasinda tespit edilen oruntu ve temalar (3-5 adet)"],
  "contradictions": ["Cevaplar arasinda tespit edilen celiskiler (varsa)"],
  "dataQualityScore": 0.85,
  "missingAreas": ["Eksik veya yetersiz kalan alanlar (varsa)"],
  "overallProfile": "Isletmenin genel marka profilini ozetleyen 2-3 cumlelik dogal dilde bir metin. Isletmenin sektorunu, yaklasimini, guclu yanlarini ve genel konumlandirmasini icermeli."
}

ONEMLI KURALLAR:
1. "structuredAnswers" dizisinde her asama icin (${STAGE_NAMES.join(', ')}) bir girdi olustur. Her asamadaki sorulari etiketleriyle birlikte yaz.
2. "detectedPatterns" alaninda cevaplar arasindaki tutarli temaları, tekrar eden degerleri ve ortak egilimleri belirt (3-5 adet).
3. "contradictions" alaninda birbirleriyle celisen cevaplari tespit et. Celisi yoksa bos dizi don.
4. "dataQualityScore" 0 ile 1 arasinda bir deger olmali. Tum sorular cevaplanmissa 1.0'a yakin, eksik cevaplar varsa daha dusuk.
5. "missingAreas" alaninda cevaplanmamis veya yetersiz kalan alanlari listele. Hepsi tamamsa bos dizi don.
6. "overallProfile" alaninda isletmenin genel marka profilini dogal bir dille ozetle. Bu metin sonraki asamalarda diger ajanlar tarafindan kullanilacak.
7. Tum metinler TURKCE olmali.
8. Sadece JSON don, baska bir sey yazma.`;

  const parsed = await generateJSON<NormalizedData>('flash', prompt, 'DataNormalizer', {
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  // Ensure required fields have fallback values
  return {
    sector: parsed.sector || sector,
    businessName: parsed.businessName || contact.businessName,
    structuredAnswers: parsed.structuredAnswers || [],
    detectedPatterns: parsed.detectedPatterns || [],
    contradictions: parsed.contradictions || [],
    dataQualityScore: typeof parsed.dataQualityScore === 'number' ? parsed.dataQualityScore : 0.5,
    missingAreas: parsed.missingAreas || [],
    overallProfile: parsed.overallProfile || `${contact.businessName} - ${sector} sektorunde faaliyet gostermektedir.`,
  };
}
