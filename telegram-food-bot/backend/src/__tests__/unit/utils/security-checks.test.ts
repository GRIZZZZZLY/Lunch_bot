/**
 * Tests for Security Checks
 * Sprint 3 - Production Safety
 */

import { runSecurityChecks, generateSecureKey } from '../../../utils/security-checks';

describe('Security Checks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('runSecurityChecks', () => {
    it('should pass in development with default settings', () => {
      process.env.NODE_ENV = 'development';
      process.env.BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.DATABASE_URL = 'file:./dev.db';

      // Should not throw
      expect(() => runSecurityChecks()).not.toThrow();
    });

    it('should throw in production with SKIP_TELEGRAM_VALIDATION=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.SKIP_TELEGRAM_VALIDATION = 'true';
      process.env.BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.DATABASE_URL = 'file:./dev.db';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);

      expect(() => runSecurityChecks()).toThrow('SECURITY');
    });

    it('should throw in production with default JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'dev_jwt_secret_change_in_production';
      process.env.BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.DATABASE_URL = 'file:./dev.db';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);

      expect(() => runSecurityChecks()).toThrow('SECURITY');
    });

    it('should throw in production without ENCRYPTION_KEY', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.DATABASE_URL = 'file:./dev.db';
      delete process.env.ENCRYPTION_KEY;

      expect(() => runSecurityChecks()).toThrow('SECURITY');
    });

    it('should pass in production with all secure settings', () => {
      process.env.NODE_ENV = 'production';
      process.env.SKIP_TELEGRAM_VALIDATION = 'false';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';

      expect(() => runSecurityChecks()).not.toThrow();
    });
  });

  describe('generateSecureKey', () => {
    it('should generate key of default length (32 bytes = 64 hex chars)', () => {
      const key = generateSecureKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('should generate key of specified length', () => {
      const key = generateSecureKey(16);
      expect(key).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique keys', () => {
      const key1 = generateSecureKey();
      const key2 = generateSecureKey();
      expect(key1).not.toBe(key2);
    });
  });
});
