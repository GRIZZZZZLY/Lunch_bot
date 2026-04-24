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
  const isDark = wa.colorScheme === 'dark';
  const bg = isDark ? '#1f1712' : '#fbf7f1';
  try {
    wa.setBackgroundColor?.(bg);
    wa.setHeaderColor?.(bg);
  } catch {
    // older Telegram clients don't support these — fall back to CSS only
  }
}

export function initTelegramWebApp(): TelegramWebApp | null {
  const wa = getWebApp();
  if (!wa) return null;

  wa.ready();
  wa.expand();

  const theme = wa.colorScheme;
  document.documentElement.setAttribute('data-theme', theme);
  syncTelegramChrome(wa);

  wa.onEvent('themeChanged', () => {
    document.documentElement.setAttribute('data-theme', wa.colorScheme);
    syncTelegramChrome(wa);
  });

  return wa;
}

export function getInitData(): string {
  const wa = getWebApp();
  return wa?.initData ?? '';
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
