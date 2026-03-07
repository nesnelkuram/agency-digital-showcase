import { build } from 'esbuild';
import { readdirSync, statSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join, relative, basename } from 'path';

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
  external: ['@vercel/node', 'firebase-admin', 'firebase-admin/app', 'firebase-admin/firestore', 'firebase-admin/auth'],
  allowOverwrite: true,
  minify: true,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  loader: { '.json': 'json' },
  banner: { js: esmBanner },
};

const startTime = Date.now();

// Step 1: Build intermediate bundles that function files import from.
// These .mjs files must exist before esbuild can resolve imports in the function files.
mkdirSync('api/_lib', { recursive: true });
mkdirSync('api/_bundles', { recursive: true });

const intermediateOpts = { ...sharedOptions, external: ['@vercel/node', '@google/genai'] };

await Promise.all([
  build({
    ...intermediateOpts,
    entryPoints: ['src/pipeline/pipeline.ts'],
    outfile: 'api/_bundles/pipeline-bundle.mjs',
  }),
  build({
    ...intermediateOpts,
    entryPoints: ['src/persona/personaAgent.ts'],
    outfile: 'api/_bundles/persona-bundle.mjs',
  }),
  build({
    ...intermediateOpts,
    entryPoints: ['src/pipeline/geminiClient.ts'],
    outfile: 'api/_lib/gemini-bundle.mjs',
  }),
]);
console.log('Built intermediate bundles (pipeline, persona, gemini)');

// Step 2: Bundle all 49 function files — each becomes a self-contained .mjs.
// Intermediate bundles get inlined since they're not in externals.
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

// Replace each .ts function with a thin re-export wrapper pointing to its .mjs bundle.
// NFT traces the wrapper → finds only one .mjs import → no heavy dependency tree to trace.
// This runs in Vercel's build environment (a copy), not the original repo.
if (process.env.VERCEL) {
  console.log('\nReplacing .ts functions with thin re-export wrappers...');

  for (const fn of functions) {
    const mjsName = basename(fn).replace('.ts', '.mjs');
    const wrapper = `export { default } from './${mjsName}';\n`;
    writeFileSync(fn, wrapper);
  }

  // Remove _lib and _bundles directories — no longer needed after bundling
  for (const dir of ['api/_lib', 'api/_bundles', 'api/marketing/_lib']) {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('Done. Each .ts is now a thin wrapper around its .mjs bundle.');
}
