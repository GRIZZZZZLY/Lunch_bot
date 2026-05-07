import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * PRODUCTION-DEV MODE
 *
 * Гибридная конфигурация для разработки с production-like окружением:
 * - Production оптимизация кода (минификация, code splitting)
 * - НО оставляем console.log для отладки
 * - НО добавляем source maps для отладки
 * - Watch mode включается через CLI: `vite build --watch --config vite.config.prod-dev.ts`
 * - Используется для тестирования production build локально
 */
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/styles': path.resolve(__dirname, './src/styles'),
    },
    // Гарантируем использование только одной версии React
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
  build: {
    outDir: 'dist',
    // ✅ ВКЛЮЧАЕМ source maps для отладки (но в финальном production - отключить)
    sourcemap: true,
    // ⚠️ ИСПОЛЬЗУЕМ esbuild минификацию (безопаснее чем отключать полностью)
    minify: 'esbuild',
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/recharts/') || id.includes('\\recharts\\')) {
              return 'charts';
            }
            if (id.includes('/framer-motion/') || id.includes('\\framer-motion\\')) {
              return 'animations';
            }
            if (id.includes('/@radix-ui/') || id.includes('\\@radix-ui\\')) {
              return 'ui-libs';
            }
            if (id.includes('/@tanstack/react-query') || id.includes('\\@tanstack\\react-query')) {
              return 'query-libs';
            }
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          } else if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[ext]/[name]-[hash][extname]`;
        },
      },
    },
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      '@tanstack/react-query',
      'zustand',
      'axios',
      'react-window',
      'react-virtualized-auto-sizer',
    ],
    exclude: ['@storybook/*'],
  },
  define: {
    // Vite 6+ требует JSON.stringify для всех значений в define
    __TELEGRAM_WEB_APP__: JSON.stringify(true),
  },
});
