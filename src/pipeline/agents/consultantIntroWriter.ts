import { generateText } from '../geminiClient';
import type { NormalizedData, ResearchFindings, SynthesizedAnalysis, BlogAdvisorOutput, BusinessContextInput } from '../types';

export async function runConsultantIntroWriter(
  normalizedData: NormalizedData,
  researchFindings: ResearchFindings | null,
  synthesized: SynthesizedAnalysis,
  blogAdvisorOutput: BlogAdvisorOutput | null,
  businessContext?: BusinessContextInput,
): Promise<string> {

  const bName = normalizedData.businessName;

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

  // --- Synthesizer ciktisi ozet ---
  const positioning = synthesized.positioning;
  const personality = synthesized.brandPersonality;

  // --- Blog advisor (varsa) ---
  const blogPerspective = blogAdvisorOutput?.authorPerspective || '';
  const unconventional = blogAdvisorOutput?.unconventionalInsights?.join('; ') || '';

  const prompt = `Sen deneyimli bir marka strateji danismanisin. Asagidaki isletme hakkinda tum verileri okudun, arastirmayi yaptIn, stratejiyi olusturdun. Simdi isletme sahibiyle ILK TOPLANTIDA yuz yuze oturuyorsun. Ona 4-6 cumlelik bir ACILIS KONUSMASI yapacaksin.

Bu metin bir raporun EN BASINDA gosterilecek — isletme sahibinin ILKI OKUYACAGI sey. Amac: karsi tarafin "bu kisi benim isimi GERCEKTEN ANLIYOR" demesi.

---

## Isletme: ${bName}
## Sektor: ${normalizedData.sector}
## Genel Profil: ${normalizedData.overallProfile}

## Isletme Baglam Bilgileri
${bcLines.join('\n') || 'Detay belirtilmemis.'}

## Bilinen Rakipler
${allCompetitors.length > 0 ? allCompetitors.join(', ') : 'Belirtilmemis'}

## Pazar Gercekligi
${marketContext || 'Pazar verisi mevcut degil.'}

## Strateji Ciktisi (senin analiz sonucun)
- Arketip: ${personality.archetype}
- Konumlandirma: ${positioning.statement}
- Rekabet Haritasi: ${positioning.competitiveLandscape || 'Yok'}
- Temel Fark: ${positioning.differentiator}
- Rekabet Avantaji: ${positioning.competitiveAdvantage}

${blogPerspective ? `## Stratejik Danismanin Bakisi\n${blogPerspective}` : ''}
${unconventional ? `## Alisilagelmis Olmayan Icgoruler\n${unconventional}` : ''}

---

SIMDI, yukaridaki TUM verileri kullanarak isletme sahibine 4-6 cumlelik bir ACILIS KONUSMASI yaz.

ZORUNLU KURALLAR:

1. RAKIP ISIMLERINI KULLAN: "${allCompetitors.slice(0, 3).join(', ')}" gibi GERCEK isimleri yaz. "Rakipler" kelimesi YASAK.

2. SOMUT GERCEKLIK: Bu isletmenin SPESIFIK durumunu anlat. "${bName}" adini, kurulis hikayesini, uretim gecmisini, sektordeki konumunu, dijital varligini kullan. GENEL GECERDIR laflar YASAK.

3. STRATEJIK ICGORU: Bu isletmenin ASIL savasinin ne oldugunu TEK CUMLEDE soyle. "Senin savasin X degil, Y." Mesela: "Sizin savasiniz fiyatla degil, musterinizin sofrasindaki o 'vay be' anini yaratmakla kazanilacak." — ama KLISE DEGIL, bu isletmeye OZEL.

4. YONLENDIRME: Son cumlede "simdi bunu birlikte analiz edecegiz" tarzinda kapat ama SOMUT olarak neyi analiz ettigini soyle.

5. "SIZ" DIYE HITAP ET. Samimi ve profesyonel.

6. GUVEN VEREN OL: Isletmenin mevcut guclu yanlarini kabullen, sonra stratejik gelisim alanlarini belirt. Dengeli ol: Gercekci ama umut verici. Isletmenin potansiyelini somut verilerle goster.

7. METAFOR KULLAN ama bu isletmeye OZEL: "Onlar market rafinda, siz kalplerde olmalisiniz" gibi — ama KLISE degil, GERCEKTEN bu isletmenin durumunu yansitan.

YASAKLI KALIPLAR — BUNLARI YAZARSAN METIN RED EDILIR:
- "Rekabetin yogun oldugu bir sektorde faaliyet gosteriyorsunuz"
- "Markanizi farklilastirmaniz gerekiyor"
- "Dijital dunyada gorunur olmaniz onemli"
- "Kaliteli urunleriniz ile one cikabilirsiniz"
- "Dogru stratejiyle buyuk basarilar elde edebilirsiniz"
- "Hedef kitlenize dogru mesajlarla ulasmaniz gerekiyor"
- "Sizin icin hazirlanan bu raporda..."
- "Analiz sonuclarimiz gosteriyor ki..."

LITMUS TEST: Isletme adini degistirsen cumle ANLAMSIZLASMALI. Yani bu metin SADECE ${bName} icin gecerli olmali.

SADECE 4-6 cumle yaz. Baslik, giris, aciklama EKLEME. Dogrudan konusmaya basla.`;

  const text = await generateText('pro', prompt, 'ConsultantIntroWriter', {
    temperature: 0.9,
    maxOutputTokens: 1024,
  });

  // Temizlik: bazen model basina/sonuna tirnak veya "consultantIntro:" gibi prefix ekleyebilir
  return text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^consultantIntro:\s*/i, '')
    .trim();
}
