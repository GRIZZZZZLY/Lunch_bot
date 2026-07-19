import { afterEach, describe, expect, it, vi } from 'vitest';
import { initTelegramWebApp } from '../telegram';
import type { TelegramWebApp } from '../telegram';

afterEach(() => {
  delete window.Telegram;
});

describe('initTelegramWebApp', () => {
  it('отключает системный вертикальный свайп (конфликт с drag-шторкой и скроллом)', () => {
    const wa = {
      ready: vi.fn(),
      expand: vi.fn(),
      disableVerticalSwipes: vi.fn(),
    } as unknown as TelegramWebApp;
    window.Telegram = { WebApp: wa };

    initTelegramWebApp();

    expect(wa.ready).toHaveBeenCalledTimes(1);
    expect(wa.expand).toHaveBeenCalledTimes(1);
    expect(wa.disableVerticalSwipes).toHaveBeenCalledTimes(1);
  });

  it('переживает старый клиент без disableVerticalSwipes (Bot API < 7.7)', () => {
    const wa = { ready: vi.fn(), expand: vi.fn() } as unknown as TelegramWebApp;
    window.Telegram = { WebApp: wa };
    expect(() => initTelegramWebApp()).not.toThrow();
  });

  it('вне Telegram возвращает null', () => {
    expect(initTelegramWebApp()).toBeNull();
  });
});
