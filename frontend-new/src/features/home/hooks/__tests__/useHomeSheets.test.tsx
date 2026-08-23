/**
 * Правило шторок главной: закрываемся только на успехе.
 *
 * Проверяется отдельно, потому что это единственное место, где решается судьба
 * введённой формы. Закрыть шторку на отказе — значит потерять ввод и не
 * объяснить, что пошло не так; ровно та мелочь, которую при рефакторинге легко
 * заменить на «закрыть всегда».
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useHomeSheets } from '../useHomeSheets';

describe('useHomeSheets', () => {
  it('шторки закрыты по умолчанию', () => {
    const { result } = renderHook(() => useHomeSheets());

    expect(result.current.pollOpen).toBe(false);
    expect(result.current.storeRunOpen).toBe(false);
  });

  it('открываются и закрываются независимо друг от друга', () => {
    const { result } = renderHook(() => useHomeSheets());

    act(() => result.current.openPoll());
    expect(result.current.pollOpen).toBe(true);
    expect(result.current.storeRunOpen).toBe(false);

    act(() => result.current.openStoreRun());
    act(() => result.current.closePoll());
    expect(result.current.pollOpen).toBe(false);
    expect(result.current.storeRunOpen).toBe(true);
  });

  it('успешное действие закрывает шторку голосования', async () => {
    const { result } = renderHook(() => useHomeSheets());
    act(() => result.current.openPoll());

    await act(async () => {
      await result.current.afterPollAction(() => Promise.resolve(true));
    });

    expect(result.current.pollOpen).toBe(false);
  });

  /* Главное утверждение файла. */
  it('отказ оставляет шторку открытой — ввод не теряется', async () => {
    const { result } = renderHook(() => useHomeSheets());
    act(() => result.current.openPoll());

    await act(async () => {
      await result.current.afterPollAction(() => Promise.resolve(false));
    });

    expect(result.current.pollOpen).toBe(true);
  });

  it('то же правило у шторки закупки', async () => {
    const { result } = renderHook(() => useHomeSheets());
    act(() => result.current.openStoreRun());

    await act(async () => {
      await result.current.afterStoreRunAction(() => Promise.resolve(false));
    });
    expect(result.current.storeRunOpen).toBe(true);

    await act(async () => {
      await result.current.afterStoreRunAction(() => Promise.resolve(true));
    });
    expect(result.current.storeRunOpen).toBe(false);
  });

  /* Действие вызывается ровно один раз: двойная отправка формы — это второй
     опрос в группе, а не повтор одного. */
  it('действие вызывается один раз', async () => {
    const action = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useHomeSheets());

    await act(async () => {
      await result.current.afterPollAction(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
  });
});
