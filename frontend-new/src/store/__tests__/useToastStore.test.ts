import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_EXIT_MS, useToastStore } from '../useToastStore';

beforeEach(() => {
  useToastStore.getState().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToastStore.push', () => {
  it('не дублирует одинаковое сообщение, пока оно на экране', () => {
    const { push } = useToastStore.getState();
    const first = push({ type: 'success', message: 'Закупка создана' });
    const second = push({ type: 'success', message: 'Закупка создана' });

    expect(second).toBe(first);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('различает сообщения по типу и заголовку', () => {
    const { push } = useToastStore.getState();
    const a = push({ type: 'success', message: 'Готово' });
    const b = push({ type: 'error', message: 'Готово' });
    const c = push({ type: 'success', message: 'Готово', title: 'Закупка' });

    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('после закрытия то же сообщение показывается снова', () => {
    const { push, dismiss } = useToastStore.getState();
    const first = push({ type: 'info', message: 'Сбор закрыт' });
    dismiss(first);
    const second = push({ type: 'info', message: 'Сбор закрыт' });

    expect(second).not.toBe(first);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});

describe('useToastStore — уход', () => {
  it('на экране одно уведомление: новое сменяет текущее', () => {
    vi.useFakeTimers();
    const { push } = useToastStore.getState();
    const first = push({ type: 'error', message: 'Не удалось' });
    const second = push({ type: 'success', message: 'Сохранено' });

    const { toasts } = useToastStore.getState();
    expect(toasts.filter((t) => !t.leaving).map((t) => t.id)).toEqual([second]);
    expect(toasts.find((t) => t.id === first)?.leaving).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(useToastStore.getState().toasts.map((t) => t.id)).toEqual([second]);
  });

  it('снятие идёт в два шага: сначала флаг, потом удаление', () => {
    vi.useFakeTimers();
    const { push, dismiss } = useToastStore.getState();
    const id = push({ type: 'success', message: 'Готово' });

    dismiss(id);
    // Тост ещё в стопке и доигрывает уход — иначе он пропал бы между кадрами.
    expect(useToastStore.getState().toasts[0]).toMatchObject({ id, leaving: true });

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('повторное снятие уходящего тоста не трогает соседей', () => {
    vi.useFakeTimers();
    const { push, dismiss } = useToastStore.getState();
    const first = push({ type: 'success', message: 'Первое' });
    push({ type: 'success', message: 'Второе' });

    dismiss(first);
    dismiss(first);
    vi.advanceTimersByTime(TOAST_EXIT_MS);

    const left = useToastStore.getState().toasts;
    expect(left).toHaveLength(1);
    expect(left[0].message).toBe('Второе');
  });

  it('таймер длительности снимает тост через уход, а не рывком', () => {
    vi.useFakeTimers();
    const { push } = useToastStore.getState();
    push({ type: 'info', message: 'Сбор закрыт', duration: 1000 });

    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts[0].leaving).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('уходящий двойник заменяется новым, а не встаёт с ним в стопку', () => {
    vi.useFakeTimers();
    const { push, dismiss } = useToastStore.getState();
    const first = push({ type: 'info', message: 'Сбор закрыт' });
    dismiss(first);
    const second = push({ type: 'info', message: 'Сбор закрыт' });

    const left = useToastStore.getState().toasts;
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe(second);
    expect(left[0].leaving).toBeUndefined();
  });
});
