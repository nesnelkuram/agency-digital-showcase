import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('api/_lib', { recursive: true });

// ESM banner: create a CJS-compatible require() for dynamic require() calls
// that esbuild can't convert to import() (e.g. cheerio's require("buffer"))
// Also polyfill File for Node.js 18 (undici/cheerio needs it, available natively in Node.js 20+)
const esmBanner = `import { createRequire } from 'module'; import { Blob as _NodeBlob } from 'buffer'; const require = createRequire(import.meta.url); if (typeof globalThis.File === 'undefined') { globalThis.File = function File(bits, name, opts) { const b = new _NodeBlob(bits, opts); b.name = name; return b; }; globalThis.File.prototype = _NodeBlob.prototype; }`;

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  external: ['@vercel/node', '@google/genai'],
  minify: true,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
  loader: { '.json': 'json' },
  banner: { js: esmBanner },
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: ['src/pipeline/pipeline.ts'],
    outfile: 'api/_lib/pipeline-bundle.mjs',
  }),
  build({
    ...sharedOptions,
    entryPoints: ['src/persona/personaAgent.ts'],
    outfile: 'api/_lib/persona-bundle.mjs',
  }),
  build({
    ...sharedOptions,
    entryPoints: ['src/pipeline/geminiClient.ts'],
    outfile: 'api/_lib/gemini-bundle.mjs',
  }),
]);

console.log('Built api/_lib/pipeline-bundle.mjs, persona-bundle.mjs, gemini-bundle.mjs');
