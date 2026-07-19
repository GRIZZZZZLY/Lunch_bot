import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationService } from '../../src/services/notification.service';

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

describe('notificationService Mini App endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks admins to start a poll for the selected group', async () => {
    apiPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          sentCount: 2,
          message: 'Администраторы получили напоминание',
        },
      },
    });

    const response = await notificationService.remindAdmin(2);

    expect(response.success).toBe(true);
    expect(apiPost).toHaveBeenCalledWith('/notifications/remind-admin', {
      groupId: 2,
    });
  });

  it('loads remind-admin cooldown for the selected group', async () => {
    apiGet.mockResolvedValue({
      data: {
        success: true,
        data: {
          cooldownEndsAt: '2026-07-01T20:00:00.000Z',
          isActive: true,
          lastReminderBy: { id: 5, name: 'Ivan' },
          minutesLeft: 12,
          secondsLeft: 720,
        },
      },
    });

    const response = await notificationService.getCooldownStatus(2);

    expect(response.data?.minutesLeft).toBe(12);
    expect(apiGet).toHaveBeenCalledWith('/notifications/cooldown/2');
  });
});
