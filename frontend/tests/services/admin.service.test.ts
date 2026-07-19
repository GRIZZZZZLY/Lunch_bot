import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../../src/services/admin.service';

const { apiGet, apiPut, apiPost, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('../../src/services/api.service', () => ({
  apiService: {
    delete: apiDelete,
    get: apiGet,
    post: apiPost,
    put: apiPut,
  },
}));

describe('admin service Mini App endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ success: true, data: {} });
    apiPut.mockResolvedValue({ success: true, data: {} });
    apiPost.mockResolvedValue({ success: true, data: {} });
    apiDelete.mockResolvedValue({ success: true, data: {} });
  });

  it('loads dashboard users, debts, cleanup stats, and settings for a group', async () => {
    await adminService.getAllUsers(2);
    await adminService.getAllDebtors(2);
    await adminService.getDebtStats(2);
    await adminService.getCleanupStats(2);
    await adminService.getReminderSettings(2);
    await adminService.getAdminNotificationSettings(2);

    expect(apiGet).toHaveBeenNthCalledWith(1, '/admin/users?groupId=2');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/admin/debtors?groupId=2');
    expect(apiGet).toHaveBeenNthCalledWith(3, '/admin/debt-stats?groupId=2');
    expect(apiGet).toHaveBeenNthCalledWith(4, '/admin/cleanup/stats?groupId=2');
    expect(apiGet).toHaveBeenNthCalledWith(5, '/admin/reminder-settings/2');
    expect(apiGet).toHaveBeenNthCalledWith(6, '/admin/notification-settings/2');
  });

  it('sends admin actions with the selected group id', async () => {
    await adminService.toggleAdmin(5, true, 2);
    await adminService.toggleActive(5, false, 2);
    await adminService.toggleParticipatesInPolls(5, false, 2);
    await adminService.forgiveDebt(9, 2);
    await adminService.remindDebtor(9, 2);
    await adminService.remindAllDebtors(2);
    await adminService.cleanupOldPolls(30, 2);
    await adminService.cleanupOldTransactions(90, 2);

    expect(apiPut).toHaveBeenNthCalledWith(1, '/admin/users/5/admin?groupId=2', {
      isAdmin: true,
    });
    expect(apiPut).toHaveBeenNthCalledWith(2, '/admin/users/5/active?groupId=2', {
      isActive: false,
    });
    expect(apiPut).toHaveBeenNthCalledWith(
      3,
      '/admin/users/5/participates-in-polls?groupId=2',
      { participates: false }
    );
    expect(apiPost).toHaveBeenNthCalledWith(1, '/admin/debts/9/forgive?groupId=2', {});
    expect(apiPost).toHaveBeenNthCalledWith(2, '/admin/debts/9/remind?groupId=2', {});
    expect(apiPost).toHaveBeenNthCalledWith(3, '/admin/debts/remind-all?groupId=2', {});
    expect(apiDelete).toHaveBeenNthCalledWith(
      1,
      '/admin/cleanup/old-polls?daysOld=30&groupId=2'
    );
    expect(apiDelete).toHaveBeenNthCalledWith(
      2,
      '/admin/cleanup/old-transactions?daysOld=90&groupId=2'
    );
  });

  it('saves reminder and notification settings', async () => {
    await adminService.updateReminderSettings(2, {
      intervalDays: 4,
      isEnabled: false,
    });
    await adminService.updateAdminNotificationSettings(2, {
      notifyOnDebtPaid: true,
    });

    expect(apiPut).toHaveBeenNthCalledWith(1, '/admin/reminder-settings/2', {
      intervalDays: 4,
      isEnabled: false,
    });
    expect(apiPut).toHaveBeenNthCalledWith(2, '/admin/notification-settings/2', {
      notifyOnDebtPaid: true,
    });
  });
});
