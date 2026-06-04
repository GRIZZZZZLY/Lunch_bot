/* Appearance control for the redesign-v2 system.
   Scheme (a/b/c) + theme (light/dark) resolve on <html data-scheme data-theme>.
   Persisted in localStorage; theme override beats Telegram/system preference. */
export type Scheme = 'a' | 'b' | 'c';
export type Theme = 'light' | 'dark';

const SCHEME_KEY = 'rl-scheme';
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

export function getScheme(): Scheme {
  const s = safeGet(SCHEME_KEY);
  return s === 'b' || s === 'c' ? s : 'a';
}

export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Persisted manual theme override, if the user has chosen one. */
export function getThemeOverride(): Theme | null {
  const t = safeGet(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : null;
}

export function setScheme(s: Scheme): void {
  document.documentElement.setAttribute('data-scheme', s);
  safeSet(SCHEME_KEY, s);
}

export function setTheme(t: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.classList.toggle('dark', t === 'dark');
  safeSet(THEME_KEY, t);
}
