import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fal } from '@fal-ai/client';
import fs from 'node:fs';

fal.config({ credentials: process.env.FAL_KEY });

const startPath = '/Users/intiba/Downloads/Grade.00_00_40_18.Still001.jpg';
const endPath = '/Users/intiba/Downloads/eye_city_merged_1778585457819.png';

console.log('Uploading start image...');
const startFile = new File([fs.readFileSync(startPath)], 'start.jpg', { type: 'image/jpeg' });
const startUrl = await fal.storage.upload(startFile);
console.log('  ->', startUrl);

console.log('Uploading end image...');
const endFile = new File([fs.readFileSync(endPath)], 'end.png', { type: 'image/png' });
const endUrl = await fal.storage.upload(endFile);
console.log('  ->', endUrl);

const prompt = `Slow continuous zoom-in into the eye. The iris fibers gradually glow in warm golden-amber tones, and a city skyline silhouette organically emerges within the iris pattern — building outlines appearing as natural extensions of the iris channels. Cinematic, photorealistic, seamless single shot, organic morph transition, soft light blending, no magic effects, no sparkles, no flares, 4K smooth dolly-in.`;

const endpoints = [
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  'fal-ai/kling-video/v2.1/master/image-to-video',
];

let result;
let usedEndpoint;
for (const ep of endpoints) {
  console.log('\nTrying endpoint:', ep);
  try {
    result = await fal.subscribe(ep, {
      input: {
        prompt,
        image_url: startUrl,
        tail_image_url: endUrl,
        duration: '5',
        aspect_ratio: '16:9',
        negative_prompt: 'magical effects, sparkles, lens flare, portal, fantasy, glow burst, particle effects, blurry, distorted',
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          (update.logs || []).slice(-1).forEach((l) => console.log('  log:', l.message));
        } else {
          console.log('  status:', update.status);
        }
      },
    });
    usedEndpoint = ep;
    break;
  } catch (e) {
    console.log('  FAILED:', e.message || e);
  }
}

if (!result) {
  console.log('\nAll endpoints failed.');
  process.exit(1);
}

console.log('\n=== RESULT ===');
console.log('Endpoint used:', usedEndpoint);
const videoUrl = result.data?.video?.url || result.video?.url;
console.log('Video URL:', videoUrl);

if (videoUrl) {
  const out = `/Users/intiba/Downloads/eye_to_city_video_${Date.now()}.mp4`;
  const buf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log('SAVED:', out);
} else {
  console.log('Full result:', JSON.stringify(result, null, 2).slice(0, 2000));
}
