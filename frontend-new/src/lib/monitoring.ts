import * as Sentry from '@sentry/react';

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
  if (import.meta.env.DEV) {
    console.error('[monitoring]', error, context);
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  Sentry.captureMessage(message, context ? { extra: context } : undefined);
  if (import.meta.env.DEV) {
    console.warn('[monitoring]', message, context);
  }
}

export function identifyUser(user: { id?: string | number; username?: string } | null): void {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id !== undefined ? String(user.id) : undefined,
    username: user.username,
  });
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
