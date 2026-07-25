import type { BrowserContext, Page } from '@playwright/test';

export interface TelegramCall {
  method: string;
  args: unknown[];
}

export interface TelegramMockOptions {
  initData: string;
  colorScheme?: 'light' | 'dark';
  startParam?: string;
  userId?: number;
}

export async function installTelegramMock(
  context: BrowserContext,
  options: TelegramMockOptions,
): Promise<void> {
  await context.route('https://telegram.org/js/telegram-web-app.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    }),
  );
  await context.addInitScript((input) => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const eventHandlers = new Map<string, Set<() => void>>();
    const mainHandlers = new Set<() => void>();
    const backHandlers = new Set<() => void>();
    const record = (method: string, ...args: unknown[]) => calls.push({ method, args });
    const emit = (event: string) => eventHandlers.get(event)?.forEach((handler) => handler());

    class MockEventSource {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSED = 2;
      readonly url: string;
      readonly withCredentials = false;
      readyState = 1;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

      constructor(url: string | URL) {
        this.url = String(url);
        record('EventSource', this.url);
        queueMicrotask(() => this.dispatchEvent(new Event('connected')));
      }

      addEventListener(type: string, callback: EventListenerOrEventListenerObject | null) {
        if (!callback) return;
        const set = this.listeners.get(type) ?? new Set();
        set.add(callback);
        this.listeners.set(type, set);
      }

      removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null) {
        if (callback) this.listeners.get(type)?.delete(callback);
      }

      dispatchEvent(event: Event): boolean {
        this.listeners.get(event.type)?.forEach((listener) => {
          if (typeof listener === 'function') listener(event);
          else listener.handleEvent(event);
        });
        return true;
      }

      close() {
        this.readyState = 2;
        record('EventSource.close', this.url);
      }
    }

    const webApp = {
      initData: input.initData,
      initDataUnsafe: {
        user: {
          id: input.userId ?? 700000101,
          first_name: 'Анна',
          last_name: 'Тестова',
          username: 'anna_e2e',
          language_code: 'ru',
        },
        auth_date: 1_900_000_000,
        hash: 'e2e',
        start_param: input.startParam,
      },
      colorScheme: input.colorScheme ?? 'light',
      themeParams: {
        bg_color: '#f3f5f7',
        text_color: '#17191c',
        hint_color: '#747b85',
        button_color: '#e06b32',
        button_text_color: '#ffffff',
        secondary_bg_color: '#ffffff',
      },
      isExpanded: true,
      viewportHeight: 844,
      viewportStableHeight: 844,
      safeAreaInset: { top: 0, bottom: 20, left: 0, right: 0 },
      contentSafeAreaInset: { top: 0, bottom: 20, left: 0, right: 0 },
      isVerticalSwipesEnabled: true,
      headerColor: '#f3f5f7',
      backgroundColor: '#f3f5f7',
      ready: () => record('ready'),
      expand: () => record('expand'),
      close: () => record('close'),
      disableVerticalSwipes: () => {
        webApp.isVerticalSwipesEnabled = false;
        record('disableVerticalSwipes');
      },
      enableVerticalSwipes: () => {
        webApp.isVerticalSwipesEnabled = true;
        record('enableVerticalSwipes');
      },
      setHeaderColor: (color: string) => {
        webApp.headerColor = color;
        record('setHeaderColor', color);
      },
      setBackgroundColor: (color: string) => {
        webApp.backgroundColor = color;
        record('setBackgroundColor', color);
      },
      onEvent: (event: string, handler: () => void) => {
        const set = eventHandlers.get(event) ?? new Set();
        set.add(handler);
        eventHandlers.set(event, set);
        record('onEvent', event);
      },
      offEvent: (event: string, handler: () => void) => {
        eventHandlers.get(event)?.delete(handler);
        record('offEvent', event);
      },
      MainButton: {
        text: '',
        color: '#e06b32',
        textColor: '#ffffff',
        isVisible: false,
        isActive: true,
        isProgressVisible: false,
        setText(text: string) {
          this.text = text;
          record('MainButton.setText', text);
        },
        onClick(handler: () => void) {
          mainHandlers.add(handler);
          record('MainButton.onClick');
        },
        offClick(handler: () => void) {
          mainHandlers.delete(handler);
          record('MainButton.offClick');
        },
        show() {
          this.isVisible = true;
          record('MainButton.show');
        },
        hide() {
          this.isVisible = false;
          record('MainButton.hide');
        },
        enable() {
          this.isActive = true;
          record('MainButton.enable');
        },
        disable() {
          this.isActive = false;
          record('MainButton.disable');
        },
        showProgress() {
          this.isProgressVisible = true;
          record('MainButton.showProgress');
        },
        hideProgress() {
          this.isProgressVisible = false;
          record('MainButton.hideProgress');
        },
      },
      BackButton: {
        isVisible: false,
        onClick(handler: () => void) {
          backHandlers.add(handler);
          record('BackButton.onClick');
        },
        offClick(handler: () => void) {
          backHandlers.delete(handler);
          record('BackButton.offClick');
        },
        show() {
          this.isVisible = true;
          record('BackButton.show');
        },
        hide() {
          this.isVisible = false;
          record('BackButton.hide');
        },
      },
      HapticFeedback: {
        impactOccurred: (style: string) => record('HapticFeedback.impactOccurred', style),
        notificationOccurred: (type: string) => record('HapticFeedback.notificationOccurred', type),
        selectionChanged: () => record('HapticFeedback.selectionChanged'),
      },
      openLink: (url: string) => record('openLink', url),
      openTelegramLink: (url: string) => record('openTelegramLink', url),
      openInvoice: (url: string, callback?: (status: string) => void) => {
        record('openInvoice', url);
        callback?.('paid');
      },
      showAlert: (message: string, callback?: () => void) => {
        record('showAlert', message);
        callback?.();
      },
      showConfirm: (message: string, callback?: (confirmed: boolean) => void) => {
        record('showConfirm', message);
        callback?.(true);
      },
    };

    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: { WebApp: webApp },
    });
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      value: MockEventSource,
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: (url?: string | URL, target?: string) => {
        record('window.open', String(url ?? ''), target);
        return null;
      },
    });
    Object.defineProperty(window, '__telegramMock', {
      configurable: true,
      value: {
        calls,
        emit,
        clickBack: () => backHandlers.forEach((handler) => handler()),
        clickMain: () => mainHandlers.forEach((handler) => handler()),
        setTheme: (scheme: 'light' | 'dark') => {
          webApp.colorScheme = scheme;
          emit('themeChanged');
        },
      },
    });
  }, options);
}

export async function telegramCalls(page: Page): Promise<TelegramCall[]> {
  return page.evaluate(() => {
    const scope = window as typeof window & { __telegramMock?: { calls: TelegramCall[] } };
    return scope.__telegramMock?.calls ?? [];
  });
}

export async function clickTelegramBack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = window as typeof window & { __telegramMock?: { clickBack: () => void } };
    scope.__telegramMock?.clickBack();
  });
}

export async function setTelegramTheme(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((next) => {
    const scope = window as typeof window & {
      __telegramMock?: { setTheme: (value: 'light' | 'dark') => void };
    };
    scope.__telegramMock?.setTheme(next);
  }, scheme);
}
