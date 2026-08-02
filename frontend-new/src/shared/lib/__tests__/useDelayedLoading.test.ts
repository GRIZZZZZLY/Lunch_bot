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

describe('useDelayedLoading', () => {
  it('молчит в первые миллисекунды загрузки', () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(result.current).toBe(false);
  });

  it('показывает скелет, когда ожидание оказалось настоящим', () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(result.current).toBe(true);
  });

  it('быстрый ответ не показывает скелет вообще', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(120);
    });
    rerender({ loading: false });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it('появившийся скелет не гаснет мгновенно: держит минимум', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);

    // Данные пришли через 20ms после появления скелета — значит из минимума
    // остаётся 240ms, и они отсчитываются от появления, а не от этого момента.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    rerender({ loading: false });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(219);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('долгая загрузка не продлевает минимум задним числом', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(true);

    // Минимум давно истёк — контент показываем сразу.
    rerender({ loading: false });
    expect(result.current).toBe(false);
  });

  it('границы настраиваются', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 500, 100));
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
