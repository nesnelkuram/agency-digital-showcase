import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createReviewMiddleware } from './studio/feedPlanner/review/server/reviewMiddleware';

/**
 * Yerel Instagram planlama İNCELEME çalışma alanı. Ana Studio uygulamasından ayrı:
 * .env okunmaz (envDir: false), Firebase/auth yok, yalnız loopback, yalnız fixture allowlist'i.
 *   FEED_REVIEW_CODEX_DIR, FEED_REVIEW_HISTORY_DIR: kaynak kök dizinler (süreç ortamından)
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const reviewRoot = path.join(here, 'studio/feedPlanner/review');

const reviewServer = (): Plugin => ({
  name: 'feed-planner-review-readonly',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(
      createReviewMiddleware({
        roots: {
          codex: process.env.FEED_REVIEW_CODEX_DIR,
          history: process.env.FEED_REVIEW_HISTORY_DIR,
        },
        fixturePath: path.join(reviewRoot, 'fixture.json'),
      }) as any,
    );
  },
});

export default defineConfig({
  root: reviewRoot,
  envDir: false,
  publicDir: false,
  plugins: [react(), reviewServer()],
  server: { host: '127.0.0.1', port: 5175, strictPort: true, fs: { allow: [here] } },
  build: { outDir: path.join(here, 'dist-review'), emptyOutDir: true },
});
