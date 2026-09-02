import { isPaymentLink, paymentCardLine, paymentLinkButton } from '../../../utils/payment-link';

describe('payment-link', () => {
  it('распознаёт http(s)-ссылку', () => {
    expect(isPaymentLink('https://qr.nspk.ru/AS1A00')).toBe(true);
    expect(isPaymentLink('2200 1234 5678 9012')).toBe(false);
  });

  it('для ссылки строка сообщения указывает на кнопку, для legacy-номера — маска', () => {
    expect(paymentCardLine('https://qr.nspk.ru/AS1A00')).toBe('🔗 Ссылка для перевода — кнопкой ниже');
    expect(paymentCardLine('2200123456789012')).toBe('💳 Карта: **** **** **** 9012');
  });

  it('кнопка несёт url как есть', () => {
    expect(paymentLinkButton('https://qr.nspk.ru/AS1A00')).toEqual({
      text: '💳 Перевести по ссылке', url: 'https://qr.nspk.ru/AS1A00',
    });
  });
});
