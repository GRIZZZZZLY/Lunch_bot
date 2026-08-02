import { apiService } from './api.service';

export interface UserWithActivity {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalVotes: number;
  totalDebts: number;
  totalCredits: number;
  pendingDebts: number;
  lastActivity: string | null;
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
    toUser: { id: number; firstName: string };
  }>;
}

export interface DebtStats {
  totalDebtors: number;
  totalDebtAmount: number;
  avgDebtPerUser: number;
  oldestDebtAge: number;
}

export interface CleanupStats {
  oldPolls: { count30Days: number; count60Days: number; count90Days: number };
  oldTransactions: { count30Days: number; count60Days: number; count90Days: number };
}

/** Что удалит очистка за конкретный срок и что удержат непогашенные долги. */
export interface CleanupPreview {
  deletable: number;
  blockedByDebt: number;
}

export interface CleanupResult {
  deleted: number;
  skipped: number;
  skippedReason?: string;
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
  getAllUsers(groupId: number) {
    return apiService.get<UserWithActivity[]>(`/admin/users?groupId=${groupId}`);
  }

  toggleAdmin(userId: number, isAdmin: boolean, groupId: number) {
    return apiService.put(`/admin/users/${userId}/admin?groupId=${groupId}`, { isAdmin });
  }

  toggleActive(userId: number, isActive: boolean, groupId: number) {
    return apiService.put(`/admin/users/${userId}/active?groupId=${groupId}`, { isActive });
  }

  getAllDebtors(groupId: number) {
    return apiService.get<DebtorInfo[]>(`/admin/debtors?groupId=${groupId}`);
  }

  getDebtStats(groupId: number) {
    return apiService.get<DebtStats>(`/admin/debt-stats?groupId=${groupId}`);
  }

  forgiveDebt(debtId: number, groupId: number) {
    return apiService.post(`/admin/debts/${debtId}/forgive?groupId=${groupId}`, {});
  }

  remindAllDebtors(groupId: number) {
    return apiService.post<{ sent: number; total: number }>(
      `/admin/debts/remind-all?groupId=${groupId}`,
      {},
    );
  }

  remindDebtor(debtId: number, groupId: number) {
    return apiService.post(`/admin/debts/${debtId}/remind?groupId=${groupId}`, {});
  }

  cleanupOldPolls(daysOld: number, groupId: number) {
    return apiService.delete<CleanupResult>(
      `/admin/cleanup/old-polls?daysOld=${daysOld}&groupId=${groupId}`,
    );
  }

  cleanupOldTransactions(daysOld: number, groupId: number) {
    return apiService.delete<CleanupResult>(
      `/admin/cleanup/old-transactions?daysOld=${daysOld}&groupId=${groupId}`,
    );
  }

  /* Сколько уйдёт за конкретный срок. Статистика отдаёт только 30/60/90, а
     поле принимает любое число: подтверждать необратимое удаление вслепую
     нельзя. */
  previewCleanup(daysOld: number, groupId: number, kind: 'polls' | 'transactions') {
    return apiService.get<CleanupPreview>(
      `/admin/cleanup/preview?daysOld=${daysOld}&kind=${kind}&groupId=${groupId}`,
    );
  }

  getCleanupStats(groupId: number) {
    return apiService.get<CleanupStats>(`/admin/cleanup/stats?groupId=${groupId}`);
  }

  getReminderSettings(groupId: number) {
    return apiService.get<ReminderSettings>(`/admin/reminder-settings/${groupId}`);
  }

  updateReminderSettings(groupId: number, settings: Partial<ReminderSettings>) {
    return apiService.put<ReminderSettings>(`/admin/reminder-settings/${groupId}`, settings);
  }

  getAdminNotificationSettings(groupId: number) {
    return apiService.get<AdminNotificationSettings>(`/admin/notification-settings/${groupId}`);
  }

  updateAdminNotificationSettings(groupId: number, settings: Partial<AdminNotificationSettings>) {
    return apiService.put<AdminNotificationSettings>(
      `/admin/notification-settings/${groupId}`,
      settings,
    );
  }
}

export const adminService = new AdminService();
