import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('api/_lib', { recursive: true });

// ESM banner: create a CJS-compatible require() for dynamic require() calls
// that esbuild can't convert to import() (e.g. cheerio's require("buffer"))
// Also polyfill File for Node.js 18 (undici/cheerio needs it, available natively in Node.js 20+)
const esmBanner = `import { createRequire } from 'module'; const require = createRequire(import.meta.url); if (typeof globalThis.File === 'undefined') { const { Blob: _B } = await import('buffer'); globalThis.File = function File(bits, name, opts) { const b = new _B(bits, opts); b.name = name; return b; }; globalThis.File.prototype = _B.prototype; }`;

// Pipeline bundle (existing)
await build({
  entryPoints: ['src/pipeline/pipeline.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'api/_lib/pipeline-bundle.mjs',
  external: ['@vercel/node', '@google/genai'],
  minify: false,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  loader: { '.json': 'json' },
  banner: { js: esmBanner },
});

console.log('Built api/_lib/pipeline-bundle.mjs');

// Persona bundle (new) — includes enrichedArticles.json via JSON loader
await build({
  entryPoints: ['src/persona/personaAgent.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'api/_lib/persona-bundle.mjs',
  external: ['@vercel/node', '@google/genai'],
  minify: false,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  loader: { '.json': 'json' },
  banner: { js: esmBanner },
});

console.log('Built api/_lib/persona-bundle.mjs');

// Gemini client bundle — used by workflow design-chat
await build({
  entryPoints: ['src/pipeline/geminiClient.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'api/_lib/gemini-bundle.mjs',
  external: ['@vercel/node', '@google/genai'],
  minify: false,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  loader: { '.json': 'json' },
  banner: { js: esmBanner },
});

console.log('Built api/_lib/gemini-bundle.mjs');
