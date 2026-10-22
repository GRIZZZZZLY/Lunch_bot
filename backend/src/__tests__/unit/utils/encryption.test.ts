/**
 * Шифрование платёжных данных (карта, телефон) перед записью в БД и маски для
 * показа.
 */

import { EncryptionService } from '../../../utils/encryption';

/* Строка «4111 1111 1111 1111», зашифрованная ключом FIXED_KEY. Так данные уже
   лежат в базе: смена алгоритма, формата или вывода ключа сделает их нечитаемыми,
   и этот тест упадёт раньше, чем пользователи. */
const FIXED_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const STORED_CARD =
  'AQIDBAUGBwgJCgsMDQ4PEA==:KjH4O4DenkQhGUnGeC6izw==:Bzr99Ak8iZt3SY7KQ8WYKIkx4w==';

describe('EncryptionService', () => {
  describe('encrypt/decrypt', () => {
    it.each([
      ['текст', 'Hello, World!'],
      ['юникод', 'Привет мир! 你好世界 🎉'],
      ['спецсимволы', '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~'],
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

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plainText = 'Same text';

      const encrypted1 = EncryptionService.encrypt(plainText);
      const encrypted2 = EncryptionService.encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to the same value
      expect(EncryptionService.decrypt(encrypted1)).toBe(plainText);
      expect(EncryptionService.decrypt(encrypted2)).toBe(plainText);
    });

    it('should handle empty string', () => {
      expect(EncryptionService.encrypt('')).toBe('');
      expect(EncryptionService.decrypt('')).toBe('');
    });
  });

  describe('decrypt with legacy data', () => {
    it('should return legacy unencrypted data as-is', () => {
      const legacyData = '1234-5678-9012-3456';

      const decrypted = EncryptionService.decrypt(legacyData);

      expect(decrypted).toBe(legacyData);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted data', () => {
      const encrypted = EncryptionService.encrypt('test');

      expect(EncryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(EncryptionService.isEncrypted('plain text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(EncryptionService.isEncrypted('')).toBe(false);
    });

    it('should return false for data without proper three parts', () => {
      expect(EncryptionService.isEncrypted('only:two')).toBe(false);
      expect(EncryptionService.isEncrypted('one:two:three:four')).toBe(false);
    });
  });

  describe('maskCardNumber', () => {
    it('should mask plain card number', () => {
      expect(EncryptionService.maskCardNumber('4111111111111111')).toBe('**** **** **** 1111');
    });

    it('should mask card number with dashes', () => {
      expect(EncryptionService.maskCardNumber('4111-1111-1111-1234')).toBe('**** **** **** 1234');
    });

    it('should mask card number with spaces', () => {
      expect(EncryptionService.maskCardNumber('4111 1111 1111 5678')).toBe('**** **** **** 5678');
    });

    it('should mask encrypted card number', () => {
      const encrypted = EncryptionService.encrypt('4111111111119999');

      expect(EncryptionService.maskCardNumber(encrypted)).toBe('**** **** **** 9999');
    });

    it('should return **** for short numbers', () => {
      expect(EncryptionService.maskCardNumber('123')).toBe('****');
      expect(EncryptionService.maskCardNumber('')).toBe('****');
    });
  });

  describe('maskPhone', () => {
    it('should mask plain phone number', () => {
      expect(EncryptionService.maskPhone('+79991234567')).toBe('+7 *** ***-45-67');
    });

    it('should mask phone with formatting', () => {
      expect(EncryptionService.maskPhone('+7 (999) 123-45-67')).toBe('+7 *** ***-45-67');
    });

    it('should mask encrypted phone number', () => {
      const encrypted = EncryptionService.encrypt('+79991234599');

      expect(EncryptionService.maskPhone(encrypted)).toBe('+7 *** ***-45-99');
    });

    it('should return placeholder for short numbers', () => {
      expect(EncryptionService.maskPhone('123')).toBe('+7 *** ***-**-**');
    });
  });
});
