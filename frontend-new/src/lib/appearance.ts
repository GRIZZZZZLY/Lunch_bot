/* Appearance control. Схема одна — «Графит и мёд» (редизайн 2026-07),
   осталась только тема (light/dark) на <html data-theme>.
   Persisted in localStorage; theme override beats Telegram/system preference. */
import { resyncTelegramChrome } from './telegram';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'rl-theme';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}

export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Persisted manual theme override, if the user has chosen one. */
export function getThemeOverride(): Theme | null {
  const t = safeGet(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : null;
}

export function setTheme(t: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.classList.toggle('dark', t === 'dark');
  safeSet(THEME_KEY, t);
  resyncTelegramChrome();
}
