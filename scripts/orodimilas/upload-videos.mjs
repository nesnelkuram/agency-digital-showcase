// Oro di Milas sunumundaki web için kodlanmış portföy videolarını Vercel Blob'a yükler.
// Mevcut vitrin videolarının yanına (videos/full/) yeni adlarla eklenir; var olan dosyanın üzerine yazılmaz.
// Token .env.vercel.local içindeki BLOB_READ_WRITE_TOKEN'dan okunur ve hiçbir yere yazdırılmaz.
// Kullanım: node scripts/orodimilas/upload-videos.mjs
import { readFileSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { put, head } from '@vercel/blob';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = readFileSync(path.join(root, '.env.vercel.local'), 'utf8');
const token = envFile.match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)?.[1];
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN bulunamadı.');

const VIDEOS = [
  ['rakle.mp4', 'videos/full/018-web.mp4'],
  ['dieci-kitchen.mp4', 'videos/full/039-web.mp4'],
  ['dieci-dinner.mp4', 'videos/full/040-web.mp4'],
  ['dieci-sorular.mp4', 'videos/full/dieci-2026-v6-web.mp4'],
];

const results = {};
for (const [file, pathname] of VIDEOS) {
  const local = path.join(root, 'public/orodimilas/assets/video', file);
  const existing = await head(pathname, { token }).catch(() => null);
  if (existing) {
    if (existing.size !== statSync(local).size) throw new Error(`${pathname} zaten var ve farklı; üzerine yazılmadı.`);
    results[file] = existing.url;
    console.log(`zaten yüklü  ${pathname}`);
    continue;
  }
  const blob = await put(pathname, createReadStream(local), {
    access: 'public', token, addRandomSuffix: false, contentType: 'video/mp4', multipart: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  const check = await head(pathname, { token });
  if (check.size !== statSync(local).size) throw new Error(`${pathname} boyutu tutmuyor.`);
  results[file] = blob.url;
  console.log(`yüklendi     ${pathname}  ${(check.size / 1e6).toFixed(1)} MB`);
}
console.log(JSON.stringify(results, null, 2));
