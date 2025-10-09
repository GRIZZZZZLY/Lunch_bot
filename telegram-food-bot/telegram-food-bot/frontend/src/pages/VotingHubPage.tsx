import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Vote, 
  History, 
  TrendingUp, 
  Plus,
  ArrowLeft 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useBottomSheet } from '../components/common/BottomSheet';
import { pollsService, PollWithDetails } from '../services/polls.service';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '../components/ui/glass-card';
import { CreatePollForm } from '../components/polls';
import { MediumWaveGradient } from '../components/background';
import { cn } from '../lib/utils';

/**
 * VotingHubPage - Главная страница голосований (пустое состояние)
 * 
 * Показывается когда нет активных голосований
 * Отображает:
 * - Последнее завершённое голосование
 * - Личную статистику пользователя
 * - Кнопку создания (для админов)
 * - Быстрый доступ к истории
 */
export const VotingHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { backButton, colorScheme, hapticFeedback } = useTelegram();
  const { isOpen: isPollSheetOpen, open: openPollSheet, close: closePollSheet } = useBottomSheet();
  
  const isDark = colorScheme === 'dark';
  
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<PollWithDetails | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
    
    // Настройка back button
    backButton.show();
    backButton.onClick(() => navigate('/'));
    
    return () => {
      backButton.offClick(() => navigate('/'));
      backButton.hide();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // НЕ проверяем активные голосования - это делает VoteRouter
      // Эта страница показывается только когда голосований НЕТ
      console.log('[VotingHubPage] Loading data for empty state...');
      
      // Загружаем последнее голосование
      const historyResponse = await pollsService.getPollHistory({ limit: 1 });
      if (historyResponse.success && historyResponse.data && historyResponse.data.polls.length > 0) {
        setLastPoll(historyResponse.data.polls[0] as any);
      }
      
      // Загружаем статистику пользователя
      if (user) {
        const statsResponse = await pollsService.getUserParticipationStats();
        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
      }
      
    } catch (error) {
      console.error('[VotingHubPage] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = () => {
    hapticFeedback.impactOccurred('medium');
    openPollSheet();
  };

  const handlePollCreated = (pollId: number) => {
    hapticFeedback.notificationOccurred('success');
    closePollSheet();
    // Перенаправляем на созданное голосование
    navigate(`/vote/${pollId}`);
  };

  const handleViewHistory = () => {
    hapticFeedback.impactOccurred('light');
    navigate('/vote/history');
  };

  const handleViewLastPoll = () => {
    if (lastPoll) {
      hapticFeedback.impactOccurred('light');
      navigate(`/vote/${lastPoll.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Animated gradient background - full page */}
      <MediumWaveGradient />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Голосования
            </h1>
          </div>
          
          <button
            onClick={handleViewHistory}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-peach-600 dark:text-peach-400 hover:bg-peach-50 dark:hover:bg-peach-500/10 transition-colors"
          >
            <History size={16} />
            История
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Empty State Icon */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-peach-100 to-coral-100 dark:from-peach-900/20 dark:to-coral-900/20 mb-4">
            <Vote className="text-peach-500" size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Нет активных голосований
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Пока что нет голосований в вашей группе
          </p>
        </motion.div>

        {/* Admin: Create Poll Button */}
        {user?.isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={handleCreatePoll}
              className="w-full p-6 rounded-2xl bg-gradient-to-br from-lavender-500 to-lavender-600 hover:from-lavender-600 hover:to-lavender-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-center gap-3">
                <Plus size={24} />
                <span className="text-lg font-semibold">Создать новое голосование</span>
              </div>
              <p className="mt-2 text-sm text-lavender-100">
                Запустите голосование для вашей группы
              </p>
            </button>
          </motion.div>
        )}

        {/* Last Poll Card */}
        {lastPoll && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <History size={20} className="text-peach-500" />
                  Последнее голосование
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {lastPoll.title || 'Голосование за обед'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {pollsService.formatPollDate(lastPoll.createdAt)}
                    </p>
                  </div>
                  
                  {lastPoll.results && lastPoll.results[0] && (
                    <div className="p-3 rounded-lg bg-mint-50 dark:bg-mint-500/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Победитель:
                        </span>
                        <span className="font-semibold text-mint-700 dark:text-mint-400">
                          {lastPoll.results[0].winnerItem?.name || 'Неизвестно'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleViewLastPoll}
                    className="w-full py-2 px-4 rounded-lg bg-peach-500 hover:bg-peach-600 text-white font-medium transition-colors"
                  >
                    Посмотреть детали
                  </button>
                </div>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* User Stats Card */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-lavender-500" />
                  Ваша статистика
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-gradient-to-br from-peach-50 to-coral-50 dark:from-peach-900/10 dark:to-coral-900/10">
                    <div className="text-2xl font-bold text-peach-600 dark:text-peach-400">
                      {stats.totalVotes || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Голосований
                    </div>
                  </div>
                  
                  <div className="text-center p-3 rounded-lg bg-gradient-to-br from-mint-50 to-mint-100 dark:from-mint-900/10 dark:to-mint-800/10">
                    <div className="text-2xl font-bold text-mint-600 dark:text-mint-400">
                      {stats.participationRate || 0}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Участие
                    </div>
                  </div>
                </div>
                
                {stats.favoriteItems && stats.favoriteItems.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-lavender-50 dark:bg-lavender-900/10">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Любимое блюдо:
                    </div>
                    <div className="font-semibold text-lavender-700 dark:text-lavender-400">
                      {stats.favoriteItems[0].itemName} ({stats.favoriteItems[0].voteCount} раз)
                    </div>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={handleViewHistory}
            className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-peach-300 dark:hover:border-peach-600 transition-colors"
          >
            <History className="text-peach-500 mb-2" size={24} />
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              История
            </div>
          </button>
          
          <button
            onClick={() => navigate('/stats')}
            className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-lavender-300 dark:hover:border-lavender-600 transition-colors"
          >
            <TrendingUp className="text-lavender-500 mb-2" size={24} />
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              Статистика
            </div>
          </button>
        </motion.div>
      </div>

      {/* Create Poll Modal (для админов) */}
      {user?.isAdmin && isPollSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <CreatePollForm
              onSuccess={handlePollCreated}
              onCancel={closePollSheet}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VotingHubPage;
