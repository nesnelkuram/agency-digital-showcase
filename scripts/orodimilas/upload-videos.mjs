// Oro di Milas sunumundaki web için kodlanmış portföy videolarını Vercel Blob'a yükler.
// Mevcut vitrin videolarının yanına (videos/full/) yeni adlarla eklenir; var olan dosyanın üzerine yazılmaz.
// Token .env.vercel.local içindeki BLOB_READ_WRITE_TOKEN'dan okunur ve hiçbir yere yazdırılmaz.
// Kullanım: node scripts/orodimilas/upload-videos.mjs <yerel.mp4> <videos/full/ad-web.mp4> [<yerel> <hedef> ...]
import { readFileSync, createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { put, head } from '@vercel/blob';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = readFileSync(path.join(root, '.env.vercel.local'), 'utf8');
const token = envFile.match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)?.[1];
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN bulunamadı.');

const args = process.argv.slice(2);
if (!args.length || args.length % 2) throw new Error('Yerel dosya ve hedef yol çiftler hâlinde verilmeli.');
const VIDEOS = [];
for (let i = 0; i < args.length; i += 2) {
  if (!args[i + 1].startsWith('videos/full/') || !args[i + 1].endsWith('.mp4')) throw new Error(`${args[i + 1]} videos/full/ altında bir .mp4 olmalı.`);
  VIDEOS.push([path.resolve(args[i]), args[i + 1]]);
}

const results = {};
for (const [local, pathname] of VIDEOS) {
  const file = path.basename(local);
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
