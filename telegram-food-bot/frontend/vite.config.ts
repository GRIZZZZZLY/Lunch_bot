import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      // КРИТИЧНО: НЕ включать index.html в precache!
      injectManifest: {
        globPatterns: ['**/*.{js,css,png,jpg,jpeg,svg,gif,webp,woff,woff2}'], // БЕЗ html!
      },
      manifest: {
        name: 'Rocket Lunch - Telegram Food Bot',
        short_name: 'Rocket Lunch',
        description: 'Организация обедов и голосований в Telegram',
        theme_color: '#0088cc',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: []  // Временно отключено до создания иконок
      },
      workbox: {
        // Исключить большие файлы из precache (stats.html для bundle analysis)
        globIgnores: ['**/stats.html', '**/*.map'],
        // Стратегии кэширования
        runtimeCaching: [
          // API запросы - Network First (сначала сеть, потом кэш)
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 минут
              },
              networkTimeoutSeconds: 10,
            }
          },
          // HTML файлы - Network First с коротким timeout (всегда обновляются)
          {
            urlPattern: /\.html$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60, // 1 минута
              },
              networkTimeoutSeconds: 3,
            }
          },
          // JS и CSS - Network First с коротким кешем (для быстрого обновления)
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 30, // 30 минут (короче для частых обновлений)
              },
              networkTimeoutSeconds: 5,
            }
          },
          // Статические ресурсы - Cache First (сначала кэш, потом сеть)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 дней
              }
            }
          },
          // Шрифты - Cache First
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 год
              }
            }
          }
        ],
        // Очистка устаревших кэшей
        cleanupOutdatedCaches: true,
        // Кэшировать все навигационные запросы с Network First
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Принудительно обновлять SW при изменении assets
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false, // Отключить в dev режиме чтобы не мешало отладке
        type: 'module'
      }
    }),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }) as any,
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
    // КРИТИЧНО: Гарантируем использование только одной версии React
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
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
    sourcemap: false, // Production: отключаем sourcemaps (безопасность + размер)
    // Оптимизация для production
    minify: 'terser', // Production: включаем минификацию
    terserOptions: {
      compress: {
        drop_console: true, // Удаляем console.log в production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'], // Удаляем все console методы
        passes: 2, // Безопасное количество проходов (откатили с 3 до 2 из-за ReferenceError)
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
    },
    // Лимит для warning о размере chunk. Поднят с 500 → 700 после vendor split:
    // вендор разрезан на 8+ chunk'ов, ни один не должен превышать 700 KB raw.
    chunkSizeWarningLimit: 700,
    // Reportизм размера компонентов
    reportCompressedSize: true,
    rollupOptions: {
      external: [],
      // Принудительно используем одну версию React
      onwarn(warning, warn) {
        // Игнорируем warnings о дублировании React
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
      output: {
        // Safe chunk splitting - tested to avoid circular dependencies.
        // Стратегия: режем vendor (был 653 KB) на доменные группы; каждая
        // загружается отдельно и кешируется браузером независимо. Меняется
        // одна зависимость — переинвалидируется только её chunk, остальные
        // остаются в кеше.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const path = id.replace(/\\/g, '/');

          // Lazy heavy — грузится только когда нужно
          if (path.includes('/recharts/')) return 'charts';
          if (path.includes('/react-confetti/') || path.includes('/canvas-confetti/')) return 'confetti';
          if (path.includes('/embla-carousel') || path.includes('/react-day-picker/') || path.includes('/react-window')) return 'carousel-window';

          // Animation
          if (path.includes('/framer-motion/')) return 'animations';

          // UI primitives
          if (path.includes('/@radix-ui/')) return 'ui-libs';
          if (path.includes('/lucide-react/')) return 'icons';
          if (path.includes('/sonner/') || path.includes('/vaul/') || path.includes('/cmdk/')) return 'ui-extras';

          // Data layer
          if (path.includes('/@tanstack/')) return 'query-libs';
          if (path.includes('/zustand/') || path.includes('/localforage/')) return 'state';

          // Networking
          if (path.includes('/axios/')) return 'http';

          // Forms + validation
          if (
            path.includes('/react-hook-form/') ||
            path.includes('/@hookform/') ||
            path.includes('/zod/') ||
            path.includes('/@autoform/')
          ) {
            return 'forms';
          }

          // Date
          if (path.includes('/date-fns/')) return 'dates';

          // Security / sanitize
          if (path.includes('/dompurify/')) return 'sanitize';

          // Telegram SDK
          if (path.includes('/@twa-dev/') || path.includes('/@telegram-apps/')) return 'telegram-sdk';

          // Sentry
          if (path.includes('/@sentry/') || path.includes('/web-vitals/')) return 'observability';

          // React core (must include scheduler + jsx-runtime для dedupe)
          if (
            path.endsWith('/react/index.js') ||
            path.includes('/react/jsx-runtime') ||
            path.includes('/react/jsx-dev-runtime') ||
            path.includes('/react-dom/') ||
            path.includes('/scheduler/') ||
            path.includes('/react/cjs/')
          ) {
            return 'react-core';
          }
          if (path.includes('/react-router') || path.includes('/@remix-run/')) return 'router';

          // Микро-утилиты — пусть лежат вместе чтоб не плодить чанки
          if (
            path.includes('/clsx/') ||
            path.includes('/tailwind-merge/') ||
            path.includes('/class-variance-authority/') ||
            path.includes('/react-swipeable/') ||
            path.includes('/react-virtualized-auto-sizer/')
          ) {
            return 'utils';
          }

          // Остальное — Vite решает сам (избегаем circular deps от catch-all)
          return undefined;
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
    exclude: [
      '@storybook/*',
      '@tanstack/react-query-devtools', // Exclude devtools from optimization
      'lucide-react', // Exclude для лучшего tree-shaking в production
    ],
  },
  define: {
    // Telegram WebApp глобальные переменные
    // Vite 6+ требует JSON.stringify для всех значений в define
    __TELEGRAM_WEB_APP__: JSON.stringify(true),
  },
});
