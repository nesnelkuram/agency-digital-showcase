import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      esbuild: {
        drop: ['console', 'debugger'],
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
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
      optimizeDeps: {
        include: ['three', '@react-three/fiber', '@react-three/drei', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
      },
      plugins: [
        react(),
      ],
    };
});
