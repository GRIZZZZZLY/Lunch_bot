import {
  hasPaymentDetails,
  isPaymentLink,
  paymentCardLine,
  paymentLinkButton,
} from '../../../utils/payment-link';

describe('hasPaymentDetails', () => {
  it.each([
    [{ paymentPhone: '+79990001122' }, true],
    [{ paymentCard: 'https://qr.nspk.ru/AS1A00' }, true],
    [{ paymentDetails: 'Сбер' }, true],
    [{ paymentPhone: '  ', paymentCard: null, paymentDetails: '' }, false],
    [null, false],
    [undefined, false],
  ])('%j → %s', (info, expected) => {
    expect(hasPaymentDetails(info)).toBe(expected);
  });
});

describe('payment-link', () => {
  it('распознаёт http(s)-ссылку', () => {
    expect(isPaymentLink('https://qr.nspk.ru/AS1A00')).toBe(true);
    expect(isPaymentLink('2200 1234 5678 9012')).toBe(false);
  });

  it('ссылка не попадает в текст сообщения — она уходит кнопкой', () => {
    expect(paymentCardLine('https://qr.nspk.ru/AS1A00')).not.toContain('qr.nspk.ru');
  });

  it('номер карты в сообщении замаскирован: виден только хвост', () => {
    const line = paymentCardLine('2200123456789012');

    expect(line).not.toContain('2200123456789012');
    expect(line).not.toContain('22001234');
    expect(line).toContain('9012');
  });

  it('кнопка несёт url как есть', () => {
    expect(paymentLinkButton('https://qr.nspk.ru/AS1A00')).toEqual(
      expect.objectContaining({ url: 'https://qr.nspk.ru/AS1A00' })
    );
  });
});
