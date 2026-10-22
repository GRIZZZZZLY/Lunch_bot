/* Две границы скелета: молчание на быстром ответе и минимальная жизнь, если он
   всё-таки появился. */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedLoading } from '../useDelayedLoading';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/* Границы передаются явно и отличаются от значений по умолчанию: тест держит
   поведение, а не сами числа. */
const DELAY = 100;
const MIN = 200;

function mount() {
  return renderHook(({ loading }) => useDelayedLoading(loading, DELAY, MIN), {
    initialProps: { loading: true },
  });
}

describe('useDelayedLoading', () => {
  /* Загрузка стартует в 0, заканчивается в endAt (Infinity — ещё идёт),
     скелет проверяется в checkAt. */
  it.each([
    ['до задержки скелета нет', Infinity, DELAY - 1, false],
    ['ожидание оказалось настоящим — скелет появляется', Infinity, DELAY, true],
    ['ответ пришёл после появления — скелет держит минимум', DELAY + 20, DELAY + MIN - 1, true],
    ['минимум отсчитан от появления скелета, а не от ответа', DELAY + 20, DELAY + MIN, false],
  ])('%s', (_name, endAt, checkAt, expected) => {
    const { result, rerender } = mount();

    if (endAt <= checkAt) {
      act(() => {
        vi.advanceTimersByTime(endAt);
      });
      rerender({ loading: false });
      act(() => {
        vi.advanceTimersByTime(checkAt - endAt);
      });
    } else {
      act(() => {
        vi.advanceTimersByTime(checkAt);
      });
    }

    expect(result.current).toBe(expected);
  });

  it('быстрый ответ не показывает скелет вообще', () => {
    const { result, rerender } = mount();

    act(() => {
      vi.advanceTimersByTime(DELAY / 2);
    });
    rerender({ loading: false });

    act(() => {
      vi.advanceTimersByTime(DELAY + MIN);
    });
    expect(result.current).toBe(false);
  });

  it('долгая загрузка не продлевает минимум задним числом', () => {
    const { result, rerender } = mount();

    act(() => {
      vi.advanceTimersByTime(DELAY + MIN * 10);
    });
    expect(result.current).toBe(true);

    // Минимум давно истёк — контент показываем сразу.
    rerender({ loading: false });
    expect(result.current).toBe(false);
  });
});
