import { useEffect, useState, useMemo } from 'react';

// Mock Telegram WebApp для тестирования без Telegram
const createMockWebApp = () => ({
  initData: 'query_id=mock&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22username%22%3A%22testuser%22%7D',
  initDataUnsafe: {
    query_id: 'mock',
    user: {
      id: 123456789,
      first_name: 'Тест',
      last_name: 'Пользователь', 
      username: 'testuser',
      language_code: 'ru',
    },
  },
  version: '6.9',
  platform: 'web',
  colorScheme: 'light' as const,
  themeParams: {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#2481cc',
    button_color: '#2481cc',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f1f1f1',
  },
  isExpanded: true,
  viewportHeight: 600,
  viewportStableHeight: 600,
  MainButton: {
    text: 'CONTINUE',
    color: '#2481cc',
    textColor: '#ffffff',
    isVisible: false,
    isProgressVisible: false,
    isActive: true,
    setText: (text: string) => console.log('MainButton.setText:', text),
    onClick: (callback: () => void) => console.log('MainButton.onClick:', callback),
    show: () => console.log('MainButton.show'),
    hide: () => console.log('MainButton.hide'),
    enable: () => console.log('MainButton.enable'),
    disable: () => console.log('MainButton.disable'),
    showProgress: () => console.log('MainButton.showProgress'),
    hideProgress: () => console.log('MainButton.hideProgress'),
  },
  BackButton: {
    isVisible: false,
    onClick: (callback: () => void) => console.log('BackButton.onClick:', callback),
    show: () => console.log('BackButton.show'),
    hide: () => console.log('BackButton.hide'),
  },
  HapticFeedback: {
    impactOccurred: (style: string) => console.log('HapticFeedback.impactOccurred:', style),
    notificationOccurred: (type: string) => console.log('HapticFeedback.notificationOccurred:', type),
    selectionChanged: () => console.log('HapticFeedback.selectionChanged'),
  },
  showAlert: (message: string, callback?: () => void) => {
    console.log('WebApp.showAlert:', message);
    alert(message);
    callback?.();
  },
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => {
    console.log('WebApp.showConfirm:', message);
    const result = confirm(message);
    callback?.(result);
  },
  showPopup: (params: any, callback?: (buttonId: string) => void) => {
    console.log('WebApp.showPopup:', params);
    alert(params.message);
    callback?.('ok');
  },
  ready: () => console.log('WebApp.ready'),
  close: () => console.log('WebApp.close'),
  expand: () => console.log('WebApp.expand'),
  sendData: (data: string) => console.log('WebApp.sendData:', data),
  enableClosingConfirmation: () => console.log('WebApp.enableClosingConfirmation'),
  disableClosingConfirmation: () => console.log('WebApp.disableClosingConfirmation'),
});

const isMockMode = import.meta.env.VITE_USE_MOCK_API === 'true';

// Динамический импорт WebApp SDK или использование mock
let WebApp: any;

if (isMockMode) {
  console.log('📱 Telegram WebApp: Using MOCK mode (VITE_USE_MOCK_API=true)');
  WebApp = createMockWebApp();
} else if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
  console.warn('⚠️ Telegram WebApp SDK not found! Make sure you opened this app inside Telegram.');
  console.warn('📝 window.Telegram:', window.Telegram);
  console.warn('📝 Using mock data for development...');
  WebApp = createMockWebApp();
} else {
  console.log('✅ Telegram WebApp SDK loaded successfully');
  const tgWebApp = window.Telegram.WebApp as any;
  console.log('📱 User:', tgWebApp.initDataUnsafe?.user);
  console.log('📱 initData length:', tgWebApp.initData?.length || 0);
  WebApp = tgWebApp;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

export interface UseTelegramReturn {
  webApp: typeof WebApp;
  user: TelegramUser | null;
  initData: string;
  initDataUnsafe: any;
  isReady: boolean;
  colorScheme: 'light' | 'dark';
  themeParams: typeof WebApp.themeParams;
  mainButton: typeof WebApp.MainButton;
  backButton: typeof WebApp.BackButton;
  hapticFeedback: typeof WebApp.HapticFeedback;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  close: () => void;
  expand: () => void;
  sendData: (data: string) => void;
  ready: () => void;
}

/**
 * Хук для работы с Telegram WebApp
 */
export const useTelegram = (): UseTelegramReturn => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Инициализация WebApp
    WebApp.ready();
    
    // Расширяем приложение на весь экран
    WebApp.expand();
    
    // Включаем закрытие по свайпу
    WebApp.enableClosingConfirmation();

    setIsReady(true);

    // Очистка при размонтировании
    return () => {
      WebApp.disableClosingConfirmation();
    };
  }, []);

  const user = useMemo(() => {
    return WebApp.initDataUnsafe.user || null;
  }, []);

  const showAlert = useMemo(() => (message: string, callback?: () => void) => {
    WebApp.showAlert(message, callback);
  }, []);

  const showConfirm = useMemo(() => (message: string, callback?: (confirmed: boolean) => void) => {
    WebApp.showConfirm(message, callback);
  }, []);

  const showPopup = useMemo(() => (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{
        id?: string;
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
        text: string;
      }>;
    }, 
    callback?: (buttonId: string) => void
  ) => {
    WebApp.showPopup(params, callback);
  }, []);

  const close = useMemo(() => () => {
    WebApp.close();
  }, []);

  const expand = useMemo(() => () => {
    WebApp.expand();
  }, []);

  const sendData = useMemo(() => (data: string) => {
    WebApp.sendData(data);
  }, []);

  const ready = useMemo(() => () => {
    WebApp.ready();
  }, []);

  return {
    webApp: WebApp,
    user,
    initData: WebApp.initData,
    initDataUnsafe: WebApp.initDataUnsafe,
    isReady,
    colorScheme: WebApp.colorScheme,
    themeParams: WebApp.themeParams,
    mainButton: WebApp.MainButton,
    backButton: WebApp.BackButton,
    hapticFeedback: WebApp.HapticFeedback,
    showAlert,
    showConfirm,
    showPopup,
    close,
    expand,
    sendData,
    ready,
  };
};
