import { afterEach, describe, expect, it, vi } from 'vitest';
import { hapticImpact, hapticNotify, hapticSelection } from '../haptics';

function withHaptics(impl: Partial<Record<string, unknown>>) {
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { HapticFeedback: impl },
  };
}

afterEach(() => {
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('haptics', () => {
  it('зовёт метод клиента с нужным жестом', () => {
    const impactOccurred = vi.fn();
    const selectionChanged = vi.fn();
    const notificationOccurred = vi.fn();
    withHaptics({ impactOccurred, selectionChanged, notificationOccurred });

    hapticImpact();
    hapticSelection();
    hapticNotify('error');

    expect(impactOccurred).toHaveBeenCalledWith('light');
    expect(selectionChanged).toHaveBeenCalledTimes(1);
    expect(notificationOccurred).toHaveBeenCalledWith('error');
  });

  it('вне Telegram молчит, а не падает', () => {
    expect(() => {
      hapticImpact();
      hapticSelection();
      hapticNotify('success');
    }).not.toThrow();
  });

  /* Старый клиент бросает на неизвестный метод. Необработанное исключение
     уронило бы обработчик клика вместе с действием — тап по кнопке перестал бы
     работать вообще. */
  it('исключение старого клиента не доходит до вызывающего', () => {
    withHaptics({
      impactOccurred: () => {
        throw new Error('WebAppMethodUnsupported');
      },
    });

    expect(() => hapticImpact('heavy')).not.toThrow();
  });
});
