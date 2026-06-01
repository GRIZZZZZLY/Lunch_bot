import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PastelCard } from '../components/ui/pastel-card';
import { UserManagementCard } from '../components/admin/UserManagementCard';
import { DebtManagementCard } from '../components/admin/DebtManagementCard';
import { DataCleanupCard } from '../components/admin/DataCleanupCard';
import { ReminderSettingsCard } from '../components/admin/ReminderSettingsCard';
import {
  Shield,
  Activity,
  TrendingUp,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Users,
  DollarSign,
  Database,
  Settings,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useAppStore } from '../store/useAppStore';
import { pollsService } from '../services/polls.service';
import { userService } from '../services/user.service';
import type { UserGroup } from '../types/auth.types';
import { 
  adminService, 
  UserWithActivity, 
  DebtorInfo, 
  DebtStats, 
  CleanupStats,
  ReminderSettings,
  AdminNotificationSettings,
} from '../services/admin.service';
import { cn } from '../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

/**
 * 🔐 Admin Dashboard
 * Панель управления и мониторинга для администраторов
 */
export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { backButton } = useTelegram();
  const addNotification = useAppStore((state) => state.addNotification);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const hasShownAccessError = useRef(false);

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const preferredGroupId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const groupId = params.get('groupId');
    return groupId ? Number(groupId) : null;
  }, [location.search]);
  
  // Stats state
  const [stats, setStats] = useState({
    totalPolls: 0,
    activePolls: 0,
    completedPolls: 0,
    totalVotes: 0,
  });

  // Admin data state
  const [users, setUsers] = useState<UserWithActivity[]>([]);
  const [debtors, setDebtors] = useState<DebtorInfo[]>([]);
  const [debtStats, setDebtStats] = useState<DebtStats | null>(null);
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<AdminNotificationSettings | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'debts' | 'cleanup' | 'settings'>('overview');

  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const groupsResponse = await userService.getUserGroups();

      if (groupsResponse.success && groupsResponse.data) {
        setGroups(groupsResponse.data);
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    try {
      if (!selectedGroupId) return;

      const [usersRes, debtorsRes, debtStatsRes, cleanupStatsRes, reminderRes, notificationRes] = await Promise.all([
        adminService.getAllUsers(selectedGroupId),
        adminService.getAllDebtors(selectedGroupId),
        adminService.getDebtStats(selectedGroupId),
        adminService.getCleanupStats(selectedGroupId),
        adminService.getReminderSettings(selectedGroupId),
        adminService.getAdminNotificationSettings(selectedGroupId),
      ]);

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }

      if (debtorsRes.success && debtorsRes.data) {
        setDebtors(debtorsRes.data);
      }

      if (debtStatsRes.success && debtStatsRes.data) {
        setDebtStats(debtStatsRes.data);
      }

      if (cleanupStatsRes.success && cleanupStatsRes.data) {
        setCleanupStats(cleanupStatsRes.data);
      }

      if (reminderRes.success && reminderRes.data) {
        setReminderSettings(reminderRes.data);
      }

      if (notificationRes.success && notificationRes.data) {
        setNotificationSettings(notificationRes.data);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  }, [selectedGroupId]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      if (!selectedGroupId) {
        setLoading(false);
        return;
      }

      // Загружаем базовую статистику
      const [pollStatsResponse] = await Promise.all([
        pollsService.getPollStats(selectedGroupId),
      ]);

      if (pollStatsResponse.success && pollStatsResponse.data) {
        setStats({
          totalPolls: pollStatsResponse.data.totalPolls || 0,
          activePolls: pollStatsResponse.data.activePolls || 0,
          completedPolls: pollStatsResponse.data.completedPolls || 0,
          totalVotes: pollStatsResponse.data.totalVotes || 0,
        });
      }

      // Загружаем админские данные параллельно
      await loadAdminData();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки данных панели',
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification, loadAdminData, selectedGroupId]);

  const adminGroups = useMemo(() => {
    if (user?.isAdmin) {
      return groups;
    }

    return groups.filter((group) =>
      ['ADMIN', 'CREATOR'].includes(group.role || '')
    );
  }, [groups, user?.isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    loadGroups();
  }, [authLoading, loadGroups]);

  useEffect(() => {
    if (authLoading || groupsLoading) return;

    if (!user?.isAdmin && adminGroups.length === 0) {
      if (!hasShownAccessError.current) {
        addNotification({
          type: 'error',
          message: '🔒 Требуются права администратора группы',
        });
        hasShownAccessError.current = true;
      }
      navigate('/profile');
      return;
    }

    if (!selectedGroupId && adminGroups.length > 0) {
      const nextGroupId =
        preferredGroupId &&
        adminGroups.some((group) => group.id === preferredGroupId)
          ? preferredGroupId
          : adminGroups[0].id;
      setSelectedGroupId(nextGroupId);
    }
  }, [
    adminGroups,
    authLoading,
    groupsLoading,
    user?.isAdmin,
    addNotification,
    navigate,
    preferredGroupId,
    selectedGroupId,
  ]);

  useEffect(() => {
    if (!selectedGroupId || authLoading || groupsLoading) return;

    loadDashboardData();

    backButton.onClick(() => navigate('/profile'));
    backButton.show();

    return () => {
      backButton.hide();
    };
  }, [
    selectedGroupId,
    authLoading,
    groupsLoading,
    backButton,
    loadDashboardData,
    navigate,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    addNotification({
      type: 'success',
      message: '✅ Данные обновлены',
    });
  };

  // User management handlers
  const handleToggleAdmin = async (userId: number, isAdmin: boolean) => {
    try {
      if (!selectedGroupId) return;

      const response = await adminService.toggleAdmin(
        userId,
        isAdmin,
        selectedGroupId
      );
      if (response.success) {
        addNotification({
          type: 'success',
          message: response.message || 'Права изменены',
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка изменения прав',
      });
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      if (!selectedGroupId) return;

      const response = await adminService.toggleActive(
        userId,
        isActive,
        selectedGroupId
      );
      if (response.success) {
        addNotification({
          type: 'success',
          message: response.message || 'Статус изменён',
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка изменения статуса',
      });
    }
  };

  const handleToggleParticipates = async (userId: number, participates: boolean) => {
    try {
      if (!selectedGroupId) return;
      const response = await adminService.toggleParticipatesInPolls(
        userId,
        participates,
        selectedGroupId
      );
      if (response.success) {
        addNotification({
          type: 'success',
          message: response.message || (participates ? 'В офисе' : 'На удалёнке'),
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка изменения участия в голосованиях',
      });
    }
  };

  // Debt management handlers
  const handleForgiveDebt = async (debtId: number) => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.forgiveDebt(debtId, selectedGroupId);
      if (response.success) {
        addNotification({
          type: 'success',
          message: 'Долг списан',
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка списания долга',
      });
    }
  };

  const handleRemindDebtor = async (debtId: number) => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.remindDebtor(debtId, selectedGroupId);
      if (response.success) {
        addNotification({
          type: 'success',
          message: 'Напоминание отправлено',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка отправки напоминания',
      });
    }
  };

  const handleRemindAll = async () => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.remindAllDebtors(selectedGroupId);
      if (response.success && response.data) {
        addNotification({
          type: 'success',
          message: `Отправлено ${response.data.sent} из ${response.data.total} напоминаний`,
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка отправки напоминаний',
      });
    }
  };

  // Cleanup handlers
  const handleCleanupPolls = async (daysOld: number) => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.cleanupOldPolls(daysOld, selectedGroupId);
      if (response.success && response.data) {
        addNotification({
          type: 'success',
          message: `Удалено ${response.data.deleted} голосований`,
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка очистки',
      });
    }
  };

  const handleCleanupTransactions = async (daysOld: number) => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.cleanupOldTransactions(
      daysOld,
      selectedGroupId
    );
      if (response.success && response.data) {
        addNotification({
          type: 'success',
          message: `Удалено ${response.data.deleted} транзакций`,
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка очистки',
      });
    }
  };

  // Reminder settings handlers
  const handleSaveReminderSettings = async (settings: Partial<ReminderSettings>) => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.updateReminderSettings(
      selectedGroupId,
      settings
    );
      if (response.success) {
        addNotification({
          type: 'success',
          message: 'Настройки напоминаний сохранены',
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка сохранения настроек',
      });
      throw error;
    }
  };

  const handleSaveNotificationSettings = async (settings: Partial<AdminNotificationSettings>) => {
    try {
    if (!selectedGroupId) return;

    const response = await adminService.updateAdminNotificationSettings(
      selectedGroupId,
      settings
    );
      if (response.success) {
        addNotification({
          type: 'success',
          message: 'Настройки уведомлений сохранены',
        });
        await loadAdminData();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Ошибка сохранения настроек',
      });
      throw error;
    }
  };

  if (authLoading || loading || groupsLoading) {
    return (
      <div className="min-h-screen relative">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Shield className="text-primary" size={28} />
            Панель администратора
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Мониторинг и управление системой
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'admin-icon-pill disabled:opacity-60 disabled:cursor-wait',
            refreshing && 'opacity-70'
          )}
        >
          <RefreshCw className={cn(ICON_SIZES.md, refreshing && 'animate-spin')} />
          <span className="text-sm font-medium">Обновить</span>
        </button>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="admin-tab-rail"
      >
        {[
          { id: 'overview', label: 'Обзор', icon: BarChart3 },
          { id: 'users', label: 'Пользователи', icon: Users, badge: users.length },
          { id: 'debts', label: 'Долги', icon: DollarSign, badge: debtors.length },
          { id: 'cleanup', label: 'Очистка', icon: Database },
          { id: 'settings', label: 'Настройки', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'admin-tab',
              activeTab === tab.id && 'admin-tab--active'
            )}
          >
            <tab.icon className={ICON_SIZES.sm} />
            {tab.label}
            {tab.badge !== undefined && (
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-xs',
                activeTab === tab.id ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            <PastelCard variant="default" className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.totalPolls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Всего голосований
                  </div>
                </div>
              </div>
            </PastelCard>

            <PastelCard variant="default" className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-mint-500/12 p-2 text-mint-600 dark:text-mint-400">
                  <Activity className={ICON_SIZES.md} />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.activePolls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Активные
                  </div>
                </div>
              </div>
            </PastelCard>

            <PastelCard variant="default" className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-lavender-500/12 p-2 text-lavender-600 dark:text-lavender-400">
                  <CheckCircle className={ICON_SIZES.md} />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.completedPolls}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Завершено
                  </div>
                </div>
              </div>
            </PastelCard>

            <PastelCard variant="default" className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-butter-500/12 p-2 text-butter-600 dark:text-butter-400">
                  <TrendingUp className={cn(ICON_SIZES.md)} />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.totalVotes}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Всего голосов
                  </div>
                </div>
              </div>
            </PastelCard>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-3"
          >
            <PastelCard variant="default" className="p-3 text-center">
              <div className="text-xl font-semibold text-foreground">{users.length}</div>
              <div className="text-xs text-muted-foreground">Пользователей</div>
            </PastelCard>

            <PastelCard variant="default" className="p-3 text-center">
              <div className="text-xl font-semibold text-coral-600 dark:text-coral-400">{debtors.length}</div>
              <div className="text-xs text-muted-foreground">Должников</div>
            </PastelCard>

            <PastelCard variant="default" className="p-3 text-center">
              <div className="text-xl font-semibold text-lavender-600 dark:text-lavender-400">
                {debtStats?.totalDebtAmount.toFixed(0)}₽
              </div>
              <div className="text-xs text-muted-foreground">Долгов</div>
            </PastelCard>
          </motion.div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <UserManagementCard
            users={users}
            onToggleAdmin={handleToggleAdmin}
            onToggleActive={handleToggleActive}
            onToggleParticipates={handleToggleParticipates}
            loading={refreshing}
          />
        </motion.div>
      )}

      {/* Debts Tab */}
      {activeTab === 'debts' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DebtManagementCard
            debtors={debtors}
            stats={debtStats}
            onForgiveDebt={handleForgiveDebt}
            onRemindDebtor={handleRemindDebtor}
            onRemindAll={handleRemindAll}
            loading={refreshing}
          />
        </motion.div>
      )}

      {/* Cleanup Tab */}
      {activeTab === 'cleanup' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DataCleanupCard
            stats={cleanupStats}
            onCleanupPolls={handleCleanupPolls}
            onCleanupTransactions={handleCleanupTransactions}
            loading={refreshing}
          />
        </motion.div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ReminderSettingsCard
            reminderSettings={reminderSettings}
            notificationSettings={notificationSettings}
            onSaveReminderSettings={handleSaveReminderSettings}
            onSaveNotificationSettings={handleSaveNotificationSettings}
            loading={refreshing}
          />
        </motion.div>
      )}
    </div>
  );
};
