import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditPaymentInfoSheet } from '../EditPaymentInfoSheet';
import { _resetBackButtonForTests } from '@/lib/backButton';

describe('EditPaymentInfoSheet', () => {
  it('при повторном открытии берёт свежие реквизиты и отправляет очищенные значения', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    const props = {
      busy: false,
      onClose: vi.fn(),
      onSubmit,
    };
    const { rerender } = render(
      <EditPaymentInfoSheet
        {...props}
        open
        initial={{
          sbpPhone: '+7 900 111-22-33',
          bankName: 'Первый банк',
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Телефон СБП'), {
      target: { value: '+7 999 000-00-00' },
    });
    rerender(<EditPaymentInfoSheet {...props} open={false} />);
    rerender(
      <EditPaymentInfoSheet
        {...props}
        open
        initial={{
          sbpPhone: '+7 901 444-55-66',
          bankName: 'Новый банк',
          cardNumber: '  1111 2222 3333 4444  ',
        }}
      />,
    );

    expect(screen.getByLabelText('Телефон СБП')).toHaveValue(
      '+7 901 444-55-66',
    );
    expect(screen.getByLabelText('Банк')).toHaveValue('Новый банк');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).toHaveBeenCalledWith({
      sbpPhone: '+7 901 444-55-66',
      bankName: 'Новый банк',
      cardNumber: '1111 2222 3333 4444',
    });
  });

  /* Регрессия. handleSave вызывал onSubmit и выбрасывал возвращённый промис:
     отказ сервера не показывался НИГДЕ — лист оставался открытым, кнопка
     переставала крутиться, сообщения не было, а в консоли висело
     необработанное отклонение. Человек уходил уверенным, что реквизиты
     сохранены, и потом не понимал, почему деньги не приходят. */
  it('показывает отказ сервера, а не молчит', async () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn().mockRejectedValue(new Error('500'));
    render(
      <EditPaymentInfoSheet
        open
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={{ sbpPhone: '+7 900 111-22-33', bankName: 'Банк' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(screen.getByText(/Не удалось сохранить реквизиты/)).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* Любая строка уходила на сервер как реквизит для денег: проверки не было
     ни на клиенте, ни в форме. */
  it('не отправляет заведомо неверный телефон', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(
      <EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={onSubmit} initial={{ sbpPhone: '123' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/не хватает цифр/)).toBeInTheDocument();
  });

  it('не отправляет номер карты неверной длины', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(
      <EditPaymentInfoSheet
        open
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={{ sbpPhone: '+7 900 111-22-33', cardNumber: '1111 2222' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/16–19 цифр/)).toBeInTheDocument();
  });
});
