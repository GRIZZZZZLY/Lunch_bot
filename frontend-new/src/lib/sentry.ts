/* Sentry грузится динамически и только при заданном DSN.
   Статический импорт клал SDK на критический путь каждому пользователю —
   включая тех, у кого мониторинг вообще не настроен. Загрузку откладываем до
   простоя: отчёт об ошибке не обязан конкурировать с первой отрисовкой. */
type SentryModule = typeof import('@sentry/react');

let loader: Promise<SentryModule | null> | null = null;

function dsn(): string | undefined {
  return import.meta.env.VITE_SENTRY_DSN as string | undefined;
}

async function importAndInit(): Promise<SentryModule | null> {
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: dsn(),
      environment: import.meta.env.MODE,
      release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? undefined,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
    });
    return Sentry;
  } catch {
    // Мониторинг не должен ронять приложение, ради которого он существует.
    return null;
  }
}

/** Модуль Sentry или null, если DSN не задан. Идемпотентно. */
export function loadSentry(): Promise<SentryModule | null> {
  if (!dsn()) return Promise.resolve(null);
  loader ??= importAndInit();
  return loader;
}

/** Ставит загрузку в очередь на простой, не блокируя первую отрисовку. */
export function initSentry(): void {
  if (!dsn()) {
    if (import.meta.env.DEV) {
      console.info('[sentry] DSN not set, skipping init');
    }
    return;
  }
  const start = () => void loadSentry();
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 3000 });
  } else {
    window.setTimeout(start, 1500);
  }
}
