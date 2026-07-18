import { apiService, ApiResponse } from './api.service';

export interface UserWithActivity {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  participatesInPolls: boolean;
  createdAt: string;
  updatedAt: string;
  // Activity stats
  totalVotes: number;
  totalDebts: number;
  totalCredits: number;
  pendingDebts: number;
  lastActivity: string | null;
}

export interface PollParticipantInfo {
  userId: number;
  status: 'EXPECTED' | 'EXCLUDED';
  reason: string | null;
  hasVoted: boolean;
  user: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
    photoUrl: string | null;
  };
}

export interface SetPollParticipantStatusResponse extends ApiResponse<unknown> {
  autoClosed?: boolean;
}

export interface DebtorInfo {
  userId: number;
  userName: string;
  telegramId: string;
  totalDebt: number;
  oldestDebt: string | null;
  debtCount: number;
  debts: Array<{
    id: number;
    amount: number;
    createdAt: string;
    pollId: number;
    toUser: {
      id: number;
      firstName: string;
    };
  }>;
}

export interface DebtStats {
  totalDebtors: number;
  totalDebtAmount: number;
  avgDebtPerUser: number;
  oldestDebtAge: number;
}

export interface CleanupStats {
  oldPolls: {
    count30Days: number;
    count60Days: number;
    count90Days: number;
  };
  oldTransactions: {
    count30Days: number;
    count60Days: number;
    count90Days: number;
  };
}

export interface ReminderSettings {
  id: number;
  groupId: number;
  isEnabled: boolean;
  intervalDays: number;
  messageTemplate: string;
  minDebtAge: number;
  maxReminders: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNotificationSettings {
  id: number;
  groupId: number;
  notifyOnNewUser: boolean;
  notifyOnNewPoll: boolean;
  notifyOnPollEnd: boolean;
  notifyOnDebtPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

class AdminService {
  // ===== User Management =====

  async getAllUsers(groupId: number): Promise<ApiResponse<UserWithActivity[]>> {
    return apiService.get(`/admin/users?groupId=${groupId}`);
  }

  async getUserStats(userId: number, groupId: number): Promise<ApiResponse<any>> {
    return apiService.get(`/admin/users/${userId}/stats?groupId=${groupId}`);
  }

  async toggleAdmin(
    userId: number,
    isAdmin: boolean,
    groupId: number
  ): Promise<ApiResponse<any>> {
    return apiService.put(`/admin/users/${userId}/admin?groupId=${groupId}`, {
      isAdmin,
    });
  }

  async toggleActive(
    userId: number,
    isActive: boolean,
    groupId: number
  ): Promise<ApiResponse<any>> {
    return apiService.put(`/admin/users/${userId}/active?groupId=${groupId}`, {
      isActive,
    });
  }

  async toggleParticipatesInPolls(
    userId: number,
    participates: boolean,
    groupId: number
  ): Promise<ApiResponse<{ id: number; participatesInPolls: boolean; firstName: string; lastName: string | null }>> {
    return apiService.put(
      `/admin/users/${userId}/participates-in-polls?groupId=${groupId}`,
      { participates }
    );
  }

  // ===== Poll Participants (per-poll override) =====

  async getPollParticipants(pollId: number): Promise<ApiResponse<PollParticipantInfo[]>> {
    return apiService.get(`/admin/polls/${pollId}/participants`);
  }

  async setPollParticipantStatus(
    pollId: number,
    userId: number,
    status: 'EXPECTED' | 'EXCLUDED',
    reason?: string
  ): Promise<SetPollParticipantStatusResponse> {
    return apiService.put(`/admin/polls/${pollId}/participants/${userId}`, {
      status,
      reason,
    });
  }

  // ===== Debt Management =====

  async getAllDebtors(groupId: number): Promise<ApiResponse<DebtorInfo[]>> {
    return apiService.get(`/admin/debtors?groupId=${groupId}`);
  }

  async getDebtStats(groupId: number): Promise<ApiResponse<DebtStats>> {
    return apiService.get(`/admin/debt-stats?groupId=${groupId}`);
  }

  async forgiveDebt(debtId: number, groupId: number): Promise<ApiResponse<any>> {
    return apiService.post(`/admin/debts/${debtId}/forgive?groupId=${groupId}`, {});
  }

  async remindAllDebtors(
    groupId: number
  ): Promise<ApiResponse<{ sent: number; total: number }>> {
    return apiService.post(`/admin/debts/remind-all?groupId=${groupId}`, {});
  }

  async remindDebtor(debtId: number, groupId: number): Promise<ApiResponse<void>> {
    return apiService.post(`/admin/debts/${debtId}/remind?groupId=${groupId}`, {});
  }

  // ===== Data Cleanup =====

  async cleanupOldPolls(
    daysOld: number = 30,
    groupId: number
  ): Promise<ApiResponse<{ deleted: number }>> {
    return apiService.delete(
      `/admin/cleanup/old-polls?daysOld=${daysOld}&groupId=${groupId}`
    );
  }

  async cleanupOldTransactions(
    daysOld: number = 90,
    groupId: number
  ): Promise<ApiResponse<{ deleted: number }>> {
    return apiService.delete(
      `/admin/cleanup/old-transactions?daysOld=${daysOld}&groupId=${groupId}`
    );
  }

  async getCleanupStats(groupId: number): Promise<ApiResponse<CleanupStats>> {
    return apiService.get(`/admin/cleanup/stats?groupId=${groupId}`);
  }

  // ===== Reminder Settings =====

  async getReminderSettings(groupId: number): Promise<ApiResponse<ReminderSettings>> {
    return apiService.get(`/admin/reminder-settings/${groupId}`);
  }

  async updateReminderSettings(
    groupId: number,
    settings: Partial<ReminderSettings>
  ): Promise<ApiResponse<ReminderSettings>> {
    return apiService.put(`/admin/reminder-settings/${groupId}`, settings);
  }

  async getAdminNotificationSettings(groupId: number): Promise<ApiResponse<AdminNotificationSettings>> {
    return apiService.get(`/admin/notification-settings/${groupId}`);
  }

  async updateAdminNotificationSettings(
    groupId: number,
    settings: Partial<AdminNotificationSettings>
  ): Promise<ApiResponse<AdminNotificationSettings>> {
    return apiService.put(`/admin/notification-settings/${groupId}`, settings);
  }
}

export const adminService = new AdminService();
