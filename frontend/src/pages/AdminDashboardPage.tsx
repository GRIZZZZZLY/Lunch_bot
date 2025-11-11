import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PastelCard, CardHeader, CardContent, CardTitle } from '../components/ui/pastel-card';
import { Badge } from '../components/ui/badge';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import {
  Shield,
  Activity,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Crown,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService } from '../services/polls.service';
import { cn } from '../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface AdminLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: Date;
  status: 'success' | 'error';
}

/**
 * 🔐 Admin Dashboard
 * Панель управления и мониторинга для администраторов
 */
export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasShownAccessError = useRef(false); // Предотвращение двойного уведомления о правах
  const hasShownLoadError = useRef(false); // Предотвращение двойного уведомления о загрузке
  const [stats, setStats] = useState({
    totalPolls: 0,
    activePolls: 0,
    completedPolls: 0,
    totalVotes: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AdminLog[]>([]);

  useEffect(() => {
    // Ждём пока загрузится пользователь
    if (authLoading) {
      return;
    }

    // Проверка прав доступа
    if (!user?.isAdmin) {
      // Показываем уведомление только один раз (защита от React Strict Mode)
      if (!hasShownAccessError.current) {
        addNotification({
          type: 'error',
          message: '🔒 Требуются права администратора',
        });
        hasShownAccessError.current = true;
      }
      navigate('/profile');
      return;
    }

    loadDashboardData();

    backButton.onClick(() => navigate('/profile'));
    backButton.show();

    return () => {
      backButton.hide();
    };
  }, [user, authLoading, navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // ✅ ОПТИМИЗАЦИЯ: Параллельная загрузка stats и history
      console.log('[AdminDashboard] Loading data in parallel...');
      const [pollStatsResponse, historyResponse] = await Promise.all([
        pollsService.getPollStats(),
        pollsService.getPollHistory({ limit: 10, offset: 0 })
      ]);
      
      // Обрабатываем stats response
      console.log('[AdminDashboard] Poll stats response:', pollStatsResponse);
      if (pollStatsResponse.success && pollStatsResponse.data) {
        setStats(prev => ({
          ...prev,
          totalPolls: pollStatsResponse.data.totalPolls || 0,
          activePolls: pollStatsResponse.data.activePolls || 0,
          completedPolls: pollStatsResponse.data.completedPolls || 0,
          totalVotes: pollStatsResponse.data.totalVotes || 0,
        }));
        console.log('[AdminDashboard] Stats updated successfully');
      } else {
        console.error('[AdminDashboard] Failed to load stats:', pollStatsResponse);
      }

      // Обрабатываем history response
      console.log('[AdminDashboard] Poll history response:', historyResponse);
      
      if (historyResponse.success && historyResponse.data) {
        // Преобразуем историю в логи
        const logs: AdminLog[] = historyResponse.data.polls.map((poll: any) => ({
          id: `poll-${poll.id}`,
          action: poll.status === 'COMPLETED' ? 'Завершил голосование' : 'Создал голосование',
          actor: `Admin #${poll.createdBy}`,
          target: `Poll #${poll.id}`,
          timestamp: new Date(poll.updatedAt),
          status: 'success' as const,
        }));
        setRecentLogs(logs);
        console.log('[AdminDashboard] History logs updated successfully:', logs.length);
      } else {
        console.error('[AdminDashboard] Failed to load history:', historyResponse);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Показываем уведомление только один раз (защита от React Strict Mode)
      if (!hasShownLoadError.current) {
        addNotification({
          type: 'error',
          message: 'Ошибка загрузки данных панели',
        });
        hasShownLoadError.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    addNotification({
      type: 'success',
      message: '✅ Данные обновлены',
    });
  };

  // Показываем загрузку пока проверяем права или загружаем данные
  if (authLoading || loading) {
    return (
      <div className="min-h-screen relative">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}

      <div className="space-y-6 relative pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="text-primary-food-500" size={28} />
              Панель администратора
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Мониторинг и управление системой
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              'p-2 rounded-lg transition-all',
              refreshing
                ? 'bg-gray-100 dark:bg-gray-800 cursor-wait'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <RefreshCw className={ICON_SIZES.md}
            />
          </button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          {/* Total Polls */}
          <PastelCard variant="default" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <BarChart3 className="text-blue-500" size={20} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalPolls}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Всего голосований
                </div>
              </div>
            </div>
          </PastelCard>

          {/* Active Polls */}
          <PastelCard variant="default" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <Activity className={`${ICON_SIZES.md} text-green-500`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.activePolls}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Активные
                </div>
              </div>
            </div>
          </PastelCard>

          {/* Completed Polls */}
          <PastelCard variant="default" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <CheckCircle className={`${ICON_SIZES.md} text-purple-500`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.completedPolls}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Завершено
                </div>
              </div>
            </div>
          </PastelCard>

          {/* Total Votes */}
          <PastelCard variant="default" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <TrendingUp className={`${ICON_SIZES.md} text-orange-500`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalVotes}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Всего голосов
                </div>
              </div>
            </div>
          </PastelCard>
        </motion.div>

        {/* Admin Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PastelCard variant="default" className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <Crown className={`${ICON_SIZES.md} text-yellow-500`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Привилегии администратора
                </h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={cn(ICON_SIZES.sm, "text-green-500")} />
                    <span>Создание и управление голосованиями</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={cn(ICON_SIZES.sm, "text-green-500")} />
                    <span>Редактирование меню</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={cn(ICON_SIZES.sm, "text-green-500")} />
                    <span>Завершение и отмена голосований</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={cn(ICON_SIZES.sm, "text-green-500")} />
                    <span>Просмотр полной статистики</span>
                  </div>
                </div>
              </div>
            </div>
          </PastelCard>
        </motion.div>

        {/* Recent Activity Logs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className={cn(ICON_SIZES.md, "text-gray-600 dark:text-gray-400")} />
            Последние действия
          </h2>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <PastelCard variant="default" className="p-6">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Activity className={cn(ICON_SIZES.xl, "mx-auto mb-2 opacity-50")} />
                  <p className="text-sm">Пока нет записей в журнале</p>
                </div>
              </PastelCard>
            ) : (
              recentLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <PastelCard variant="default" className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-1.5 rounded-lg',
                          log.status === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'bg-red-50 dark:bg-red-900/20'
                        )}
                      >
                        {log.status === 'success' ? (
                          <CheckCircle className={cn(ICON_SIZES.sm, "text-green-500")} />
                        ) : (
                          <XCircle className={cn(ICON_SIZES.sm, "text-red-500")} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {log.action}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString('ru', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {log.actor} → {log.target}
                        </p>
                      </div>
                    </div>
                  </PastelCard>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <PastelCard variant="default" className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className={cn(ICON_SIZES.md, "text-blue-500 flex-shrink-0 mt-0.5")} />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium text-gray-900 dark:text-white mb-1">
                  Безопасность
                </p>
                <p>
                  Все ваши действия логируются и могут быть проверены. Используйте админские
                  привилегии ответственно.
                </p>
              </div>
            </div>
          </PastelCard>
        </motion.div>
      </div>
    </>
  );
};
