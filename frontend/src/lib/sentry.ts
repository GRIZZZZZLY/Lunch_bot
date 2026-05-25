/**
 * Sentry Error Tracking Configuration
 * P1 Task: Error monitoring + Session replay
 */

import * as Sentry from '@sentry/react';

/**
 * Инициализация Sentry
 * Вызывается в main.tsx перед рендером приложения
 */
export function initSentry() {
  // Только в production
  if (import.meta.env.MODE !== 'production') {
    console.log('[Sentry] Disabled in development mode');
    return;
  }

  // Проверка наличия DSN
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    
    // Environment
    environment: import.meta.env.MODE, // 'production', 'development', 'staging'
    
    // P0-6: release tag = git SHA если задан VITE_GIT_COMMIT_SHA, иначе версия.
    // CI должен инжектить SHA в env при build: VITE_GIT_COMMIT_SHA=$GITHUB_SHA npm run build.
    release: `telegram-food-bot@${
      import.meta.env.VITE_GIT_COMMIT_SHA ||
      import.meta.env.VITE_APP_VERSION ||
      '1.0.0'
    }`,
    
    // Integrations
    integrations: [
      // Browser Tracing для performance monitoring. tracePropagationTargets
      // вынесен на уровень init (Sentry SDK v10) — там он распространяет
      // sentry-trace/baggage на fetch/XHR, что и нужно для end-to-end трейсов.
      Sentry.browserTracingIntegration(),

      // Session Replay для воспроизведения ошибок
      Sentry.replayIntegration({
        // Маскируем чувствительные данные
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),

      // React error boundary
      Sentry.browserProfilingIntegration(),
    ],

    // G0-3: Распространение sentry-trace/baggage на /api/* и наш домен.
    // Без этого server- и client-spans лежат в разных трейсах,
    // и end-to-end p95 «vote» собрать нельзя.
    tracePropagationTargets: [
      /^\//,
      /^https?:\/\/rocket-lunch\.duckdns\.org/,
      /^https?:\/\/[^/]+\/api\//,
    ],

    // Performance Monitoring
    // Трейсим 10% запросов (в production)
    tracesSampleRate: 0.1,

    // Session Replay
    // Записываем 10% нормальных сессий
    replaysSessionSampleRate: 0.1,
    // Записываем 100% сессий с ошибками
    replaysOnErrorSampleRate: 1.0,

    // Filtering errors
    beforeSend(event, hint) {
      // Игнорируем известные ошибки браузера
      const error = hint.originalException;
      
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        
        // Игнорируем Network errors (обрабатываем их отдельно)
        if (message.includes('Network Error') || message.includes('Failed to fetch')) {
          return null;
        }
        
        // Игнорируем ResizeObserver loop errors
        if (message.includes('ResizeObserver loop')) {
          return null;
        }
        
        // Игнорируем Telegram WebApp errors (специфичные для платформы)
        if (message.includes('Telegram') && message.includes('is not defined')) {
          return null;
        }
      }

      // Добавляем дополнительный контекст
      event.contexts = {
        ...event.contexts,
        app: {
          telegram_webapp: !!window.Telegram?.WebApp,
          user_agent: navigator.userAgent,
        },
      };

      return event;
    },

    // Ignore URLs (не трейсим внешние скрипты)
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'Network request failed',
    ],

    // Breadcrumbs для отладки
    beforeBreadcrumb(breadcrumb, hint) {
      // Логируем все API calls
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        return breadcrumb;
      }
      
      // Логируем клики
      if (breadcrumb.category === 'ui.click') {
        return breadcrumb;
      }
      
      // Логируем console errors/warnings
      if (breadcrumb.category === 'console' && breadcrumb.level === 'error') {
        return breadcrumb;
      }
      
      return breadcrumb;
    },
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Capture exception вручную
 * 
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureException(error, { extra: { pollId: 123 } });
 * }
 * ```
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
) {
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level || 'error',
  });
}

/**
 * Capture message (для логирования важных событий)
 * 
 * @example
 * ```ts
 * captureMessage('User completed onboarding', { level: 'info' });
 * ```
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
) {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context (после авторизации)
 * 
 * @example
 * ```ts
 * setUserContext({
 *   id: user.id,
 *   username: user.username,
 * });
 * ```
 */
export function setUserContext(user: {
  id: number | string;
  username?: string;
  email?: string;
}) {
  Sentry.setUser({
    id: String(user.id),
    username: user.username,
    email: user.email,
  });
}

/**
 * Clear user context (при выходе)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb для отладки
 * 
 * @example
 * ```ts
 * addBreadcrumb({
 *   category: 'voting',
 *   message: 'User voted for item 123',
 *   level: 'info',
 * });
 * ```
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Error Boundary компонент
 * Оборачиваем критичные части приложения
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

/**
 * Профилирование компонента (для performance debugging)
 * 
 * @example
 * ```tsx
 * export default withProfiler(VotingPage);
 * ```
 */
export const withProfiler = Sentry.withProfiler;
