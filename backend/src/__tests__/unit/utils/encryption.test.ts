/**
 * Tests for EncryptionService
 * Sprint 1 - Payment Data Encryption
 */

import { EncryptionService, encrypt, decrypt, maskCardNumber, maskPhone } from '../../../utils/encryption';

describe('EncryptionService', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plainText = 'Hello, World!';
      
      const encrypted = EncryptionService.encrypt(plainText);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(encrypted).not.toBe(plainText);
      expect(decrypted).toBe(plainText);
    });

    it('should return encrypted format IV:AuthTag:CipherText', () => {
      const plainText = 'Test data';
      
      const encrypted = EncryptionService.encrypt(plainText);
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(3);
      // All parts should be valid base64
      parts.forEach(part => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
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

    it('should handle unicode characters', () => {
      const plainText = 'Привет мир! 你好世界 🎉';
      
      const encrypted = EncryptionService.encrypt(plainText);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plainText);
    });

    it('should handle special characters', () => {
      const plainText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      
      const encrypted = EncryptionService.encrypt(plainText);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plainText);
    });

    it('should encrypt card numbers correctly', () => {
      const cardNumber = '4111-1111-1111-1111';
      
      const encrypted = EncryptionService.encrypt(cardNumber);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(cardNumber);
      expect(encrypted).not.toContain('4111');
    });

    it('should encrypt phone numbers correctly', () => {
      const phone = '+7 999 123-45-67';
      
      const encrypted = EncryptionService.encrypt(phone);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(phone);
      expect(encrypted).not.toContain('999');
    });
  });

  describe('decrypt with legacy data', () => {
    it('should return legacy unencrypted data as-is', () => {
      const legacyData = '1234-5678-9012-3456';
      
      const decrypted = EncryptionService.decrypt(legacyData);
      
      expect(decrypted).toBe(legacyData);
    });

    it('should handle data without colons (legacy format)', () => {
      const legacyData = 'some plain text without colons';
      
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
      const cardNumber = '4111111111111111';
      
      const masked = EncryptionService.maskCardNumber(cardNumber);
      
      expect(masked).toBe('**** **** **** 1111');
    });

    it('should mask card number with dashes', () => {
      const cardNumber = '4111-1111-1111-1234';
      
      const masked = EncryptionService.maskCardNumber(cardNumber);
      
      expect(masked).toBe('**** **** **** 1234');
    });

    it('should mask card number with spaces', () => {
      const cardNumber = '4111 1111 1111 5678';
      
      const masked = EncryptionService.maskCardNumber(cardNumber);
      
      expect(masked).toBe('**** **** **** 5678');
    });

    it('should mask encrypted card number', () => {
      const cardNumber = '4111111111119999';
      const encrypted = EncryptionService.encrypt(cardNumber);
      
      const masked = EncryptionService.maskCardNumber(encrypted);
      
      expect(masked).toBe('**** **** **** 9999');
    });

    it('should return **** for short numbers', () => {
      expect(EncryptionService.maskCardNumber('123')).toBe('****');
      expect(EncryptionService.maskCardNumber('')).toBe('****');
    });
  });

  describe('maskPhone', () => {
    it('should mask plain phone number', () => {
      const phone = '+79991234567';
      
      const masked = EncryptionService.maskPhone(phone);
      
      expect(masked).toBe('+7 *** ***-45-67');
    });

    it('should mask phone with formatting', () => {
      const phone = '+7 (999) 123-45-67';
      
      const masked = EncryptionService.maskPhone(phone);
      
      expect(masked).toBe('+7 *** ***-45-67');
    });

    it('should mask encrypted phone number', () => {
      const phone = '+79991234599';
      const encrypted = EncryptionService.encrypt(phone);
      
      const masked = EncryptionService.maskPhone(encrypted);
      
      expect(masked).toBe('+7 *** ***-45-99');
    });

    it('should return placeholder for short numbers', () => {
      expect(EncryptionService.maskPhone('123')).toBe('+7 *** ***-**-**');
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same input', () => {
      const text = 'test data';
      
      const hash1 = EncryptionService.hash(text);
      const hash2 = EncryptionService.hash(text);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = EncryptionService.hash('text1');
      const hash2 = EncryptionService.hash('text2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex hash (SHA-256)', () => {
      const hash = EncryptionService.hash('test');
      
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('generateKey', () => {
    it('should generate 64-character hex key', () => {
      const key = EncryptionService.generateKey();
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('exported helper functions', () => {
    it('should export encrypt function', () => {
      const encrypted = encrypt('test');
      expect(EncryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should export decrypt function', () => {
      const encrypted = EncryptionService.encrypt('test');
      expect(decrypt(encrypted)).toBe('test');
    });

    it('should export maskCardNumber function', () => {
      expect(maskCardNumber('4111111111111111')).toBe('**** **** **** 1111');
    });

    it('should export maskPhone function', () => {
      expect(maskPhone('+79991234567')).toBe('+7 *** ***-45-67');
    });
  });
});
