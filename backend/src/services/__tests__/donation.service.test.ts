import { starsToRub, validateAmountStars } from '../donation.service';

jest.mock('../../database/client', () => ({
  prisma: {
    donation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('DonationService Stars validation', () => {
  const originalStarsRate = process.env.STARS_RATE;

  afterEach(() => {
    process.env.STARS_RATE = originalStarsRate;
  });

  it('accepts Stars amounts from 1 to 1000 and rounds fractions', () => {
    expect(validateAmountStars(1)).toBe(1);
    expect(validateAmountStars(25.4)).toBe(25);
    expect(validateAmountStars(25.5)).toBe(26);
    expect(validateAmountStars(1000)).toBe(1000);
  });

  it('rejects non-numeric and out-of-range Stars amounts', () => {
    expect(() => validateAmountStars('25')).toThrow(
      'amountStars must be a number'
    );
    expect(() => validateAmountStars(Number.NaN)).toThrow(
      'amountStars must be a number'
    );
    expect(() => validateAmountStars(0)).toThrow(
      'amountStars must be between 1 and 1000'
    );
    expect(() => validateAmountStars(1001)).toThrow(
      'amountStars must be between 1 and 1000'
    );
  });

  it('derives a ruble amount for analytics from the configured Stars rate', () => {
    process.env.STARS_RATE = '3';

    expect(starsToRub(9)).toBe(3);
    expect(starsToRub(1)).toBe(1);
  });
});
