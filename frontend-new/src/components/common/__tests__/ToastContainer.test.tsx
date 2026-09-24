import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomSheet } from '@/components/rl/BottomSheet';
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
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().push({ type: 'success', message: 'Сохранено' });
      useToastStore.getState().push({ type: 'error', message: 'Не удалось' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось');
    expect(document.querySelectorAll('.toast:not(.is-leaving)')).toHaveLength(1);
  });

  /* Открытая шторка делает #root инертным (BottomSheet). Уведомление внутри
     #root было бы видно поверх шторки, но крестик не нажимался бы, а диктор
     не объявил бы сообщение. */
  it('не попадает в инертное приложение, пока открыта шторка', () => {
    const root = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'root' }));
    render(
      <>
        <ToastContainer />
        <BottomSheet title="Шторка" onClose={() => {}}>
          <div>содержимое</div>
        </BottomSheet>
      </>,
      { container: root },
    );

    expect(root).toHaveAttribute('inert');
    expect(screen.getByRole('region', { name: 'Уведомления' }).closest('[inert]')).toBeNull();
    root.remove();
  });

  it('крестик снимает уведомление', async () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().push({ type: 'info', message: 'Сбор закрыт' });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(document.querySelector('.toast')).toHaveClass('is-leaving');
  });
});
