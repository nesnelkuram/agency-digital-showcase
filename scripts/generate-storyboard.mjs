#!/usr/bin/env node
// Innova Sultanahmet — "İki İstanbul" storyboard generator
// Vertical 9:16 split-screen, character-locked via Gemini 3 Pro Image Preview (Nano Banana 2)

import 'dotenv/config';
import { config } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local' });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error('GEMINI_API_KEY missing in .env.local');

const MODEL = 'gemini-3-pro-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.resolve('storyboard/innova-iki-istanbul');

await fs.mkdir(OUT_DIR, { recursive: true });

const CHARACTER_REF_PROMPT = `
Photorealistic cinematic portrait, vertical 9:16 framing.
A 32-year-old solo female traveler. Northern European / Scandinavian features.
Oval face, fair porcelain skin with a light natural blush, long shoulder-length wavy blonde hair (warm honey-blonde, slightly tousled, natural sun-kissed highlights).
Bright sky-blue almond-shaped eyes. Soft light eyebrows. Minimal natural makeup.
Wearing a cream-colored linen shirt, sleeves rolled to elbow. Small thin gold necklace.
Calm, curious expression — neither smiling nor serious. Looking just past the camera.
Soft warm morning light from camera-right (5500K, Mediterranean dawn).
Background: out-of-focus warm gold tones (suggestion of an interior with sheer curtains).
Shot on Arri Alexa 35, 50mm anamorphic lens, T1.4 shallow depth of field.
Subtle film grain. Color grade: warm neutral, gentle teal in shadows.
Skin tones true to life. No filters. No instagram aesthetic. Cinematic restraint.
Composition: tight medium-close, head and shoulders, woman occupies upper-center of vertical frame.
This is the master character reference. Lock face, hair, body type, wardrobe across all subsequent frames.
The woman MUST have blonde hair and blue eyes in every subsequent frame — non-negotiable.
`.trim();

// Each scene is a top/bottom split for vertical 9:16.
// "top" = Innova guest (calm, close, intimate), "bottom" = uzak otel guest (rushed, distant, chaotic)
const FRAMES = [
  {
    id: '01-uyanma',
    label: 'Sahne 1 — Uyanma (07:14)',
    prompt: `
VERTICAL 9:16 split-screen storyboard frame. Same woman as character reference appears in BOTH halves — identical face, identical hair, identical body type. Wardrobe differs slightly per half.

TOP HALF: The woman has just opened a sheer linen curtain. Pre-dawn warm orange light spills onto her face. Through the window: distant Marmara Sea, faint silhouette of the Princes' Islands on horizon, two minarets in middle distance. A small steaming glass of Turkish tea (tulip glass) on the bedside. She is calm, lit only by golden light. Cream linen pajamas. Hand resting on curtain. The room is quiet, ordered.

BOTTOM HALF: The same woman, harshly lit by a phone screen in a dark hotel room. Air conditioner unit visible on wall. Heavy blackout curtains drawn shut. White polyester duvet, generic. Highway noise implied through the window (taillight glow on glass). She squints at the alarm, exhausted. Generic dark gray t-shirt.

Both halves share identical color grading rules but oppose in mood: top = warm 5500K Mediterranean dawn / bottom = cold 3200K phone-blue.
Cinematic. Anamorphic. Film grain. No text overlay. Subtle horizontal seam between halves (1px black line).
`.trim(),
  },
  {
    id: '02-kahvalti',
    label: 'Sahne 2 — Kahvaltı',
    prompt: `
VERTICAL 9:16 split-screen. Same woman in both halves (character-locked).

TOP: Rooftop breakfast table. Marmara Sea visible in background, pale blue morning. Traditional Turkish breakfast spread: olives, white cheese, sliced cucumber, tomato, simit, honeycomb, small jam jars, soft-boiled egg in cup, clear tulip glass of tea. She holds a piece of bread, eyes on the sea. Cream linen shirt now. Empty chair across from her. Solo but unhurried. Soft natural light. Wide vertical composition.

BOTTOM: Generic hotel breakfast buffet. Fluorescent overhead lighting. Plastic plate. Behind her: a queue of guests at chafing dishes. Someone's elbow nearly in frame. She holds the same posture but tense. Wearing the same linen shirt. The plate has random odd combinations: a croissant, scrambled eggs, watermelon. Phone face-down on table.

Both halves: same character face, same wardrobe top, opposite atmosphere. Cinematic 9:16. Thin seam between halves.
`.trim(),
  },
  {
    id: '03-kapi',
    label: 'Sahne 3 — Kapı / Lobi',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: Stepping out of a hotel doorway onto a stone street in Sultanahmet, Istanbul. Foot mid-step landing on cobblestones. Behind her: a warm hotel lobby glow. In front of her: a quiet narrow street with a single seagull, a tram cable above, a faint minaret tip visible in distance. Cream linen shirt + neutral tan trousers + comfortable leather flats. A small canvas tote on shoulder. Morning light slanting in.

BOTTOM: Same woman in a generic modern hotel lobby (granite floor, ribbon LED, leather sofa). Sitting on edge of sofa. Phone in hand showing a ride-share app: "Driver arriving in 18 min." Suitcase next to her. Outside the lobby's glass doors: a busy multi-lane road, taxi queue, traffic. She is dressed identically to the top half but tense, glancing at watch.

9:16 vertical, anamorphic cinematic. Character face IDENTICAL in both halves.
`.trim(),
  },
  {
    id: '04-yerebatan',
    label: 'Sahne 4 — Yerebatan / Trafik',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: She stands at the entrance of the Basilica Cistern (Yerebatan Sarnıcı), Istanbul. Just 100 meters from the hotel. Stone arch entrance, dim orange interior lamps glowing from within. NO QUEUE — she is the first visitor of the morning. Her hand on the cool stone wall. She turns her head slightly to look inside. Expression: anticipation. The street outside is calm, sun low.

BOTTOM: Same woman in the back seat of a taxi, stuck in heavy Istanbul traffic on a wide avenue. Through the windshield: red brake lights of cars stretching ahead, a tram passing on the right side. Her face lit by the harsh midday sun + dashboard glow. Phone on her lap shows Google Maps with red traffic lines, ETA "12 minutes" but the visible time has clearly stretched.

Identical face/hair/wardrobe rules. Vertical 9:16. Cinematic.
`.trim(),
  },
  {
    id: '05-ayasofya',
    label: 'Sahne 5 — Ayasofya / Kuyruk',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: Standing inside Hagia Sophia, looking up at the dome. Tiny human figure framed by massive Byzantine architecture. Light shaft from upper window cutting through dust motes. Mosaics partially visible. Mostly empty interior — early morning visitor. Her face turned upward, awe. 14mm wide vertical composition emphasizes scale.

BOTTOM: Same woman at the back of a long visitor queue OUTSIDE Hagia Sophia. Crowd of tourists ahead of her, some holding phones up for selfies. Sun directly overhead, harsh shadows. She glances at her phone showing the time. The dome is barely visible above the crowd.

Same character. Vertical 9:16 cinematic. Identical face.
`.trim(),
  },
  {
    id: '06-sultanahmet',
    label: 'Sahne 6 — Sultanahmet Camii / Tur Otobüsü',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: Standing in the courtyard of the Sultanahmet Mosque (Blue Mosque), Istanbul. A flock of pigeons taking off in slow-motion blur around her. Blue Iznik tile reflections in her blue eyes. Six minarets framing the upper sky. She is alone in the courtyard, soft warm late-morning light.

BOTTOM: Same woman, face pressed near a tour bus window. Through the bus glass: a blurred glimpse of the Blue Mosque passing by. Inside the bus: rows of seats, a tour guide standing with a microphone in foreground (visible from behind). Reflected in the window: her tired face and the bus's interior fluorescent light.

Identical character lock. Cinematic 9:16 vertical.
`.trim(),
  },
  {
    id: '07-bogaz',
    label: 'Sahne 7 — Boğaz / Karaya Vurmuş',
    prompt: `
VERTICAL 9:16 split-screen photorealistic cinematic frame. Same blonde woman both halves (character-locked: long honey-blonde wavy hair, sky-blue eyes, fair skin, cream linen shirt).

TOP: She stands at the Eminönü waterfront in Istanbul, leaning gently against an old wrought-iron railing. Late afternoon golden light. In the foreground left: a fresh sesame simit in her hand, mid-bite, a few sesame seeds caught in the breeze. Mid-frame: seagulls in mid-flight (motion blur on wings, slow shutter feel) circling around her against the open sky. Background: the Bosphorus full of life — a classic white passenger ferry (vapur) crossing toward Üsküdar with steam from its funnel, a fishing boat closer to shore with hanging nets, the Galata Tower silhouette on the far hill. Reflections of golden hour shimmering on the water. She is laughing softly, hair caught by the wind. Cinematic anamorphic feel.

BOTTOM: Same woman, but exhausted, sitting alone at a generic seaside cafe table much further away from any landmarks. Plastic chair, laminated menu. The Bosphorus is technically visible but only as a thin distant strip beyond a parking lot and a busy four-lane road. The simit on her plate is store-packaged in cellophane. No seagulls — only pigeons near a trash bin. Phone in hand showing a missed call notification. Heavy traffic noise implied. Dull flat overcast light despite it being the same hour as TOP.

Both halves: identical character (blonde, blue-eyed). Vertical 9:16. Anamorphic. Thin 1px black horizontal seam between halves.
`.trim(),
  },
  {
    id: '08-carsi',
    label: 'Sahne 8 — Kapalıçarşı / Hâlâ Trafik',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: Inside the Grand Bazaar (Kapalıçarşı), Istanbul. She is mid-laugh, bargaining with a copper craftsman whose hands hold a hammered copper bowl. Sparks in the background from another stall (out of focus). Hanging lamps, golden warm light, deep shadows. A small tulip-glass of tea has been pressed into her hand. Sensory richness.

BOTTOM: Same woman still in a taxi, now hours later, still in traffic. The sun is now setting through the windshield, golden. Phone shows Google Maps "Grand Bazaar — 35 min". Her head is leaned against the window, exhausted. Light traffic of street vendors visible outside the car.

Same character lock. Vertical 9:16.
`.trim(),
  },
  {
    id: '09-hamam',
    label: 'Sahne 9 — Hamam / Yorgun',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: Inside a traditional Turkish hammam. Warm steam, soft beams of light through small dome openings. She lies face-up on a heated marble platform (göbektaşı), eyes closed, peaceful. A pair of experienced masseur hands are working her shoulders (only the hands visible, soft focus). Her face: pure release.

BOTTOM: Same woman collapsed face-up on a generic hotel bed. Shoes still on, dangling off the edge of the bed. Phone screen glowing on her chest, showing "23,847 steps". Eyes open, staring at ceiling. Bright blue-white hotel ceiling light. Tense.

Identical character. Vertical 9:16 cinematic.
`.trim(),
  },
  {
    id: '10-rooftop',
    label: 'Sahne 10 — Rooftop / Otel Barı',
    prompt: `
VERTICAL 9:16 split-screen. Same woman both halves.

TOP: On a rooftop terrace at golden hour. The Marmara Sea spreads out behind her, sun low and orange, three minarets silhouetted on the right edge of the frame. She holds a glass of wine. Empty chair across from her — but the framing makes the absence feel okay, not lonely. A small plate of meze (cheese, olives, melon slice). A distant ferry horn implied.

BOTTOM: Same woman alone in a generic hotel bar. Beige cafeteria-grade lighting. She holds a glass of the same wine but the color looks wrong under fluorescent light. She scrolls through her phone gallery, looking at photos that didn't turn out the way she hoped. Empty bar, empty table, empty mood.

Identical character lock. Vertical 9:16. Maximum contrast in light/mood.
`.trim(),
  },
  {
    id: '11-birlesme',
    label: 'Sahne 11 — Birleşme (Tek Ekran)',
    prompt: `
VERTICAL 9:16 SINGLE FRAME (no split). Same woman from character reference.

She is on the rooftop terrace at dusk. Slowly turning to face the camera for the first time in the entire film. Behind her: Marmara Sea in dusk blue, two distant minarets glowing with their evening lights, and a single ferry passing on the horizon. She is half-smiling, knowing, intimate — as if inviting the viewer. Her hand still holds the wine glass at chest height.

Cinematic 9:16 vertical. Anamorphic 50mm portrait. Soft warm rim light from camera-right (last sun). Slight breeze in hair. Color grade: warm umber + teal shadows. Face exactly matching character reference.
`.trim(),
  },
  {
    id: '12-endcard',
    label: 'Sahne 12 — End Card',
    prompt: `
VERTICAL 9:16 cinematic end card. Pure black background (#0a0a0a). Centered white serif typography (elegant, like Playfair Display or similar high-end editorial serif).

Top of frame, large:
"INNOVA SULTANAHMET"

Below, italic, smaller:
"Aynı şehir. İki ayrı sen."
"Same city. Two different yous."

A thin horizontal divider line.

Below the divider, smaller text in three centered lines:
"British Airways Holidays · Customer Excellence Award 2025"
"Feefo 4.6 / 5"
"innovasultanahmet.com"

Subtle gold accent on the divider line. No images, no logos beyond text. Pure typographic restraint. High-end luxury feel. Generous negative space. The text occupies center 60% of the vertical frame.
`.trim(),
  },
];

const SYSTEM_LOCK_INSTRUCTION = `
CHARACTER LOCK: The woman shown in any subsequent frame must be IDENTICAL in face, hair, eye color, body type, and skin tone to the character in the provided reference image.
She is a Northern European woman with LONG HONEY-BLONDE WAVY HAIR (shoulder length), BRIGHT SKY-BLUE EYES, FAIR PORCELAIN SKIN, oval face, soft features.
DO NOT change her hair color to brown or dark — it must remain blonde in every single frame.
DO NOT change her eye color from blue.
DO NOT change her age, ethnicity, hair length, or facial structure.
Wardrobe may change subtly per scene as described, but her body proportions and face must remain locked.
This is a continuity-critical advertising storyboard.
`.trim();

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function callImageAPI(parts, label) {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '9:16' },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error for ${label}: ${res.status} ${errText.slice(0, 500)}`);
  }

  const json = await res.json();
  const candidate = json.candidates?.[0];
  if (!candidate) throw new Error(`No candidate returned for ${label}`);

  const partsOut = candidate.content?.parts || [];
  const imagePart = partsOut.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart) {
    const textPart = partsOut.find((p) => p.text);
    throw new Error(`No image returned for ${label}. Text: ${textPart?.text?.slice(0, 300) || 'none'}`);
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

async function saveImage(buffer, filename) {
  const filepath = path.join(OUT_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

async function generateCharacterReference() {
  console.log('▶ Generating character reference (master)...');
  const buffer = await callImageAPI([{ text: CHARACTER_REF_PROMPT }], 'character-ref');
  await saveImage(buffer, '00-character-ref.png');
  console.log('  ✓ saved 00-character-ref.png');
  return buffer.toString('base64');
}

async function generateFrame(frame, characterRefBase64) {
  console.log(`▶ ${frame.label}`);
  const parts = [
    { inlineData: { mimeType: 'image/png', data: characterRefBase64 } },
    { text: SYSTEM_LOCK_INSTRUCTION },
    { text: frame.prompt },
  ];
  try {
    const buffer = await callImageAPI(parts, frame.id);
    const file = `${frame.id}.png`;
    await saveImage(buffer, file);
    console.log(`  ✓ saved ${file}`);
    return { id: frame.id, label: frame.label, file, ok: true };
  } catch (e) {
    console.error(`  ✗ FAILED: ${e.message}`);
    return { id: frame.id, label: frame.label, ok: false, error: e.message };
  }
}

async function buildIndexHTML(results) {
  const cards = results
    .map(
      (r) => `
    <figure class="card">
      <div class="frame-num">${r.id}</div>
      <img src="${r.file || '#'}" alt="${r.label}" ${r.ok ? '' : 'style="opacity:.2"'} />
      <figcaption>${r.label}${r.ok ? '' : ` <span class="err">— FAILED: ${r.error}</span>`}</figcaption>
    </figure>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Innova Sultanahmet — İki İstanbul · Storyboard</title>
<style>
  body { background:#0a0a0a; color:#e8e8e8; font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif; margin:0; padding:48px 24px; }
  h1 { font-family: 'Playfair Display', Georgia, serif; font-weight:400; font-size:32px; letter-spacing:.5px; margin:0 0 8px; }
  .sub { color:#888; margin:0 0 40px; font-size:14px; }
  .ref { display:flex; gap:24px; align-items:flex-end; margin-bottom:48px; padding-bottom:32px; border-bottom:1px solid #222; }
  .ref img { width:240px; aspect-ratio:9/16; object-fit:cover; border-radius:6px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:20px; }
  .card { margin:0; background:#111; border-radius:6px; overflow:hidden; position:relative; }
  .card img { width:100%; aspect-ratio:9/16; object-fit:cover; display:block; }
  .frame-num { position:absolute; top:8px; left:8px; background:rgba(0,0,0,.6); color:#d4af37; font-size:11px; font-family:monospace; padding:3px 6px; border-radius:3px; letter-spacing:.5px; }
  figcaption { padding:12px 14px; font-size:13px; color:#bbb; line-height:1.4; }
  .err { color:#ff6b6b; }
  footer { margin-top:48px; font-size:12px; color:#555; }
</style>
</head>
<body>
  <h1>İki İstanbul</h1>
  <p class="sub">Innova Sultanahmet · vertical 9:16 storyboard · character-locked via Gemini 3 Pro Image Preview</p>
  <div class="ref">
    <img src="00-character-ref.png" alt="Character master reference" />
    <div>
      <div style="font-family:'Playfair Display',serif; font-size:18px; margin-bottom:6px">Master Character Reference</div>
      <div style="color:#888; font-size:13px; max-width:420px; line-height:1.5">All subsequent frames lock face, hair, eye color, and body type to this image.</div>
    </div>
  </div>
  <div class="grid">${cards}</div>
  <footer>Generated ${new Date().toISOString()}</footer>
</body>
</html>`;

  await fs.writeFile(path.join(OUT_DIR, 'index.html'), html);
  console.log('  ✓ saved index.html');
}

async function main() {
  console.log(`Innova "İki İstanbul" — Vertical Storyboard`);
  console.log(`Model: ${MODEL}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const charRefBase64 = await generateCharacterReference();
  await delay(1500);

  const results = [];
  for (const frame of FRAMES) {
    const result = await generateFrame(frame, charRefBase64);
    results.push(result);
    await delay(2000); // gentle rate-limiting
  }

  await buildIndexHTML(results);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone. ${ok}/${results.length} frames OK, ${fail} failed.`);
  console.log(`Open: ${path.join(OUT_DIR, 'index.html')}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
