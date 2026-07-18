import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeSafeArea, initViewportSync } from '../viewport';
import type { TelegramWebApp } from '../telegram';

function fakeWebApp(overrides: Partial<TelegramWebApp>) {
  const handlers = new Map<string, Set<() => void>>();
  const wa = {
    onEvent: (event: string, fn: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    },
    offEvent: (event: string, fn: () => void) => {
      handlers.get(event)?.delete(fn);
    },
    ...overrides,
  } as unknown as TelegramWebApp;
  return { wa, handlers };
}

describe('computeSafeArea', () => {
  it('null без Telegram и без инсетов', () => {
    expect(computeSafeArea(null)).toBeNull();
    expect(computeSafeArea(fakeWebApp({}).wa)).toBeNull();
  });

  it('суммирует инсеты устройства и интерфейса Telegram', () => {
    const { wa } = fakeWebApp({
      safeAreaInset: { top: 47, bottom: 34, left: 0, right: 0 },
      contentSafeAreaInset: { top: 46, bottom: 0, left: 0, right: 0 },
    });
    expect(computeSafeArea(wa)).toEqual({ top: 93, bottom: 34, left: 0, right: 0 });
  });
});

describe('initViewportSync', () => {
  const root = document.documentElement;

  beforeEach(() => {
    root.style.cssText = '';
  });
  afterEach(() => {
    root.style.cssText = '';
  });

  it('выставляет CSS-переменные и подписывается на изменения с cleanup', () => {
    const { wa, handlers } = fakeWebApp({
      safeAreaInset: { top: 10, bottom: 20, left: 0, right: 0 },
      viewportStableHeight: 640,
    });

    const cleanup = initViewportSync(wa);
    expect(root.style.getPropertyValue('--safe-area-top')).toBe('10px');
    expect(root.style.getPropertyValue('--safe-area-bottom')).toBe('20px');
    expect(root.style.getPropertyValue('--viewport-stable-height')).toBe('640px');

    expect(handlers.get('viewportChanged')?.size).toBe(1);
    expect(handlers.get('safeAreaChanged')?.size).toBe(1);
    expect(handlers.get('contentSafeAreaChanged')?.size).toBe(1);

    cleanup();
    expect(handlers.get('viewportChanged')?.size).toBe(0);
    expect(handlers.get('safeAreaChanged')?.size).toBe(0);
    expect(handlers.get('contentSafeAreaChanged')?.size).toBe(0);
  });

  it('вне Telegram — no-op, CSS-переменные не переопределяются (работает env() fallback)', () => {
    const cleanup = initViewportSync(null);
    expect(root.style.getPropertyValue('--safe-area-bottom')).toBe('');
    cleanup();
  });
});
