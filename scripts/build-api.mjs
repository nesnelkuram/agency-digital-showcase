import { build } from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('api/_lib', { recursive: true });

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
});

console.log('Built api/_lib/pipeline-bundle.mjs');
