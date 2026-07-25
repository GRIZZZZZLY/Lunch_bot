import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
