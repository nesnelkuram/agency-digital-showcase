import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const eyePath = '/Users/intiba/Downloads/Grade.00_00_41_21182.Still004.jpg';
const eyeB64 = fs.readFileSync(eyePath).toString('base64');

const prompt = `Edit ONLY the iris of this eye. Subtly enhance the natural iris fibers and radial channels with a soft warm golden-amber tone — as if the iris is catching a gentle warm light from inside. The change must be very subtle and photorealistic: just slightly more golden warmth in the existing iris pattern.

STRICT RULES — DO NOT add any of the following:
- NO city silhouette, NO buildings, NO skyline
- NO floating orbs, NO stars, NO sparkles, NO particles
- NO glow bursts, NO lens flares, NO magical effects
- NO overlays, NO patterns that don't already exist in the iris
- NO new shapes inside the eye

Keep the pupil, sclera (white of the eye), eyelashes, eyebrow and surrounding skin completely untouched. The eye must still look like a real, natural human eye — just with a slightly warmer, more golden iris. Photorealistic, ultra-detailed, natural.`;

console.log('Calling Nano Banana 2 (gemini-3-pro-image-preview)...');

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: [
    { inlineData: { mimeType: 'image/jpeg', data: eyeB64 } },
    { text: prompt },
  ],
});

const parts = response.candidates?.[0]?.content?.parts ?? [];
let saved = 0;
for (const part of parts) {
  if (part.inlineData?.data) {
    const outPath = `/Users/intiba/Downloads/eye_golden_iris_${Date.now()}.png`;
    fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
    console.log('SAVED:', outPath);
    saved++;
  } else if (part.text) {
    console.log('TEXT:', part.text);
  }
}
if (!saved) console.log('NO IMAGE returned.');
