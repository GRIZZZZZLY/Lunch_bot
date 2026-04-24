/**
 * safeLocalStorage — защитная обёртка над window.localStorage.
 *
 * Зачем: CLAUDE.md явно запрещает кешировать polls в localStorage —
 * stale данные приводят к показу закрытых голосований. Эта обёртка:
 *  1. Пропускает только ключи из whitelist (точные имена + regex-паттерны).
 *  2. Запрещает любые ключи, содержащие "poll" / "pollId" / "vote_" префикс
 *     (кроме явно разрешённого vote_history_<userId>).
 *  3. В dev-режиме громко падает на неразрешённой записи.
 *  4. В prod молча игнорирует запись + Sentry breadcrumb (если подключён).
 */

const EXACT_KEYS: ReadonlySet<string> = new Set([
  // auth / session
  'auth_token',
  // onboarding
  'food_bot_onboarding_completed',
  'food_bot_onboarding_completed_version',
  // PWA
  'visitCount',
  'installPromptDismissed',
  // UI flags
  'donation-bar-dismissed',
  // caches (URLs/aggregates, НЕ poll-данные)
  'user_avatars_cache',
  // version tracking
  'CACHE_VERSION',
  'APP_VERSION',
  // app state (Zustand persist + React Query persist)
  'app-store',
  'TELEGRAM_FOOD_BOT_CACHE',
  // debug
  'debug',
]);

/**
 * Динамические ключи: имя_<userId>. Не должны содержать pollId.
 */
const PATTERN_KEYS: readonly RegExp[] = [
  /^admin_home_checklist_seen_\d+$/,
  /^user_streak_\d+$/,
  /^vote_history_\d+$/, // история голосов юзера, не активные polls
];

/**
 * Чёрный список — всегда блокируется, даже если случайно попадёт в whitelist.
 */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /poll/i, // блокирует любое упоминание poll (poll_, pollId, polls_)
];

const isDev =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

function isAllowed(key: string): boolean {
  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.test(key)) return false;
  }
  if (EXACT_KEYS.has(key)) return true;
  for (const pattern of PATTERN_KEYS) {
    if (pattern.test(key)) return true;
  }
  return false;
}

function reject(key: string, op: 'get' | 'set' | 'remove'): void {
  const message =
    `[safeLocalStorage] Forbidden ${op} on key "${key}". ` +
    `Add to EXACT_KEYS/PATTERN_KEYS in utils/safeLocalStorage.ts if intentional. ` +
    `Polls MUST NOT be cached in localStorage (CLAUDE.md).`;
  if (isDev) {
    throw new Error(message);
  }
  // prod: тихо игнорируем + breadcrumb
  if (typeof window !== 'undefined' && (window as { Sentry?: { addBreadcrumb: (b: unknown) => void } }).Sentry) {
    (window as { Sentry?: { addBreadcrumb: (b: unknown) => void } }).Sentry?.addBreadcrumb({
      category: 'safe-storage',
      level: 'warning',
      message,
    });
  }
}

export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    if (!isAllowed(key)) {
      reject(key, 'get');
      return null;
    }
    return window.localStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    if (!isAllowed(key)) {
      reject(key, 'set');
      return;
    }
    window.localStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    // remove разрешён всегда — нужен для cleanup мусорных ключей.
    window.localStorage.removeItem(key);
  },

  /**
   * Регистрация нового ключа в runtime — например, для тестов.
   * НЕ использовать в проде.
   */
  _allowKeyForTests(key: string): void {
    (EXACT_KEYS as Set<string>).add(key);
  },
};
