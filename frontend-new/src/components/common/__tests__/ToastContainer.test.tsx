import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../ToastContainer';
import { useToastStore } from '@/store/useToastStore';

beforeEach(() => {
  useToastStore.getState().clear();
});

describe('ToastContainer', () => {
  it('область объявлений есть и без уведомлений', () => {
    render(<ToastContainer />);
    expect(screen.getByRole('region', { name: 'Уведомления' })).toBeInTheDocument();
  });

  it('ошибка объявляется как alert и сменяет прежнее уведомление', () => {
    const { container } = render(<ToastContainer />);
    act(() => {
      useToastStore.getState().push({ type: 'success', message: 'Сохранено' });
      useToastStore.getState().push({ type: 'error', message: 'Не удалось' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось');
    expect(container.querySelectorAll('.toast:not(.is-leaving)')).toHaveLength(1);
  });

  it('крестик снимает уведомление', async () => {
    const { container } = render(<ToastContainer />);
    act(() => {
      useToastStore.getState().push({ type: 'info', message: 'Сбор закрыт' });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(container.querySelector('.toast')).toHaveClass('is-leaving');
  });
});
