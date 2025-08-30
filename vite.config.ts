import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
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
            },
          },
        },
        chunkSizeWarningLimit: 600,
        cssCodeSplit: true,
        sourcemap: false,
        assetsInlineLimit: 4096,
      },
      optimizeDeps: {
        include: ['three', '@react-three/fiber', '@react-three/drei'],
      },
      plugins: [
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
