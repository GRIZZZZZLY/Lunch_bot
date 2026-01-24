/**
 * Tests for Rate Limiter Middleware
 * Sprint 2 - Security
 */

import {
  generalLimiter,
  authLimiter,
  writeLimiter,
  voteLimiter,
  pollCreationLimiter,
  reminderLimiter,
  heavyOperationLimiter,
} from '../../../api/middleware/rate-limiter';

describe('Rate Limiter Middleware', () => {
  describe('Exports', () => {
    it('should export generalLimiter', () => {
      expect(generalLimiter).toBeDefined();
      expect(typeof generalLimiter).toBe('function');
    });

    it('should export authLimiter', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });

    it('should export writeLimiter', () => {
      expect(writeLimiter).toBeDefined();
      expect(typeof writeLimiter).toBe('function');
    });

    it('should export voteLimiter', () => {
      expect(voteLimiter).toBeDefined();
      expect(typeof voteLimiter).toBe('function');
    });

    it('should export pollCreationLimiter', () => {
      expect(pollCreationLimiter).toBeDefined();
      expect(typeof pollCreationLimiter).toBe('function');
    });

    it('should export reminderLimiter', () => {
      expect(reminderLimiter).toBeDefined();
      expect(typeof reminderLimiter).toBe('function');
    });

    it('should export heavyOperationLimiter', () => {
      expect(heavyOperationLimiter).toBeDefined();
      expect(typeof heavyOperationLimiter).toBe('function');
    });
  });

  describe('Middleware Configuration', () => {
    // Note: Full integration tests would require mocking express
    // These are basic smoke tests to ensure the middleware is properly configured
    
    it('generalLimiter should be a valid middleware function', () => {
      // Rate limiter returns a function that takes (req, res, next)
      expect(generalLimiter.length).toBe(3);
    });

    it('authLimiter should be a valid middleware function', () => {
      expect(authLimiter.length).toBe(3);
    });

    it('voteLimiter should be a valid middleware function', () => {
      expect(voteLimiter.length).toBe(3);
    });
  });
});
