import { build } from 'esbuild';

await build({
  entryPoints: ['src/pipeline/endpoint.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'api/analyze-brand-multi.js',
  external: ['@vercel/node', '@google/genai'],
  banner: { js: '// @vercel-bundled' },
  minify: false,
  sourcemap: false,
  mainFields: ['module', 'main'],
  conditions: ['import', 'module', 'default'],
});

console.log('Built api/analyze-brand-multi.js');
