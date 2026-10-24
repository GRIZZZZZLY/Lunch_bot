import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditPaymentInfoSheet } from '../EditPaymentInfoSheet';
import { _resetBackButtonForTests } from '@/lib/backButton';

describe('EditPaymentInfoSheet', () => {
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
        initial={{ paymentPhone: '+7 900 111-22-33', paymentDetails: 'Банк' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(screen.getByText(/Не удалось сохранить реквизиты/)).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /* Какой номер уходит на сервер. Привычное «8 926…» должно давать «+7 926…»,
     но код Петербурга тоже начинается с восьмёрки, поэтому её отбрасывает
     только переполнение десяти цифр, а не сам факт восьмёрки в начале. */
  it.each([
    ['+7 9261234567', '+7 926 123-45-67'],
    ['+7 89261234567', '+7 926 123-45-67'],
    ['+7 8123456789', '+7 812 345-67-89'],
  ])('набранный %j уходит как %j', (typed, sent) => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(<EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Телефон СБП'), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ paymentPhone: sent }));
  });

  /* «+7» — это не реквизит. Уходя с пустого поля, оставляем его пустым,
     иначе на сервер уедет код страны как номер для перевода. */
  it('уход с поля, где остался один префикс, очищает его', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(<EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);
    const field = screen.getByLabelText('Телефон СБП');

    fireEvent.blur(field);
    expect(field).toHaveValue('');

    fireEvent.focus(field);
    expect(field).toHaveValue('+7 ');

    fireEvent.blur(field);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSubmit).toHaveBeenCalledWith(
      /* null, а не undefined: undefined выпадает из JSON, и сервер оставил бы
         прежний номер — убрать реквизит было бы нельзя. */
      expect.objectContaining({ paymentPhone: null }),
    );
  });
});
