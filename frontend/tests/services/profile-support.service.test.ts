import { beforeEach, describe, expect, it, vi } from 'vitest';
import { donationService } from '../../src/services/donation.service';
import { feedbackService } from '../../src/services/feedback.service';
import { userService } from '../../src/services/user.service';

const { apiGet, apiPost, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
  },
}));

describe('profile and support services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and saves payment information through the current user endpoints', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: {
        paymentCard: '1234 5678 1234 5678',
        paymentPhone: '+79991234567',
        paymentDetails: 'SBP',
      },
    });
    apiPut.mockResolvedValue({
      success: true,
      data: {
        paymentCard: '1234 5678 1234 5678',
        paymentPhone: '+79991234567',
        paymentDetails: 'SBP',
      },
    });

    await userService.getPaymentInfo();
    await userService.updatePaymentInfo({
      paymentCard: '1234 5678 1234 5678',
      paymentPhone: '+79991234567',
      paymentDetails: 'SBP',
    });

    expect(apiGet).toHaveBeenCalledWith('/user/payment-info');
    expect(apiPut).toHaveBeenCalledWith('/user/payment-info', {
      paymentCard: '1234 5678 1234 5678',
      paymentPhone: '+79991234567',
      paymentDetails: 'SBP',
    });
  });

  it('formats, masks, and validates payment fields before ProfilePage saves them', () => {
    expect(userService.formatCardNumber('1234567812345678')).toBe(
      '1234 5678 1234 5678'
    );
    expect(userService.maskCardNumber('1234 5678 1234 5678')).toBe(
      '************5678'
    );
    expect(userService.validateCardNumber('1234 5678 1234 5678')).toBe(true);
    expect(userService.validateCardNumber('123')).toBe(false);
    expect(userService.validatePhone('+7 (999) 123-45-67')).toBe(true);
    expect(userService.validatePhone('123')).toBe(false);
  });

  it('sends feedback to the Mini App feedback endpoint', async () => {
    apiPost.mockResolvedValue({
      success: true,
      data: { id: 12, createdAt: '2026-06-26T10:00:00.000Z' },
    });

    await feedbackService.send({
      message: 'Need help',
      userId: 5,
      username: 'igor',
      firstName: 'Igor',
    });

    expect(apiPost).toHaveBeenCalledWith('/feedback', {
      message: 'Need help',
      userId: 5,
      username: 'igor',
      firstName: 'Igor',
    });
  });

  it('creates Telegram Stars invoices through the donation endpoint', async () => {
    apiPost.mockResolvedValue({
      success: true,
      data: {
        invoiceUrl: 'https://t.me/invoice/test',
        donationId: 'donation-1',
        amountStars: 25,
      },
    });

    await donationService.createStarsInvoice(25);

    expect(apiPost).toHaveBeenCalledWith('/donations/stars', {
      amountStars: 25,
    });
  });
});
