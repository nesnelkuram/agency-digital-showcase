import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fal } from '@fal-ai/client';
import fs from 'node:fs';

fal.config({ credentials: process.env.FAL_KEY });

const EYE = '/Users/intiba/Downloads/Grade.00_00_40_18.Still001.jpg';
const GOLDEN = '/Users/intiba/Downloads/eye_golden_iris_1778586863766.png';
const CITY = '/Users/intiba/Downloads/Grade.00_00_41_39546.Still005.jpg';

const NEG = 'magical effects, sparkles, lens flare, portal, fantasy, glow burst, particle effects, floating orbs, stars, blurry, distorted, cartoon, stylized';

async function upload(path, name, mime) {
  const f = new File([fs.readFileSync(path)], name, { type: mime });
  return await fal.storage.upload(f);
}

console.log('Uploading images...');
const [eyeUrl, goldenUrl, cityUrl] = await Promise.all([
  upload(EYE, 'eye.jpg', 'image/jpeg'),
  upload(GOLDEN, 'golden.png', 'image/png'),
  upload(CITY, 'city.jpg', 'image/jpeg'),
]);
console.log('  eye   :', eyeUrl);
console.log('  golden:', goldenUrl);
console.log('  city  :', cityUrl);

const ep = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';

const clipAPrompt = `Slow continuous zoom-in into the eye. The iris fibers gradually take on a subtle warm golden-amber tone, as if the iris is catching a soft warm light from within. The change is gentle and photorealistic. No overlays, no city, no orbs, no sparkles. Cinematic, photorealistic, seamless single shot, 4K.`;

const clipBPrompt = `Continuous forward camera motion through the eye into a cityscape. The golden iris fibers gradually expand and dissolve into the natural warm tones of a real night city — street lamps, headlights, lit buildings emerging. Smooth organic texture-to-texture transformation. No magic effects, no sparkles, no orbs. Cinematic, photorealistic, seamless single shot, 4K.`;

console.log('\nStarting both Kling jobs in parallel...');

const startedAt = Date.now();
const [resA, resB] = await Promise.all([
  fal.subscribe(ep, {
    input: {
      prompt: clipAPrompt,
      image_url: eyeUrl,
      tail_image_url: goldenUrl,
      duration: '5',
      aspect_ratio: '16:9',
      negative_prompt: NEG,
    },
    logs: false,
    onQueueUpdate: (u) => { if (u.status !== 'IN_PROGRESS') console.log('  [A]', u.status); },
  }),
  fal.subscribe(ep, {
    input: {
      prompt: clipBPrompt,
      image_url: goldenUrl,
      tail_image_url: cityUrl,
      duration: '5',
      aspect_ratio: '16:9',
      negative_prompt: NEG,
    },
    logs: false,
    onQueueUpdate: (u) => { if (u.status !== 'IN_PROGRESS') console.log('  [B]', u.status); },
  }),
]);
console.log(`Both done in ${Math.round((Date.now() - startedAt) / 1000)}s`);

async function dl(res, name) {
  const url = res.data?.video?.url || res.video?.url;
  const out = `/Users/intiba/Downloads/${name}.mp4`;
  fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log('  saved:', out);
  return out;
}

const ts = Date.now();
const clipA = await dl(resA, `clipA_eye_to_golden_${ts}`);
const clipB = await dl(resB, `clipB_golden_to_city_${ts}`);

console.log('\nClip A:', clipA);
console.log('Clip B:', clipB);
console.log('\nNow run ffmpeg to speed up + concat.');
