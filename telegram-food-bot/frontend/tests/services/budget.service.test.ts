import { beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetService } from '../../src/services/budget.service';

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    get: apiGet,
    post: apiPost,
  },
}));

describe('budgetService routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads active debts and credits for the current user', async () => {
    apiGet.mockResolvedValue({ success: true, data: [] });

    await budgetService.getDebts(5, undefined, { activeOnly: true });
    await budgetService.getCredits(5, 'PENDING', { activeOnly: true });

    expect(apiGet).toHaveBeenNthCalledWith(
      1,
      '/budget/debts?userId=5&activeOnly=true'
    );
    expect(apiGet).toHaveBeenNthCalledWith(
      2,
      '/budget/credits?userId=5&status=PENDING&activeOnly=true'
    );
  });

  it('sends payment state mutations to budget endpoints', async () => {
    apiPost.mockResolvedValue({ success: true });

    await budgetService.markAsPaid(11);
    await budgetService.cancelMark(11);
    await budgetService.confirmPayment(11);
    await budgetService.markAllPaid(7);

    expect(apiPost).toHaveBeenNthCalledWith(1, '/budget/mark-paid', {
      transactionId: 11,
    });
    expect(apiPost).toHaveBeenNthCalledWith(2, '/budget/cancel-mark', {
      transactionId: 11,
    });
    expect(apiPost).toHaveBeenNthCalledWith(3, '/budget/confirm-payment', {
      transactionId: 11,
    });
    expect(apiPost).toHaveBeenNthCalledWith(4, '/budget/mark-all-paid', {
      pollId: 7,
    });
  });

  it('sends reminder requests and returns the bulk reminder result', async () => {
    apiPost
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        data: {
          sentCount: 2,
          failedCount: 0,
          totalCount: 2,
          failedUsers: [],
        },
      });

    await budgetService.sendReminder(11);
    const result = await budgetService.sendRemindersToAll(7);

    expect(apiPost).toHaveBeenNthCalledWith(1, '/budget/send-reminder', {
      transactionId: 11,
    });
    expect(apiPost).toHaveBeenNthCalledWith(2, '/budget/send-reminders-all', {
      pollId: 7,
    });
    expect(result.sentCount).toBe(2);
  });

  it('sets order costs and loads poll cost breakdown', async () => {
    apiPost.mockResolvedValue({ success: true, data: { id: 1 } });
    apiGet.mockResolvedValue({
      success: true,
      data: {
        pollId: 7,
        totalItemsCost: 300,
        totalDeliveryCost: 60,
        totalServiceFee: 0,
        totalTip: 0,
        grandTotal: 360,
        participantsCount: 3,
        transactions: [],
      },
    });

    await budgetService.setOrderCosts(7, {
      deliveryCost: 60,
      serviceFee: 0,
      tip: 0,
      notes: 'delivery',
    });
    const breakdown = await budgetService.getPollCostBreakdown(7);

    expect(apiPost).toHaveBeenCalledWith('/budget/order-costs/7', {
      deliveryCost: 60,
      serviceFee: 0,
      tip: 0,
      notes: 'delivery',
    });
    expect(apiGet).toHaveBeenCalledWith('/budget/poll-breakdown/7');
    expect(breakdown.grandTotal).toBe(360);
  });
});

describe('budgetService.openSBP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.Telegram = {
      WebApp: {
        openLink: vi.fn(),
      },
    };
  });

  it('opens a sanitized SBP link with amount in kopecks and phone digits only', () => {
    budgetService.openSBP('+7 (999) 123-45-67', 350.25);

    const openLink = window.Telegram?.WebApp?.openLink as ReturnType<typeof vi.fn>;
    expect(openLink).toHaveBeenCalledTimes(1);

    const url = new URL(openLink.mock.calls[0][0]);
    expect(url.origin).toBe('https://qr.nspk.ru');
    expect(url.searchParams.get('sum')).toBe('35025');
    expect(url.searchParams.get('cur')).toBe('RUB');
    expect(url.searchParams.get('payeeId')).toBe('79991234567');
  });
});
