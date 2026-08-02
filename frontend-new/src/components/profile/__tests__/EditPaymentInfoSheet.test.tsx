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
          paymentPhone: '+7 900 111-22-33',
          paymentDetails: 'Первый банк',
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
          paymentPhone: '+7 901 444-55-66',
          paymentDetails: 'Новый банк',
          paymentCard: '  1111 2222 3333 4444  ',
        }}
      />,
    );

    expect(screen.getByLabelText('Телефон СБП')).toHaveValue(
      '+7 901 444-55-66',
    );
    expect(screen.getByLabelText('Банк')).toHaveValue('Новый банк');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).toHaveBeenCalledWith({
      paymentPhone: '+7 901 444-55-66',
      paymentDetails: 'Новый банк',
      paymentCard: '1111 2222 3333 4444',
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
        initial={{ paymentPhone: '+7 900 111-22-33', paymentDetails: 'Банк' }}
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
      <EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={onSubmit} initial={{ paymentPhone: '123' }} />,
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
        initial={{ paymentPhone: '+7 900 111-22-33', paymentCard: '1111 2222' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/16–19 цифр/)).toBeInTheDocument();
  });

  /* Регрессия, из-за которой профиль не сохранял НИЧЕГО. Форма слала
     sbpPhone/bankName/cardNumber, а API читает paymentPhone/paymentCard/
     paymentDetails: PUT отвечал 200 и записывал undefined в каждое поле.
     Отказа не было, показывать было нечего, тесты проходили — потому что
     e2e-мок возвращал эхом то, что прислал клиент. Здесь имена закреплены. */
  it('отправляет ровно те имена полей, что читает сервер', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(
      <EditPaymentInfoSheet
        open
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={{ paymentPhone: '+7 900 111-22-33', paymentDetails: 'Т-Банк' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(Object.keys(onSubmit.mock.calls[0][0]).sort()).toEqual([
      'paymentCard',
      'paymentDetails',
      'paymentPhone',
    ]);
  });

  it('поле телефона открывается с «+7 », его не набирают руками', () => {
    _resetBackButtonForTests();
    render(<EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Телефон СБП')).toHaveValue('+7 ');
  });

  it('форматирует номер по мере набора', () => {
    _resetBackButtonForTests();
    render(<EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const field = screen.getByLabelText('Телефон СБП');

    fireEvent.change(field, { target: { value: '+7 926' } });
    expect(field).toHaveValue('+7 926');

    fireEvent.change(field, { target: { value: '+7 9261234567' } });
    expect(field).toHaveValue('+7 926 123-45-67');
  });

  /* Привычное «8 926…» должно давать «+7 926…», но код Петербурга тоже
     начинается с восьмёрки, поэтому её отбрасывает только переполнение
     десяти цифр, а не сам факт восьмёрки в начале. */
  it('привычная восьмёрка не удваивает код страны, а «812» остаётся кодом города', () => {
    _resetBackButtonForTests();
    render(<EditPaymentInfoSheet open busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const field = screen.getByLabelText('Телефон СБП');

    fireEvent.change(field, { target: { value: '+7 89261234567' } });
    expect(field).toHaveValue('+7 926 123-45-67');

    fireEvent.change(field, { target: { value: '+7 8123456789' } });
    expect(field).toHaveValue('+7 812 345-67-89');
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
      expect.objectContaining({ paymentPhone: undefined }),
    );
  });
});
