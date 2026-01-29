import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const { contact, sector, wizard, requestedServices } = req.body;

    if (!contact || !sector || !wizard) {
      return res.status(400).json({ error: 'Missing required fields: contact, sector, wizard' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    const prompt = buildPrompt(contact, sector, wizard, requestedServices);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();
    const analysis = JSON.parse(responseText);

    return res.status(200).json({ success: true, analysis });
  } catch (error: any) {
    console.error('Gemini analysis error:', error);
    return res.status(500).json({ error: error.message || 'Analysis failed' });
  }
}

function buildPrompt(
  contact: { name: string; businessName: string; email: string },
  sector: string,
  wizard: { answers: Record<string, string>; scores: Record<string, number>; stageResults: any[] },
  requestedServices: { id: string; title: string }[]
): string {
  const stageResultsSummary = (wizard.stageResults || [])
    .map((s: any) => `- ${s.title}: ${s.description} (Skor: ${s.score})`)
    .join('\n');

  const answersSummary = Object.entries(wizard.answers || {})
    .map(([qId, answer]) => `  Soru ${qId}: ${answer}`)
    .join('\n');

  const servicesList = (requestedServices || [])
    .map((s: { title: string }) => s.title)
    .join(', ');

  return `Sen deneyimli bir marka stratejisti ve kreatif direktorsun. Asagidaki marka degerlendirme verisini analiz et ve detayli bir marka stratejisi raporu olustur.

## Basvuru Bilgileri
- Isletme: ${contact.businessName}
- Yetkili: ${contact.name}
- Sektor: ${sector}
- Talep Edilen Hizmetler: ${servicesList}

## Wizard Asama Sonuclari
${stageResultsSummary}

## Detayli Cevaplar
${answersSummary}

## Skorlar
${Object.entries(wizard.scores || {}).map(([k, v]) => `  Soru ${k}: ${v}`).join('\n')}

---

Yukaridaki verilere dayanarak asagidaki JSON formatinda bir analiz uret. Tum icerikler TURKCE olmali.

{
  "brandPersonality": {
    "archetype": "Jung arketiplerinden biri (ornegin: Bakim Veren, Kral, Bilge, Asi, Yaratici, Kahraman, Sihirbaz, Asik, Soytari, Masum, Kasif, Siradan Adam)",
    "traits": ["3-5 adet marka kisilik ozelligi"],
    "tone": "Markanin iletisim tonu (ornegin: Sicak ve samimi, Uzman ve guvenilir)",
    "voice": "Markanin sesi (ornegin: Bilgili ama ukala olmayan, Yenilikci ama koklerinden kopuk olmayan)"
  },
  "visualWorld": {
    "moodKeywords": ["5-7 adet gorsel dunya anahtar kelimesi"],
    "colorPalette": [
      { "hex": "#hexkod", "name": "Renk adi", "usage": "primary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "secondary" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "accent" },
      { "hex": "#hexkod", "name": "Renk adi", "usage": "neutral" }
    ],
    "typographyStyle": "Tipografi stili onerisi",
    "imageryStyle": "Fotograf ve gorsel icerik stili"
  },
  "contentStrategy": {
    "pillars": ["4-6 adet icerik sutunu"],
    "toneGuidelines": ["3-4 adet ton rehberi kurali"],
    "keyMessages": ["3-5 adet anahtar mesaj"],
    "hashtags": ["5-8 adet hashtag onerisi"]
  },
  "analysis": {
    "strengths": ["3-4 adet guclu yan"],
    "opportunities": ["3-4 adet firsat"],
    "challenges": ["2-3 adet zorluk"],
    "recommendations": ["4-6 adet stratejik oneri"]
  }
}

ONEMLI:
- Sadece JSON don, baska bir sey yazma
- Tum metinler Turkce olmali
- Renk kodlari gercekci ve sektore uygun olmali
- Oneriler somut ve uygulanabilir olmali
- Isletmenin sektorunu ve verdigi cevaplari dikkate al`;
}
