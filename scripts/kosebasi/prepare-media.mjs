import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = process.argv[2];
if (!source || !existsSync(source)) throw new Error('Usage: node scripts/kosebasi/prepare-media.mjs /absolute/path/to/source.mp4');
const destination = path.join(root, 'public/kosebasi/strateji/assets');
mkdirSync(destination, { recursive: true });
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', source], { encoding: 'utf8' });
const { width, height } = JSON.parse(probe.stdout).streams[0];
if (width !== 1920 || height !== 1080) throw new Error('This edit plan is for the supplied 1920×1080 film. Review crop and timecodes for a different source.');
function ffmpeg(args, name) {
  const result = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args, path.join(destination, name)], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Media generation failed: ${name}`);
  console.log(`Prepared ${name}`);
}
// Remove the source's baked-in 36px letterboxing before responsive object-fit.
for (const [name, start, duration, scale, quality] of [
  ['hero', 13, 11.5, 1440, 25], ['ustalik', 11, 4.2, 960, 24],
  ['sofra', 4, 3.5, 960, 24], ['bulusma', 15.3, 2.3, 960, 24],
]) ffmpeg(['-ss', String(start), '-i', source, '-t', String(duration), '-an', '-vf', `crop=1920:1008:0:36,scale=${scale}:-2`, '-c:v', 'libx264', '-preset', 'fast', '-crf', String(quality), '-movflags', '+faststart'], `${name}.mp4`);
for (const [name, time, scale] of [['hero', 22.2, 1440], ['ustalik', 11.9, 1280], ['sofra', 4.6, 1280], ['bulusma', 16.2, 1280], ['closing', 21.2, 1440]]) {
  ffmpeg(['-ss', String(time), '-i', source, '-frames:v', '1', '-vf', `crop=1920:1008:0:36,scale=${scale}:-2`, '-q:v', '2'], `${name}.jpg`);
}
ffmpeg(['-i', source, '-vf', 'crop=1920:1008:0:36,scale=1280:-2', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'], 'film.mp4');
