import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountdown } from '../useCountdown';

const T0 = new Date('2026-07-17T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCountdown', () => {
  it('обычный отсчёт: тикает раз в секунду от серверного timestamp', () => {
    const { result } = renderHook(() => useCountdown(T0 + 90_000));
    expect(result.current.totalSeconds).toBe(90);
    expect(result.current.minutes).toBe(1);
    expect(result.current.seconds).toBe(30);
    expect(result.current.isExpired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.totalSeconds).toBe(89);

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current.totalSeconds).toBe(60);
    expect(result.current.minutes).toBe(1);
    expect(result.current.seconds).toBe(0);
  });

  it('достижение нуля: isExpired, без отрицательных значений', () => {
    const { result } = renderHook(() => useCountdown(T0 + 2_000));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.totalSeconds).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('timestamp в прошлом: сразу isExpired и ноль', () => {
    const { result } = renderHook(() => useCountdown(T0 - 60_000));
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('восстановление после скрытой вкладки: visibilitychange пересчитывает немедленно', () => {
    const { result } = renderHook(() => useCountdown(T0 + 600_000));
    expect(result.current.totalSeconds).toBe(600);

    // вкладка «спала»: интервалы не срабатывали, время ушло вперёд
    act(() => {
      vi.setSystemTime(T0 + 300_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.totalSeconds).toBe(300);
  });

  it('после unmount таймеров нет, возврат во вкладку ничего не пересчитывает', () => {
    let renders = 0;
    const { unmount } = renderHook(() => {
      renders += 1;
      return useCountdown(T0 + 60_000);
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    const rendersAtUnmount = renders;
    expect(() => {
      vi.setSystemTime(T0 + 30_000);
      document.dispatchEvent(new Event('visibilitychange'));
    }).not.toThrow();
    expect(renders).toBe(rendersAtUnmount);
  });

  it('null/некорректный target — ноль без таймеров', () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current.isExpired).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
