import { describe, expect, it } from 'vitest';
import { hasPaymentInfo } from '../phone';

/* Та же мера, что у сервера (hasPaymentDetails): хоть один реквизит — и
   должнику есть что показать. */
describe('hasPaymentInfo', () => {
  it.each([
    [{ paymentPhone: '+79990001122' }, true],
    [{ paymentCard: 'https://qr.nspk.ru/AS1A00' }, true],
    [{ paymentDetails: 'Сбер' }, true],
    [{ paymentPhone: '  ', paymentCard: null, paymentDetails: '' }, false],
    [null, false],
    [undefined, false],
  ])('%j → %s', (info, expected) => {
    expect(hasPaymentInfo(info)).toBe(expected);
  });
});
