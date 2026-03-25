import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 120 };

const IMAGEN_MODEL = 'gemini-2.0-flash-preview-image-generation';

const FLOOR_PROMPTS = [
  {
    id: 'marble',
    label: 'Beyaz Mermer',
    prompt: `Bright airy modern kitchen interior, ultra low angle floor-level shot from 30cm height, expansive large format white Calacatta marble floor tiles dramatically filling foreground, sleek kitchen island and handle-less white cabinets receding into background, floor-to-ceiling windows flooding space with soft natural daylight, photorealistic architectural photography, zero text, zero people, pristine clean, 16:9`,
  },
  {
    id: 'wood',
    label: 'Açık Meşe',
    prompt: `Warm bright modern kitchen, ultra low angle floor shot from ground level, wide-plank light oak herringbone parquet floor dramatically filling foreground, minimal Scandinavian-style kitchen island and light grey cabinets in background, abundant soft natural light, warm whites and honey wood tones, architectural lifestyle photography, no text, no people, immaculate, 16:9`,
  },
  {
    id: 'large_tile',
    label: 'Büyük Format Taş',
    prompt: `Minimalist bright luxury kitchen, ultra low angle floor-level perspective, oversized 120x120cm light travertine stone tiles dramatically occupying foreground, floating island and dark-framed handle-less cabinets in depth, diffused northern daylight, pale stone and warm matte finish palette, professional architectural photography, no text, no people, 16:9`,
  },
  {
    id: 'concrete',
    label: 'Perdahlı Beton',
    prompt: `Contemporary open-plan kitchen space, ultra low angle shot from floor level, seamless polished micro-cement grey floor dramatically filling foreground, black metal-framed kitchen island and timber veneer cabinets in background, warehouse windows with soft diffused light, cool grey and raw warm tones, editorial interior photography, no text, no people, ultra realistic, 16:9`,
  },
];

async function generateImage(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
        signal: AbortSignal.timeout(45_000),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.warn(`Gemini image gen error ${response.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>
    };
    return data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (err: any) {
    console.warn(`Gemini image gen failed: ${err.message}`);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  const results: Array<{ id: string; label: string; imageB64: string | null }> = [];

  for (const floor of FLOOR_PROMPTS) {
    const imageB64 = await generateImage(floor.prompt, apiKey);
    results.push({ id: floor.id, label: floor.label, imageB64 });
  }

  return res.status(200).json({ images: results });
}
