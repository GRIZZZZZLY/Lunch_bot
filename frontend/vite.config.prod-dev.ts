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
    minify: 'terser',
    terserOptions: {
      compress: {
        // ⚠️ НЕ удаляем console.log в prod-dev режиме!
        drop_console: false, // ← Оставляем для отладки
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
    rollupOptions: {
      external: [],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler/')) {
              return 'react-core';
            }
            if (id.includes('react-router') || id.includes('@remix-run/router')) {
              return 'react-router';
            }
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            if (id.includes('@twa-dev/sdk')) {
              return 'telegram';
            }
            if (id.includes('lucide-react') || id.includes('@radix-ui')) {
              return 'ui-libs';
            }
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'utils';
            }
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
              return 'forms';
            }
            if (id.includes('zustand') || id.includes('axios')) {
              return 'state-http';
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
    __TELEGRAM_WEB_APP__: true,
  },
});
