import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
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
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
          },
        },
        rollupOptions: {
          output: {
            manualChunks: {
              'three-vendor': ['three'],
              'react-three': ['@react-three/fiber', '@react-three/drei'],
              'react-vendor': ['react', 'react-dom'],
              'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            },
          },
        },
        chunkSizeWarningLimit: 600,
        cssCodeSplit: true,
        sourcemap: false,
        assetsInlineLimit: 4096,
      },
      optimizeDeps: {
        include: ['three', '@react-three/fiber', '@react-three/drei', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
      },
      plugins: [
        react(),
        viteCompression({
          verbose: true,
          disable: false,
          threshold: 10240,
          algorithm: 'gzip',
          ext: '.gz',
        }),
        viteCompression({
          verbose: true,
          disable: false,
          threshold: 10240,
          algorithm: 'brotliCompress',
          ext: '.br',
        }),
      ],
    };
});
