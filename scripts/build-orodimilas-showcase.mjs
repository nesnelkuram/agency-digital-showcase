import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  absWorkingDir: root,
  entryPoints: ['scripts/orodimilas/bundle.js'],
  outfile: 'public/orodimilas/scene.bundle.js',
  bundle: true,
  format: 'esm',
  target: ['es2020'],
  minify: true,
  legalComments: 'eof',
  logLevel: 'info',
});
