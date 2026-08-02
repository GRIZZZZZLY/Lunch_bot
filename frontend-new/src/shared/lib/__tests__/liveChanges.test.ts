/* Метка «приехало по потоку». Живёт ограниченное время и снимается сама:
   застрявшая метка означала бы подсветку строки навсегда. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIVE_FLASH_MS,
  _resetLiveChanges,
  liveKey,
  markLiveChange,
} from '../liveChanges';
import { renderHook, act } from '@testing-library/react';
import { useLiveChange, useLiveChanges } from '../liveChanges';

beforeEach(() => {
  vi.useFakeTimers();
  _resetLiveChanges();
});

afterEach(() => {
  _resetLiveChanges();
  vi.useRealTimers();
});

describe('liveChanges', () => {
  it('помеченное считается свежим и перестаёт им быть само', () => {
    const { result } = renderHook(() => useLiveChange(liveKey.debt(7)));
    expect(result.current).toBe(false);

    act(() => markLiveChange(liveKey.debt(7)));
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(LIVE_FLASH_MS + 10));
    expect(result.current).toBe(false);
  });

  it('повторный сигнал продлевает метку, а не заводит вторую', () => {
    const { result } = renderHook(() => useLiveChanges());

    act(() => markLiveChange(liveKey.debt(7)));
    act(() => vi.advanceTimersByTime(LIVE_FLASH_MS - 100));
    act(() => markLiveChange(liveKey.debt(7)));

    // старый таймер должен быть снят: иначе метка погаснет раньше срока
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.has(liveKey.debt(7))).toBe(true);
    expect(result.current.size).toBe(1);

    act(() => vi.advanceTimersByTime(LIVE_FLASH_MS));
    expect(result.current.size).toBe(0);
  });

  it('деньги и закупка не пересекаются по одинаковому числовому id', () => {
    const { result } = renderHook(() => useLiveChanges());

    act(() => markLiveChange(liveKey.debt(1)));
    expect(result.current.has(liveKey.storeRun(1))).toBe(false);
    expect(result.current.has(liveKey.debt(1))).toBe(true);
  });

  /* Снимок пересоздаётся только при реальном изменении состава: иначе
     useSyncExternalStore сравнивает по Object.is и уходит в цикл. */
  it('снимок стабилен между чтениями без изменений', () => {
    const { result, rerender } = renderHook(() => useLiveChanges());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
