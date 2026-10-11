import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createDietiDraftMiddleware, draftOptionsFromEnv } from './studio/devDraft/dietiDraftDevServer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      ...(mode === 'production' ? {
        esbuild: {
          drop: ['console', 'debugger'],
        },
      } : {}),
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@admin': path.resolve(__dirname, 'admin'),
          '@lib': path.resolve(__dirname, 'lib'),
          '@shared': path.resolve(__dirname, 'shared'),
          '@contexts': path.resolve(__dirname, 'contexts'),
        },
      },
      build: {
        target: 'es2020',
        rollupOptions: {
          output: {
            manualChunks: {
              'three-vendor': ['three'],
              'react-three': ['@react-three/fiber', '@react-three/drei'],
              'react-vendor': ['react', 'react-dom'],
              'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
              'reactflow-vendor': ['@xyflow/react'],
            },
          },
        },
        chunkSizeWarningLimit: 600,
        cssCodeSplit: true,
        sourcemap: false,
        assetsInlineLimit: 4096,
      },
      server: {
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:3000',
            changeOrigin: true,
          },
        },
      },
      plugins: [
        react(),
        {
          // Yalnız geliştirme: yerel Dieci taslak kaynağı (salt okunur, loopback). Build'e girmez.
          name: 'dieci-draft-dev-readonly',
          apply: 'serve',
          configureServer(server) {
            server.middlewares.use(createDietiDraftMiddleware(draftOptionsFromEnv(process.env)) as any);
          },
        },
        {
          name: 'kosebasi-showcase-static-route',
          configureServer(server) {
            server.middlewares.use((req, _res, next) => {
              const [pathname, query] = (req.url || '').split('?');
              if (pathname === '/kosebasi/strateji' || pathname === '/kosebasi/strateji/') {
                req.url = '/kosebasi/strateji/index.html' + (query ? `?${query}` : '');
              }
              next();
            });
          },
        },
        {
          name: 'export-research-static-routes',
          configureServer(server) {
            server.middlewares.use((req, _res, next) => {
              const [pathname, query] = (req.url || '').split('?');
              const routes: Record<string, string> = {
                '/ihracat': '/ihracat/index.html',
                '/ihracat/': '/ihracat/index.html',
                '/ihracat/gizlilik': '/ihracat/gizlilik.html',
              };
              if (routes[pathname]) req.url = routes[pathname] + (query ? `?${query}` : '');
              next();
            });
          },
        },
      ],
      optimizeDeps: {
        include: ['three', '@react-three/fiber', '@react-three/drei', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
      },
      // @ts-ignore — vitest config
      test: {
        environment: 'happy-dom',
        globals: true,
        include: ['**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
        exclude: ['node_modules', 'dist', '.claude/worktrees'],
      },
    };
});
