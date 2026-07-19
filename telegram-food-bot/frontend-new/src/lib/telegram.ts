export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  /** Bot API 8.0+: инсеты устройства и интерфейса Telegram (могут отсутствовать). */
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  /** Bot API 7.7+: управление системным жестом «свайп вниз сворачивает Mini App». */
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isVerticalSwipesEnabled?: boolean;
  headerColor: string;
  backgroundColor: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null;
}

function syncTelegramChrome(wa: TelegramWebApp) {
  // Match Telegram chrome to the active redesign scheme/theme (--bg-base),
  // so the app background is seamless with the Mini App header.
  const tokenBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = /^#[0-9a-fA-F]{6}$/.test(tokenBg) ? tokenBg : isDark ? '#16161a' : '#f3f5f7';
  try {
    wa.setBackgroundColor?.(bg);
    wa.setHeaderColor?.(bg);
  } catch {
    // older Telegram clients don't support these — fall back to CSS only
  }
}

/** Re-sync Telegram header/background after an in-app scheme/theme change. */
export function resyncTelegramChrome(): void {
  const wa = getWebApp();
  if (wa) syncTelegramChrome(wa);
}

export function initTelegramWebApp(): TelegramWebApp | null {
  const wa = getWebApp();
  if (!wa) return null;

  wa.ready();
  wa.expand();

  // Системный свайп-вниз сворачивает весь Mini App — конфликтует со скроллом
  // списков и drag-to-dismiss шторки. Отключаем (Bot API 7.7+); свернуть
  // приложение по-прежнему можно стрелкой в шапке Telegram. На старых
  // клиентах метода нет — жест шторки деградирует в snap-back (pointercancel).
  wa.disableVerticalSwipes?.();

  // Тема (data-theme, подписка на themeChanged) живёт в lib/theme.ts —
  // единственном владельце темы; здесь только жизненный цикл Mini App.
  return wa;
}

export function getInitData(): string {
  const wa = getWebApp();
  if (wa?.initData) return wa.initData;
  // Dev-only: when running outside Telegram, allow a stub initData so the app can
  // authenticate against a local backend started with SKIP_TELEGRAM_VALIDATION=true.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_INIT_DATA) {
    return import.meta.env.VITE_DEV_INIT_DATA as string;
  }
  return '';
}

export function getCurrentUser(): TelegramUser | null {
  const wa = getWebApp();
  return wa?.initDataUnsafe.user ?? null;
}

export function getStartParam(): string | null {
  const wa = getWebApp();
  return wa?.initDataUnsafe.start_param ?? null;
}

export function getDeepLinkPollId(): number | null {
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('pollId');
    if (fromUrl) {
      const n = Number(fromUrl);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const param = getStartParam();
  if (!param) return null;
  const cleaned = param.startsWith('vote_') ? param.slice(5) : param;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}
