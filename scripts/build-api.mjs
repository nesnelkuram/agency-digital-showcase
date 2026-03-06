import { build } from 'esbuild';
import { readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join, relative } from 'path';

// Recursively find all .ts files under api/, excluding _lib and _bundles directories
function findFunctionFiles(dir, rootDir = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relPath = relative(rootDir, fullPath);

    // Skip library/bundle directories — these are not serverless functions
    if (entry === '_lib' || entry === '_bundles') continue;

    if (statSync(fullPath).isDirectory()) {
      // Skip marketing/_lib specifically
      if (relPath === 'marketing/_lib') continue;
      results.push(...findFunctionFiles(fullPath, rootDir));
    } else if (entry.endsWith('.ts') && !entry.startsWith('_')) {
      results.push(fullPath);
    }
  }
  return results;
}

const apiDir = 'api';
const functions = findFunctionFiles(apiDir);

console.log(`Found ${functions.length} API functions to bundle...`);

// ESM banner: create a CJS-compatible require() for dynamic require() calls
// that esbuild can't convert to import() (e.g. cheerio's require("buffer"))
// Also polyfill File for Node.js 18
const esmBanner = `import { createRequire } from 'module'; import { Blob as _NodeBlob } from 'buffer'; const require = createRequire(import.meta.url); if (typeof globalThis.File === 'undefined') { globalThis.File = function File(bits, name, opts) { const b = new _NodeBlob(bits, opts); b.name = name; return b; }; globalThis.File.prototype = _NodeBlob.prototype; }`;

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: ['@vercel/node'],
  minify: true,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  loader: { '.json': 'json' },
  banner: { js: esmBanner },
};

const startTime = Date.now();

await Promise.all(
  functions.map((fn) =>
    build({
      ...sharedOptions,
      entryPoints: [fn],
      outfile: fn.replace('.ts', '.mjs'),
    })
  )
);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`Bundled ${functions.length} functions in ${elapsed}s`);
functions.forEach((fn) => console.log(`  ✓ ${fn.replace('.ts', '.mjs')}`));

// Clean up .ts source files and _lib directories so Vercel only detects .mjs functions.
// This runs in Vercel's build environment (a copy), not the original repo.
if (process.env.VERCEL) {
  console.log('\nCleaning up .ts sources for Vercel deployment...');

  // Delete all .ts files in api/ (functions + _lib files)
  function deleteAllTs(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        deleteAllTs(fullPath);
      } else if (entry.endsWith('.ts')) {
        unlinkSync(fullPath);
      }
    }
  }
  deleteAllTs('api');

  // Remove _lib and _bundles directories
  for (const dir of ['api/_lib', 'api/_bundles', 'api/marketing/_lib']) {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('Cleaned up .ts sources and _lib directories.');
}
