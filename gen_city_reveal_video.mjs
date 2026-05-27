import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fal } from '@fal-ai/client';
import fs from 'node:fs';

fal.config({ credentials: process.env.FAL_KEY });

const startPath = '/Users/intiba/Downloads/eye_video_lastframe.jpg';
const endPath = '/Users/intiba/Downloads/Grade.00_00_41_39546.Still005.jpg';

console.log('Uploading start (video last frame)...');
const startFile = new File([fs.readFileSync(startPath)], 'start.jpg', { type: 'image/jpeg' });
const startUrl = await fal.storage.upload(startFile);
console.log('  ->', startUrl);

console.log('Uploading end (city photo)...');
const endFile = new File([fs.readFileSync(endPath)], 'end.jpg', { type: 'image/jpeg' });
const endUrl = await fal.storage.upload(endFile);
console.log('  ->', endUrl);

const prompt = `Continuous forward camera motion. The golden city silhouette inside the iris gradually expands and fills the entire frame as the camera pushes through the eye into the cityscape. The golden glow softens into the natural warm tones of real street lamps, headlights and traffic. Buildings, rooftops, trees and urban texture become fully visible — the shot resolves into a photorealistic aerial night cityscape. Cinematic, photorealistic, single seamless shot, organic texture-to-texture transformation, soft light blending, no magic effects, no sparkles, no flares, 4K smooth dolly-in.`;

const ep = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
console.log('\nEndpoint:', ep);

const result = await fal.subscribe(ep, {
  input: {
    prompt,
    image_url: startUrl,
    tail_image_url: endUrl,
    duration: '5',
    aspect_ratio: '16:9',
    negative_prompt: 'magical effects, sparkles, lens flare, portal, fantasy, glow burst, particle effects, blurry, distorted, cartoon, stylized',
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

console.log('\n=== RESULT ===');
const videoUrl = result.data?.video?.url || result.video?.url;
console.log('Video URL:', videoUrl);

if (videoUrl) {
  const out = `/Users/intiba/Downloads/city_reveal_video_${Date.now()}.mp4`;
  const buf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log('SAVED:', out);
} else {
  console.log('Full result:', JSON.stringify(result, null, 2).slice(0, 2000));
}
