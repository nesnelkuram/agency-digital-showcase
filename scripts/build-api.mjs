import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('api/_lib', { recursive: true });

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
});

console.log('Built api/_lib/persona-bundle.mjs');
