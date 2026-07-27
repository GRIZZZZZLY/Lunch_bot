import { beforeEach, describe, expect, it } from 'vitest';
import { useToastStore } from '../useToastStore';

beforeEach(() => {
  useToastStore.getState().clear();
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
    push({ type: 'success', message: 'Готово' });
    push({ type: 'error', message: 'Готово' });
    push({ type: 'success', message: 'Готово', title: 'Закупка' });

    expect(useToastStore.getState().toasts).toHaveLength(3);
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
