#!/usr/bin/env node
// Ordino editorial moodboard — Loro Piana / Sail Provisions tonu
// Yüz var ama satış pozu yok. Anlık, sıcak, vintage.

import 'dotenv/config';
import { config } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

config({ path: '.env.local' });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error('GEMINI_API_KEY missing');

const MODEL = 'gemini-3-pro-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.resolve('public/ordino/editorial');
await fs.mkdir(OUT_DIR, { recursive: true });

const STYLE = `
EDITORIAL FILM PHOTOGRAPHY — Loro Piana / Sail Provisions / Massimo Dutti / Tory Sport tone.
Mediterranean light, warm half-stop, sun-bleached. Color grade: cream + warm umber + soft teak + faded navy.
Shot on 35mm film, slight grain, mat finish, natural light only. Anamorphic feel.
NOT advertising — looks like a magazine spread (GQ, Cabana, Holiday Magazine).
Composition: relaxed, moments not poses. People feel real, not models.
Setting suggests a modern yacht with classic styling (teak deck, brass detail, white hull, natural rope).
Generous negative space. NO product hero shots. NO logos visible.
`.trim();

const FRAMES = [
  {
    id: '01-water-pasta',
    aspect: '4:5',
    prompt: `${STYLE}\n\nA young man in a sky-blue linen shirt, dark wavy hair, sitting at a seaside restaurant table directly above the Mediterranean sea. He is drinking water from a clear glass, mid-sip. The bowl in front of him has pasta with sauce. A clean wine glass, cutlery wrapped in white linen, a tan suede crossbody bag on the table, black sunglasses, a glass water bottle. The horizon line is exactly halfway up the frame. Dramatic blue sky with thin clouds. He looks slightly off-camera, calm. Editorial portrait.`,
  },
  {
    id: '02-dive',
    aspect: '4:5',
    prompt: `${STYLE}\n\nA shirtless young man mid-air, jumping/diving off the bow of a classic 1960s Italian Riva-style wooden speedboat into a calm alpine lake. Arms outstretched, body horizontal, white loose linen pants. The polished varnished teak deck, chrome steering wheel, classic dial gauges visible in foreground. Mountain silhouettes in background, hazy haze. He is captured at peak of the jump, small in the frame. Composition emphasizes the boat's craftsmanship.`,
  },
  {
    id: '03-legs-railing',
    aspect: '4:5',
    prompt: `${STYLE}\n\nClose-mid shot from inside a yacht doorway. A woman walks barefoot along the polished teak deck railing, holding a white shirt that flutters in the wind. Only her tanned legs and lower torso visible, no face. Sun creates rim light on her skin. The Mediterranean sea reflects warm gold. Aperture sun-flares through the doorway frame. Felt, sensual but not posed.`,
  },
  {
    id: '04-cheese-rose',
    aspect: '4:5',
    prompt: `${STYLE}\n\nAboard a yacht. Two hands clinking rosé wine glasses in the foreground (half-blurred). On the teak countertop behind: a wooden bowl overflowing with grapes, plums, peaches. A second plate with brie cheese, baguette slices, walnuts. Glass bottle of rosé. The sea visible through the cabin window. Soft natural light. No faces. Just hands, glasses, food, and water.`,
  },
  {
    id: '05-backgammon',
    aspect: '4:5',
    prompt: `${STYLE}\n\nLooking down at a yacht foredeck arranged for a slow afternoon. Blue-and-white striped beach towels spread on the deck. A vintage navy cooler box. A wooden backgammon set open, mid-game with white and brown checkers, dice. A green Perrier bottle on its side, two lemons, two small ceramic cups. The Mediterranean port in soft focus background. Top-down angle. No people. The objects tell the story.`,
  },
  {
    id: '06-friends-sailboat',
    aspect: '4:5',
    prompt: `${STYLE}\n\nTwo young women in 1960s style swimsuits (one solid white, one black-and-white striped) sitting close together on the bow of a small classic green-hulled sailboat. Bare feet dangling above the water. The white sail catching warm wind behind them. They're laughing, looking at each other, candid moment. Long dark hair. Golden hour. The boat's hull number "5082 EX" partially visible. Friendship, joy, sun.`,
  },
  {
    id: '07-rugby-sunfish',
    aspect: '4:5',
    prompt: `${STYLE}\n\nA young man kneeling in the cockpit of a small classic Sunfish-style sailing dinghy. Wearing a vintage red-and-white horizontal striped rugby shirt with chest text reading "Sunfish" in cursive script. Black shorts. Holding a sail rope. The white sail boom partially shadows his face — only nose and mouth visible, eyes hidden. Heritage americana feel. Golden hour, warm sun-glow on water.`,
  },
  {
    id: '08-hands-rope',
    aspect: '4:5',
    prompt: `${STYLE}\n\nClose-up of weathered male hands gripping a thick natural manila rope on a yacht. Salt-stained fingertips, a small leather bracelet. Behind the hands, slightly out of focus, the brass cleat the rope wraps around, and beyond that, the open sea horizon. Late afternoon light, warm tones on skin. Tactile, masculine, quiet. No face, just hands and rope.`,
  },
  {
    id: '09-back-deck',
    aspect: '4:5',
    prompt: `${STYLE}\n\nA woman stands on the aft deck of a yacht, back to the camera, looking out at the horizon. She wears a long white linen kaftan that catches the breeze. Long light brown hair lifted slightly by wind. Sun is low, casting long warm shadow. A glass of white wine in her hand, held loosely at her side. The sea is calm, golden. Silhouette tendency but with soft rim-lit detail. Solitude, contemplation.`,
  },
  {
    id: '10-couple-sunset',
    aspect: '4:5',
    prompt: `${STYLE}\n\nA young couple on the side bench of a yacht at sunset. The woman is mid-laugh, head tilted back, her partner's arm relaxed around her shoulder. He is half-smiling, looking at her. Both wearing simple white linen — she a slip dress, he an unbuttoned shirt over swim shorts. Golden orange light from low sun behind them, lens flare creeping into corner. Empty wine glasses on the bench beside them. Real moment, not posed. Faces visible but candid.`,
  },
];

async function call(prompt, aspect) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: aspect },
    },
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!img) throw new Error('No image returned: ' + (parts.find(p=>p.text)?.text?.slice(0,200) || ''));
  return Buffer.from(img.inlineData.data, 'base64');
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

console.log(`Ordino editorial moodboard → ${OUT_DIR}`);
const results = [];
for (const f of FRAMES) {
  console.log(`▶ ${f.id} (${f.aspect})`);
  try {
    const buf = await call(f.prompt, f.aspect);
    const file = `${f.id}.png`;
    await fs.writeFile(path.join(OUT_DIR, file), buf);
    console.log(`  ✓ ${file}`);
    results.push({ id: f.id, file, ok: true });
  } catch (e) {
    console.error(`  ✗ ${f.id}: ${e.message}`);
    results.push({ id: f.id, ok: false, error: e.message });
  }
  await delay(2000);
}

const ok = results.filter(r => r.ok).length;
console.log(`\nDone. ${ok}/${FRAMES.length} OK.`);
