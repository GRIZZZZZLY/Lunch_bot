/* Единая точка управления темой (light/dark).
   Приоритет: ручной override (rl-theme) > Telegram colorScheme > prefers-color-scheme.
   Ровно одна подписка на themeChanged и одна на matchMedia — регистрируются
   в initThemeSync(); других подписчиков темы в приложении быть не должно. */
import { getThemeOverride, type Theme } from './appearance';
import { getWebApp, resyncTelegramChrome, type TelegramWebApp } from './telegram';

export function computeTheme(
  override: Theme | null,
  tgScheme: 'light' | 'dark' | null,
  prefersDark: boolean,
): Theme {
  if (override) return override;
  if (tgScheme) return tgScheme;
  return prefersDark ? 'dark' : 'light';
}

/** Применяет актуальную тему к <html> и синхронизирует шапку Telegram. */
export function applyThemeNow(): Theme {
  const wa = getWebApp();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = computeTheme(getThemeOverride(), wa?.colorScheme ?? null, prefersDark);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  // Палитра фиксированная (решение владельца 2026-07-19): подхват канваса из
  // Telegram theme variables удалён — фон детерминирован на всех клиентах.
  root.classList.remove('tg-synced');
  resyncTelegramChrome();
  return theme;
}

/** Подписывается на источники смены темы. Возвращает cleanup, снимающий обе подписки. */
export function initThemeSync(wa: TelegramWebApp | null = getWebApp()): () => void {
  const onChange = () => {
    applyThemeNow();
  };
  wa?.onEvent('themeChanged', onChange);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => {
    wa?.offEvent('themeChanged', onChange);
    mq.removeEventListener('change', onChange);
  };
}
