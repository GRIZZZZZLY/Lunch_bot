import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetBackButtonForTests,
  closeTopOverlay,
  pushOverlay,
  setBaseBackHandler,
} from '../backButton';

interface FakeBackButton {
  clicks: Array<() => void>;
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
}

function installFakeWebApp(): FakeBackButton {
  const bb: FakeBackButton = {
    clicks: [],
    show: vi.fn(),
    hide: vi.fn(),
  };
  window.Telegram = {
    WebApp: {
      BackButton: {
        isVisible: false,
        onClick: (fn: () => void) => bb.clicks.push(fn),
        offClick: (fn: () => void) => {
          bb.clicks = bb.clicks.filter((f) => f !== fn);
        },
        show: bb.show,
        hide: bb.hide,
      },
    } as never,
  };
  return bb;
}

function pressBack(bb: FakeBackButton) {
  bb.clicks.forEach((fn) => fn());
}

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
});

describe('backButton: видимость', () => {
  it('оверлей показывает кнопку, release скрывает', () => {
    const bb = installFakeWebApp();
    const reg = pushOverlay(() => undefined);
    expect(bb.show).toHaveBeenCalled();
    reg.release();
    expect(bb.hide).toHaveBeenCalled();
  });

  it('base-обработчик показывает кнопку, cleanup скрывает', () => {
    const bb = installFakeWebApp();
    const cleanup = setBaseBackHandler(() => undefined);
    expect(bb.show).toHaveBeenCalled();
    cleanup();
    expect(bb.hide).toHaveBeenCalled();
  });
});

describe('backButton: порядок закрытия', () => {
  it('клик закрывает верхний оверлей раньше навигации', () => {
    const bb = installFakeWebApp();
    const base = vi.fn();
    setBaseBackHandler(base);

    const close = vi.fn(() => reg.release());
    const reg = pushOverlay(close);

    pressBack(bb);
    expect(close).toHaveBeenCalledTimes(1);
    expect(base).not.toHaveBeenCalled();

    pressBack(bb);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('оверлеи закрываются LIFO', () => {
    installFakeWebApp();
    const order: string[] = [];
    const regA = pushOverlay(() => {
      order.push('a');
      regA.release();
    });
    const regB = pushOverlay(() => {
      order.push('b');
      regB.release();
    });

    expect(regB.isTop()).toBe(true);
    expect(regA.isTop()).toBe(false);

    expect(closeTopOverlay()).toBe(true);
    expect(closeTopOverlay()).toBe(true);
    expect(closeTopOverlay()).toBe(false);
    expect(order).toEqual(['b', 'a']);
  });

  it('вне Telegram стек работает без ошибок', () => {
    const close = vi.fn();
    const reg = pushOverlay(() => {
      close();
      reg.release();
    });
    expect(closeTopOverlay()).toBe(true);
    expect(close).toHaveBeenCalled();
    expect(closeTopOverlay()).toBe(false);
  });
});
