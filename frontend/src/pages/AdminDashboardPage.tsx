import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GlassCard } from '../components/glass';
import { MediumWaveGradient } from '../components/background';
import {
  Shield,
  Activity,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Crown,
  Eye,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { pollsService } from '../services/polls.service';
import { userService } from '../services/user.service';
import { cn } from '../lib/utils';

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
  const hasShownError = useRef(false); // Предотвращение двойного уведомления
  const [stats, setStats] = useState({
    totalPolls: 0,
    activePolls: 0,
    completedPolls: 0,
    totalUsers: 0,
    activeUsers: 0,
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
      if (!hasShownError.current) {
        addNotification({
          type: 'error',
          message: '🔒 Требуются права администратора',
        });
        hasShownError.current = true;
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

      // Загружаем статистику голосований
      const pollStatsResponse = await pollsService.getPollStats();
      if (pollStatsResponse.success && pollStatsResponse.data) {
        setStats(prev => ({
          ...prev,
          totalPolls: pollStatsResponse.data.totalPolls || 0,
          activePolls: pollStatsResponse.data.activePolls || 0,
          completedPolls: pollStatsResponse.data.completedPolls || 0,
          totalVotes: pollStatsResponse.data.totalVotes || 0,
        }));
      }

      // Загружаем историю для логов (последние 10 действий)
      const historyResponse = await pollsService.getPollHistory({
        limit: 10,
        offset: 0,
      });
      
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
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки данных панели',
      });
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
        <MediumWaveGradient />
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      <MediumWaveGradient />

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
            <RefreshCw
              size={20}
              className={cn(
                'text-gray-600 dark:text-gray-400',
                refreshing && 'animate-spin'
              )}
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
          <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-4">
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
          </GlassCard>

          {/* Active Polls */}
          <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <Activity className="text-green-500" size={20} />
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
          </GlassCard>

          {/* Completed Polls */}
          <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <CheckCircle className="text-purple-500" size={20} />
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
          </GlassCard>

          {/* Total Votes */}
          <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <TrendingUp className="text-orange-500" size={20} />
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
          </GlassCard>
        </motion.div>

        {/* Admin Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <Crown className="text-yellow-500" size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Привилегии администратора
                </h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Создание и управление голосованиями</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Редактирование меню</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Завершение и отмена голосований</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Просмотр полной статистики</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Recent Activity Logs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-gray-600 dark:text-gray-400" />
            Последние действия
          </h2>

          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-6">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Activity size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Пока нет записей в журнале</p>
                </div>
              </GlassCard>
            ) : (
              recentLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <GlassCard variant="light" theme={isDark ? 'dark' : 'light'} className="p-4">
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
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-500" />
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
                  </GlassCard>
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
          <GlassCard variant="medium" theme={isDark ? 'dark' : 'light'} className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
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
          </GlassCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => navigate('/poll/create')}
            className="p-4 rounded-xl bg-gradient-to-br from-primary-food-500 to-primary-food-600 text-white shadow-lg hover:shadow-xl transition-all"
          >
            <Activity size={24} className="mb-2" />
            <div className="text-sm font-semibold">Создать голосование</div>
          </button>

          <button
            onClick={() => navigate('/menu')}
            className="p-4 rounded-xl bg-gradient-to-br from-mint-500 to-mint-600 text-white shadow-lg hover:shadow-xl transition-all"
          >
            <Eye size={24} className="mb-2" />
            <div className="text-sm font-semibold">Управление меню</div>
          </button>
        </motion.div>
      </div>
    </>
  );
};
