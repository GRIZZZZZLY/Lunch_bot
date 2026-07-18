import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemeNow, computeTheme, initThemeSync } from '../theme';
import type { TelegramWebApp } from '../telegram';

describe('computeTheme', () => {
  it('ручной override сильнее Telegram и системы', () => {
    expect(computeTheme('dark', 'light', false)).toBe('dark');
    expect(computeTheme('light', 'dark', true)).toBe('light');
  });

  it('без override действует схема Telegram', () => {
    expect(computeTheme(null, 'dark', false)).toBe('dark');
    expect(computeTheme(null, 'light', true)).toBe('light');
  });

  it('вне Telegram действует системная схема', () => {
    expect(computeTheme(null, null, true)).toBe('dark');
    expect(computeTheme(null, null, false)).toBe('light');
  });
});

interface FakeWebApp {
  wa: TelegramWebApp;
  handlers: Map<string, Set<() => void>>;
  setScheme: (s: 'light' | 'dark') => void;
}

function fakeWebApp(scheme: 'light' | 'dark'): FakeWebApp {
  const handlers = new Map<string, Set<() => void>>();
  const wa = {
    colorScheme: scheme,
    onEvent: (event: string, handler: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    offEvent: (event: string, handler: () => void) => {
      handlers.get(event)?.delete(handler);
    },
  } as unknown as TelegramWebApp;
  return {
    wa,
    handlers,
    setScheme: (s) => {
      (wa as { colorScheme: 'light' | 'dark' }).colorScheme = s;
    },
  };
}

function fakeMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  } as unknown as MediaQueryList;
  return { mql, listeners };
}

describe('initThemeSync / applyThemeNow', () => {
  let mm: ReturnType<typeof fakeMatchMedia>;

  beforeEach(() => {
    localStorage.clear();
    mm = fakeMatchMedia(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(mm.mql);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.Telegram;
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
  });

  it('регистрирует ровно одну подписку на themeChanged и одну на matchMedia', () => {
    const { wa, handlers } = fakeWebApp('dark');
    const cleanup = initThemeSync(wa);
    expect(handlers.get('themeChanged')?.size).toBe(1);
    expect(mm.listeners.size).toBe(1);
    cleanup();
    expect(handlers.get('themeChanged')?.size).toBe(0);
    expect(mm.listeners.size).toBe(0);
  });

  it('смена темы Telegram применяется к <html>', () => {
    const fake = fakeWebApp('dark');
    window.Telegram = { WebApp: fake.wa };
    const cleanup = initThemeSync(fake.wa);

    applyThemeNow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fake.setScheme('light');
    fake.handlers.get('themeChanged')!.forEach((fn) => fn());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    cleanup();
  });

  it('ручной override (rl-theme) не затирается событием Telegram', () => {
    localStorage.setItem('rl-theme', 'dark');
    const fake = fakeWebApp('light');
    window.Telegram = { WebApp: fake.wa };
    const cleanup = initThemeSync(fake.wa);

    fake.handlers.get('themeChanged')!.forEach((fn) => fn());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    cleanup();
  });

  it('после cleanup события больше не применяют тему', () => {
    const fake = fakeWebApp('dark');
    window.Telegram = { WebApp: fake.wa };
    const cleanup = initThemeSync(fake.wa);
    applyThemeNow();
    cleanup();

    fake.setScheme('light');
    fake.handlers.get('themeChanged')?.forEach((fn) => fn());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
