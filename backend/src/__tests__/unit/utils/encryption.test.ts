/**
 * Шифрование платёжных данных (карта, телефон) перед записью в БД. Маски и
 * чтение незашифрованных старых строк проверяются через API в
 * integration/api/budget-lifecycle.redis.test.ts и user.routes.test.ts.
 */

import { EncryptionService } from '../../../utils/encryption';

/* Строка «4111 1111 1111 1111», зашифрованная ключом FIXED_KEY. Так данные уже
   лежат в базе: смена алгоритма, формата или вывода ключа сделает их нечитаемыми,
   и этот тест упадёт раньше, чем пользователи. */
const FIXED_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const STORED_CARD =
  'AQIDBAUGBwgJCgsMDQ4PEA==:KjH4O4DenkQhGUnGeC6izw==:Bzr99Ak8iZt3SY7KQ8WYKIkx4w==';

describe('EncryptionService', () => {
  it.each([
    ['юникод', 'Привет мир! 你好世界 🎉'],
    ['номер карты', '4111-1111-1111-1111'],
    ['телефон', '+7 999 123-45-67'],
  ])('%s проходит шифрование туда и обратно', (_label, plainText) => {
    const encrypted = EncryptionService.encrypt(plainText);

    expect(encrypted).not.toContain(plainText);
    expect(EncryptionService.decrypt(encrypted)).toBe(plainText);
  });

  it('расшифровывает строку, зашифрованную раньше тем же ключом', () => {
    const previous = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = FIXED_KEY;
    try {
      jest.isolateModules(() => {
        // Свежий модуль: ключ кешируется при первом обращении.
        const fresh = require('../../../utils/encryption') as typeof import('../../../utils/encryption');
        expect(fresh.EncryptionService.decrypt(STORED_CARD)).toBe('4111 1111 1111 1111');
      });
    } finally {
      if (previous === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = previous;
    }
  });

  it('один и тот же текст даёт разный шифротекст (случайный IV)', () => {
    const first = EncryptionService.encrypt('Same text');
    const second = EncryptionService.encrypt('Same text');

    expect(first).not.toBe(second);
    expect(EncryptionService.decrypt(second)).toBe('Same text');
  });
});
