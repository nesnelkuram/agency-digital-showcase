import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const eyePath = '/Users/intiba/Downloads/Grade.00_00_41_21182.Still004.jpg';
const cityPath = '/Users/intiba/Downloads/Grade.00_00_41_39546.Still005.jpg';

const eyeB64 = fs.readFileSync(eyePath).toString('base64');
const cityB64 = fs.readFileSync(cityPath).toString('base64');

const prompt = `Place the city skyline silhouette from the SECOND image inside the iris of the eye from the FIRST image. The silhouette should organically merge with the iris's natural fiber and vein patterns — building outlines and rooftop lines appear as natural extensions of the iris channels. The silhouette glows softly in a warm golden-amber tone (subtle inner glow, not bright), sitting like a translucent layer over the iris texture. Keep the pupil, sclera, eyelashes and surrounding skin completely untouched — the change is ONLY inside the iris. Photorealistic, cinematic, ultra-detailed, soft light blending, seamless natural integration.`;

console.log('Calling Gemini 2.5 Flash Image...');

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: [
    { inlineData: { mimeType: 'image/jpeg', data: eyeB64 } },
    { inlineData: { mimeType: 'image/jpeg', data: cityB64 } },
    { text: prompt },
  ],
});

const parts = response.candidates?.[0]?.content?.parts ?? [];
let saved = 0;
for (const part of parts) {
  if (part.inlineData?.data) {
    const outPath = `/Users/intiba/Downloads/eye_city_merged_${Date.now()}.png`;
    fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
    console.log('SAVED:', outPath);
    saved++;
  } else if (part.text) {
    console.log('TEXT:', part.text);
  }
}
if (!saved) {
  console.log('NO IMAGE returned. Full response:');
  console.log(JSON.stringify(response, null, 2).slice(0, 2000));
}
