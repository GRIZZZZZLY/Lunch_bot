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
          paymentCard: '  https://www.tinkoff.ru/rm/abc  ',
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
      paymentCard: 'https://www.tinkoff.ru/rm/abc',
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

  /* Поле «Номер карты» заменено на «Ссылка на СБП»: по ссылке плательщик
     попадает сразу в свой банк, а цифры карты надо копировать руками. */
  it('не отправляет то, что не является ссылкой', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(
      <EditPaymentInfoSheet
        open
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={{ paymentPhone: '+7 900 111-22-33', paymentCard: 'просто текст' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/не похоже на ссылку/i)).toBeInTheDocument();
  });

  /* javascript:-ссылка из чужого профиля исполнилась бы по тапу того, кто
     платит. Схему проверяем на вводе и ещё раз перед показом. */
  it('не принимает ссылку с опасной схемой', () => {
    _resetBackButtonForTests();
    const onSubmit = vi.fn();
    render(
      <EditPaymentInfoSheet
        open
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={{ paymentCard: 'javascript:alert(1)' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/должна начинаться с https/i)).toBeInTheDocument();
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
