import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
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
        // Оптимизированная стратегия разделения на чанки (11 chunks)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 1. React Core - ВСЁ что связано с React в ОДИН chunk
            // КРИТИЧНО: Никаких разделений React!
            if (id.includes('react')) {
              return 'react-vendor';
            }

            // 2. React Router - навигация (~80 KB)
            if (id.includes('@remix-run/router')) {
              return 'react-router';
            }

            // 3. React Query - data fetching (~80 KB)
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }

            // 4. Framer Motion - анимации (~100 KB)
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }

            // 5. UI Components - Radix UI + Lucide Icons (~120 KB)
            if (
              id.includes('@radix-ui') ||
              id.includes('lucide-react')
            ) {
              return 'ui-components';
            }

            // 6. Date utilities - date-fns (~50 KB)
            if (id.includes('date-fns')) {
              return 'date-fns';
            }

            // 7. React utilities - hooks, virtualization, etc (~50 KB)
            if (
              id.includes('react-window') ||
              id.includes('react-use') ||
              id.includes('react-swipeable') ||
              id.includes('react-confetti') ||
              id.includes('react-day-picker') ||
              id.includes('react-hook-form') ||
              id.includes('react-virtualized-auto-sizer')
            ) {
              return 'react-utils';
            }

            // 8. State + HTTP - zustand + axios (~40 KB)
            if (id.includes('axios') || id.includes('zustand')) {
              return 'state-http';
            }

            // 9. CSS utilities - clsx, tailwind-merge, etc (~20 KB)
            if (
              id.includes('clsx') ||
              id.includes('tailwind-merge') ||
              id.includes('class-variance-authority')
            ) {
              return 'css-utils';
            }

            // 10. Telegram SDK (~30 KB)
            if (id.includes('@twa-dev/sdk')) {
              return 'telegram-sdk';
            }

            // 11. Sentry - error tracking + session replay (~200-300 KB)
            if (id.includes('@sentry/')) {
              return 'sentry';
            }

            // 12. Charts - recharts (~100 KB)
            if (id.includes('recharts')) {
              return 'charts';
            }

            // 13. Validation - zod schemas (~50 KB)
            if (id.includes('zod')) {
              return 'validation';
            }

            // 14. Carousel - embla-carousel (~30-40 KB)
            if (id.includes('embla-carousel')) {
              return 'carousel';
            }

            // 15. UI extras - toast, drawer, command, sanitize (~40-50 KB)
            if (
              id.includes('sonner') ||
              id.includes('vaul') ||
              id.includes('cmdk') ||
              id.includes('dompurify') ||
              id.includes('localforage')
            ) {
              return 'ui-extras';
            }

            // Остальное в vendor
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
    // Vite 6+ требует JSON.stringify для всех значений в define
    __TELEGRAM_WEB_APP__: JSON.stringify(true),
  },
});
