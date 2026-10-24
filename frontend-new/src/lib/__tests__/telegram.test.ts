import { afterEach, describe, expect, it, vi } from 'vitest';
import { initTelegramWebApp } from '../telegram';
import type { TelegramWebApp } from '../telegram';

afterEach(() => {
  delete window.Telegram;
});

describe('initTelegramWebApp', () => {
  /* Запуск на старом клиенте не должен падать: исключение здесь — пустой экран
     вместо приложения. */
  it('переживает старый клиент без disableVerticalSwipes (Bot API < 7.7)', () => {
    const wa = { ready: vi.fn(), expand: vi.fn() } as unknown as TelegramWebApp;
    window.Telegram = { WebApp: wa };
    expect(() => initTelegramWebApp()).not.toThrow();
  });
});
