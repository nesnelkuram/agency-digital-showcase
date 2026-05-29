// Re-uploads the optimized full videos to Vercel Blob, overwriting the
// existing objects at the SAME public URLs (videos/full/<name>.mp4) so the
// app's hardcoded URLs keep working — no code change needed.
//
// Usage:
//   1. Make sure BLOB_READ_WRITE_TOKEN is set (it lives in your Vercel project
//      env; you can export it locally for this run):
//        export BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx..."
//   2. node scripts/upload-optimized-videos.mjs
//
// It only reads from videos/full-optimized/ and writes to videos/full/<name>.
// Originals in videos/full/ are untouched locally.

import { put } from '@vercel/blob';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SRC_DIR = 'videos/full-optimized';
const BLOB_PREFIX = 'videos/full';

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('✗ BLOB_READ_WRITE_TOKEN is not set. Export it first, then re-run.');
  process.exit(1);
}

const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.mp4'));
if (files.length === 0) {
  console.error(`✗ No .mp4 files found in ${SRC_DIR}`);
  process.exit(1);
}

console.log(`Uploading ${files.length} optimized videos to Vercel Blob…\n`);

for (const name of files) {
  const data = await readFile(join(SRC_DIR, name));
  const pathname = `${BLOB_PREFIX}/${name}`;
  try {
    const { url } = await put(pathname, data, {
      access: 'public',
      contentType: 'video/mp4',
      addRandomSuffix: false, // keep the SAME URL the app already uses
      allowOverwrite: true,
      token,
      cacheControlMaxAge: 2592000,
    });
    console.log(`✓ ${pathname}  (${(data.length / 1048576).toFixed(1)} MB)  ${url}`);
  } catch (err) {
    console.error(`✗ ${pathname} — ${err.message}`);
  }
}

console.log('\nDone. Hard-reload the site (Cmd+Shift+R) to fetch the new files.');
