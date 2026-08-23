/**
 * Механика барьера первого экрана, отдельно от главной.
 *
 * Через `HomePage` проверяется, ЧТО барьер держит; здесь — КАК он устроен:
 * различие «ответ получен» и «данные есть», потолок ожидания и признак «экран
 * действительно ждал» (от него зависит каскад раскрытия).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { arrived, useFirstScreenBarrier } from '../useFirstScreenBarrier';

const query = (over: Partial<{ isSuccess: boolean; isError: boolean }> = {}) => ({
  isSuccess: false,
  isError: false,
  ...over,
});

describe('arrived', () => {
  /* «Приехало» — это ответ, а не данные: запрос, нормализующий пустой ответ в
     null, отдаёт `data === null` ещё во время загрузки, и барьер по данным
     открылся бы раньше времени. */
  it.each([
    ['успех', query({ isSuccess: true }), true],
    ['ошибка', query({ isError: true }), true],
    ['ещё летит', query(), false],
  ])('%s', (_label, q, expected) => {
    expect(arrived(q)).toBe(expected);
  });
});

describe('useFirstScreenBarrier', () => {
  it('готовый экран раскрывается сразу и каскад не ставит', () => {
    const { result } = renderHook(() => useFirstScreenBarrier(true));

    expect(result.current.revealed).toBe(true);
    /* Тёплый кэш отдал всё на первом рендере — раскрывать нечего. */
    expect(result.current.waitedForData).toBe(false);
  });

  it('пока не готово — держит экран и помнит, что ждал', () => {
    const { result } = renderHook(() => useFirstScreenBarrier(false));

    expect(result.current.revealed).toBe(false);
    expect(result.current.waitedForData).toBe(true);
  });

  it('готовность в следующем рендере раскрывает экран', () => {
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useFirstScreenBarrier(ready),
      { initialProps: { ready: false } },
    );

    rerender({ ready: true });

    expect(result.current.revealed).toBe(true);
    // Признак «ждал» не пересчитывается: каскад нужен именно этому раскрытию.
    expect(result.current.waitedForData).toBe(true);
  });

  /* Предохранитель: без потолка достаточно одного запроса, выключенного по
     неизвестной барьеру причине, чтобы экран не открылся никогда. */
  it('через 1.5 секунды раскрывает даже неготовый экран', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useFirstScreenBarrier(false));
      expect(result.current.revealed).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1499);
      });
      expect(result.current.revealed).toBe(false);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.revealed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('таймер снимается при размонтировании', () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(window, 'clearTimeout');
    try {
      const { unmount } = renderHook(() => useFirstScreenBarrier(false));
      unmount();

      expect(clear).toHaveBeenCalled();
    } finally {
      clear.mockRestore();
      vi.useRealTimers();
    }
  });
});
