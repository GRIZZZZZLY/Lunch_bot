import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa'; // Временно отключено
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA временно отключен для отладки (Service Worker мешает)
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
        rewrite: (path) => path, // Оставляем /api в пути
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Отключаем sourcemaps в production для уменьшения размера
    // Оптимизация для production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Удаляем console.log в production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Удаляем все console методы
        passes: 2, // Дополнительный проход для лучшего минифицирования
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
    },
    // Уменьшаем лимит для warning о размере chunk
    chunkSizeWarningLimit: 500,
    // Reportизм размера компонентов
    reportCompressedSize: true,
    rollupOptions: {
      external: [],
      output: {
        // Оптимизированный code splitting для лучшего кэширования
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // ВАЖНО: React ДОЛЖЕН быть в первом чанке, который загружается раньше всех
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler/')) {
              return 'react-core';
            }
            // React Router отдельно (зависит от react-core)
            if (id.includes('react-router') || id.includes('@remix-run/router')) {
              return 'react-router';
            }
            // Framer Motion отдельно (большая библиотека, зависит от react)
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            // React Query отдельно (зависит от react)
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            // Telegram SDK (не зависит от React)
            if (id.includes('@twa-dev/sdk')) {
              return 'telegram';
            }
            // UI библиотеки (зависят от React)
            if (id.includes('lucide-react') || id.includes('@radix-ui')) {
              return 'ui-libs';
            }
            // Утилиты (НЕ зависят от React)
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'utils';
            }
            // Form библиотеки (зависят от React)
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
              return 'forms';
            }
            // State + HTTP (НЕ зависят от React напрямую)
            if (id.includes('zustand') || id.includes('axios')) {
              return 'state-http';
            }
            // Все остальные vendor библиотеки (которые НЕ зависят от React)
            return 'vendor';
          }
        },
        // Именование chunk файлов для лучшего кэширования
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
    // CSS code splitting
    cssCodeSplit: true,
    // Оптимизация для загрузки
    assetsInlineLimit: 4096, // 4KB - файлы меньше будут инлайнится
  },
  // Оптимизация для dev server
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
    exclude: ['@storybook/*'], // Исключаем storybook из dev build
  },
  define: {
    // Telegram WebApp глобальные переменные
    __TELEGRAM_WEB_APP__: true,
  },
});
