/* Фасад мониторинга с синхронными сигнатурами поверх лениво загружаемого
   Sentry (см. lib/sentry.ts). Пока SDK едет, события копятся в очереди и
   отправляются после загрузки — иначе ошибки первых секунд, самые ценные,
   терялись бы ради экономии на критическом пути. */
import { loadSentry } from './sentry';

type SentryModule = typeof import('@sentry/react');
type Task = (sentry: SentryModule) => void;

/* Очередь ограничена: если DSN есть, а сеть не отдаёт SDK, буфер не должен
   расти бесконечно. Первые события ценнее последних — отбрасываем новые. */
const MAX_QUEUE = 50;
const queue: Task[] = [];
let sentry: SentryModule | null = null;
let requested = false;

function enqueue(task: Task): void {
  if (sentry) {
    task(sentry);
    return;
  }
  if (queue.length < MAX_QUEUE) queue.push(task);
  if (requested) return;
  requested = true;
  void loadSentry().then((mod) => {
    if (!mod) {
      queue.length = 0;
      return;
    }
    sentry = mod;
    for (const queued of queue.splice(0)) queued(mod);
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  enqueue((s) => s.captureException(error, context ? { extra: context } : undefined));
  if (import.meta.env.DEV) {
    console.error('[monitoring]', error, context);
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  enqueue((s) => s.captureMessage(message, context ? { extra: context } : undefined));
  if (import.meta.env.DEV) {
    console.warn('[monitoring]', message, context);
  }
}

export function identifyUser(user: { id?: string | number; username?: string } | null): void {
  if (!user) {
    enqueue((s) => s.setUser(null));
    return;
  }
  enqueue((s) =>
    s.setUser({
      id: user.id !== undefined ? String(user.id) : undefined,
      username: user.username,
    }),
  );
}

export function installGlobalHandlers(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, { source: 'window.onerror' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { source: 'unhandledrejection' });
  });
}
