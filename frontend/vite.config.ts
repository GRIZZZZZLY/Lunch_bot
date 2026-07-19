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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/components/admin/**/*.tsx',
        'src/components/donation/DonationModal.tsx',
        'src/components/home/HomeEmptyStateCard.tsx',
        'src/components/polls/PollParticipantsAdminSection.tsx',
        'src/components/voting/InlineVotingCard.tsx',
        'src/components/voting/MultiWinnerResults.tsx',
        'src/hooks/useCurrentGroup.ts',
        'src/services/admin.service.ts',
        'src/services/category-order.service.ts',
        'src/services/donation.service.ts',
        'src/services/feedback.service.ts',
        'src/services/gamification.service.ts',
        'src/services/store-run.service.ts',
        'src/utils/chunkRecovery.ts',
        'src/utils/deepLinks.ts',
        'src/utils/versionCheck.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
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
          // API-ответы всегда берём из сети: голосования и расчёты нельзя
          // обслуживать устаревшими данными из service worker.
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkOnly',
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
