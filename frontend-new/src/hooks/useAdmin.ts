import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService, type AdminNotificationSettings, type ReminderSettings } from '@/services/admin.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';

function useGroupId(): number | null {
  const raw = useAppStore((s) => s.currentGroupId);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function useAdminUsers() {
  const groupId = useGroupId();
  return useQuery({
    queryKey: groupId ? queryKeys.admin.users(groupId) : ['admin', 'users', 'noop'],
    queryFn: async () => {
      if (!groupId) return [];
      const res = await adminService.getAllUsers(groupId);
      return res.data ?? [];
    },
    enabled: !!groupId,
    staleTime: 10_000,
  });
}

export function useToggleAdmin() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: number; isAdmin: boolean }) => {
      if (!groupId) throw new Error('No group');
      return adminService.toggleAdmin(userId, isAdmin, groupId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

export function useToggleActive() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      if (!groupId) throw new Error('No group');
      return adminService.toggleActive(userId, isActive, groupId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

export function useAdminDebtors() {
  const groupId = useGroupId();
  return useQuery({
    queryKey: groupId ? queryKeys.admin.debtors(groupId) : ['admin', 'debtors', 'noop'],
    queryFn: async () => {
      if (!groupId) return [];
      const res = await adminService.getAllDebtors(groupId);
      return res.data ?? [];
    },
    enabled: !!groupId,
    staleTime: 10_000,
  });
}

export function useDebtStats() {
  const groupId = useGroupId();
  return useQuery({
    queryKey: groupId ? queryKeys.admin.debtStats(groupId) : ['admin', 'debt-stats', 'noop'],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await adminService.getDebtStats(groupId);
      return res.data ?? null;
    },
    enabled: !!groupId,
    staleTime: 15_000,
  });
}

export function useForgiveDebt() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: (debtId: number) => {
      if (!groupId) throw new Error('No group');
      return adminService.forgiveDebt(debtId, groupId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
      qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}

export function useRemindAllDebtors() {
  const groupId = useGroupId();
  return useMutation({
    mutationFn: () => {
      if (!groupId) throw new Error('No group');
      return adminService.remindAllDebtors(groupId);
    },
  });
}

export function useRemindDebtor() {
  const groupId = useGroupId();
  return useMutation({
    mutationFn: (debtId: number) => {
      if (!groupId) throw new Error('No group');
      return adminService.remindDebtor(debtId, groupId);
    },
  });
}

export function useCleanupStats() {
  const groupId = useGroupId();
  return useQuery({
    queryKey: groupId ? queryKeys.admin.cleanupStats(groupId) : ['admin', 'cleanup-stats', 'noop'],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await adminService.getCleanupStats(groupId);
      return res.data ?? null;
    },
    enabled: !!groupId,
    staleTime: 30_000,
  });
}

export function useCleanupOldPolls() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: (daysOld: number) => {
      if (!groupId) throw new Error('No group');
      return adminService.cleanupOldPolls(daysOld, groupId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
      qc.invalidateQueries({ queryKey: queryKeys.polls.all });
    },
  });
}

export function useCleanupOldTransactions() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: (daysOld: number) => {
      if (!groupId) throw new Error('No group');
      return adminService.cleanupOldTransactions(daysOld, groupId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
      qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}

export function useReminderSettings() {
  const groupId = useGroupId();
  return useQuery({
    queryKey: groupId ? queryKeys.admin.reminderSettings(groupId) : ['admin', 'reminder-settings', 'noop'],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await adminService.getReminderSettings(groupId);
      return res.data ?? null;
    },
    enabled: !!groupId,
  });
}

export function useUpdateReminderSettings() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: (settings: Partial<ReminderSettings>) => {
      if (!groupId) throw new Error('No group');
      return adminService.updateReminderSettings(groupId, settings);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

export function useNotificationSettings() {
  const groupId = useGroupId();
  return useQuery({
    queryKey: groupId ? queryKeys.admin.notificationSettings(groupId) : ['admin', 'notification-settings', 'noop'],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await adminService.getAdminNotificationSettings(groupId);
      return res.data ?? null;
    },
    enabled: !!groupId,
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  const groupId = useGroupId();
  return useMutation({
    mutationFn: (settings: Partial<AdminNotificationSettings>) => {
      if (!groupId) throw new Error('No group');
      return adminService.updateAdminNotificationSettings(groupId, settings);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}
