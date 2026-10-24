import { afterEach, describe, expect, it } from 'vitest';
import { hapticImpact } from '../haptics';

function withHaptics(impl: Partial<Record<string, unknown>>) {
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { HapticFeedback: impl },
  };
}

afterEach(() => {
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('haptics', () => {
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
