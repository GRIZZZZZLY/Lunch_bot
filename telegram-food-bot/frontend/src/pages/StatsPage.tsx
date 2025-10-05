import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { PollCard } from '../components/polls/PollCard';
import { PollResults } from '../components/polls/PollResults';
import { LoadingSpinner, Skeleton } from '../components/common/LoadingSpinner';
import { GlassHeroCard, GlassCard } from '../components/glass';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Trophy, 
  Vote,
  Calendar,
  CheckCircle
} from 'lucide-react';

import { useTelegram } from '../hooks/useTelegram';
import { usePolls, useUI } from '../store/useAppStore';
import { pollsService, Poll, PollStats, PopularItem } from '../services/polls.service';

type ViewMode = 'overview' | 'history' | 'results';

/**
 * Страница статистики и голосований
 */
export const StatsPage: React.FC = () => {
  const { backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  
  const isDark = colorScheme === 'dark';
  
  const {
    polls,
    pollsLoading,
    setPolls,
    setPollsLoading,
  } = usePolls();

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [stats, setStats] = useState<PollStats | null>(null);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'votes' | 'title'>('date');
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (viewMode !== 'overview') {
      backButton.onClick(() => setViewMode('overview'));
      backButton.show();
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [viewMode, backButton]);

  const loadData = async () => {
    try {
      setPollsLoading(true);

      const [pollsResponse, statsResponse, popularResponse] = await Promise.all([
        pollsService.getAllPolls(),
        pollsService.getPollStats(),
        pollsService.getPopularItems(10),
      ]);

      if (pollsResponse.success && pollsResponse.data) {
        setPolls(pollsResponse.data);
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (popularResponse.success && popularResponse.data) {
        setPopularItems(popularResponse.data);
      }

    } catch (error) {
      console.error('Error loading stats:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки статистики',
      });
    } finally {
      setPollsLoading(false);
    }
  };

  const handleViewPollResults = (poll: Poll) => {
    setSelectedPoll(poll);
    setViewMode('results');
  };

  const handleBackToOverview = () => {
    setSelectedPoll(null);
    setViewMode('overview');
  };

  // Сортировка голосований (поиск отключен)
  const sortedPolls = pollsService.sortPolls(polls, sortBy, 'desc');
  const groupedPolls = pollsService.groupPollsByStatus(sortedPolls);

  if (viewMode === 'results' && selectedPoll) {
    return (
      <>
        <Header />
        <PollResults poll={selectedPoll} onBack={handleBackToOverview} />
      </>
    );
  }

  return (
    <>

      
      <div className="space-y-6 pb-24">
        {/* Hero Card с главной статистикой */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <GlassHeroCard
            gradient={{ from: '#FB923C', to: '#F97316' }}
            value={stats?.totalPolls?.toString() || '0'}
            label="Голосований"
            sublabel={stats ? `${stats.totalVotes} голосов · ${stats.activePolls} активных` : 'Загрузка...'}
            textColor="#FFFFFF"
            icon={<BarChart3 size={24} />}
            className="shadow-lg"
          />
        </motion.div>

        {/* Quick Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              {
                icon: <Vote size={18} />,
                label: 'Всего голосований',
                value: stats.totalPolls,
                color: 'text-blue-500 dark:text-bluegray-300',
                bgColor: 'bg-blue-50 dark:bg-bluegray-500/20',
              },
              {
                icon: <CheckCircle size={18} />,
                label: 'Активных',
                value: stats.activePolls,
                color: 'text-green-500 dark:text-success-soft-300',
                bgColor: 'bg-green-50 dark:bg-success-soft-500/20',
              },
              {
                icon: <TrendingUp size={18} />,
                label: 'Всего голосов',
                value: stats.totalVotes,
                color: 'text-purple-500 dark:text-lavender-300',
                bgColor: 'bg-purple-50 dark:bg-lavender-500/20',
              },
              {
                icon: <Users size={18} />,
                label: 'Средн. участие',
                value: stats.averageParticipants.toFixed(1),
                color: 'text-primary-food-500 dark:text-peach-300',
                bgColor: 'bg-primary-food-50 dark:bg-peach-500/20',
              },
            ].map((stat, index) => (
              <GlassCard
                key={stat.label}
                variant="light"
                theme={isDark ? 'dark' : 'light'}
                hover
                className="p-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
                >
                  <div className={`flex items-center space-x-2 mb-2 ${stat.color}`}>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      {stat.icon}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                </motion.div>
              </GlassCard>
            ))}
          </motion.div>
        )}

        {/* Популярные блюда */}
        {popularItems.length > 0 && (
          <GlassCard
            variant="medium"
            theme={isDark ? 'dark' : 'light'}
            className="p-5"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
            <div className="flex items-center space-x-2 mb-4">
              <Trophy size={20} className="text-primary-food-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Популярные блюда
              </h3>
            </div>
            <div className="space-y-3">
              {popularItems.slice(0, 5).map((item, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                const colors = [
                  'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
                  'text-gray-400 bg-gray-50 dark:bg-gray-700',
                  'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
                ];
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index < 3 ? colors[index] : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {index < 3 ? medals[index] : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-sm font-semibold text-primary-food-700 dark:text-primary-food-400">
                        {item.voteCount} голосов
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.winCount} побед
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            </motion.div>
          </GlassCard>
        )}

        {/* Поиск и фильтры */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="space-y-3"
        >
          {/* Поиск отключен - убран для упрощения */}
          
          {/* Фильтры сортировки */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap mr-1">
              Сортировка:
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSortBy('date')}
              className={`
                flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-200 whitespace-nowrap
                ${sortBy === 'date'
                  ? 'bg-primary-food-700 text-white shadow-md shadow-primary-food-700/30'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-primary-food-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }
              `}
            >
              <Calendar size={16} />
              <span>По дате</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSortBy('votes')}
              className={`
                flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-200 whitespace-nowrap
                ${sortBy === 'votes'
                  ? 'bg-primary-food-700 text-white shadow-md shadow-primary-food-700/30'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-primary-food-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }
              `}
            >
              <Users size={16} />
              <span>По голосам</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSortBy('title')}
              className={`
                flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-200 whitespace-nowrap
                ${sortBy === 'title'
                  ? 'bg-primary-food-700 text-white shadow-md shadow-primary-food-700/30'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-primary-food-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }
              `}
            >
              <Vote size={16} />
              <span>По названию</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Список голосований */}
        {pollsLoading ? (
          <div className="space-y-3">
            <Skeleton count={5} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Активные голосования */}
            {groupedPolls.active.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Активные голосования ({groupedPolls.active.length})
                </h3>
                <div className="space-y-3">
                  {groupedPolls.active.map((poll, index) => (
                    <motion.div
                      key={poll.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + index * 0.05, duration: 0.3 }}
                    >
                      <PollCard
                        poll={poll}
                        onViewResults={handleViewPollResults}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Завершенные голосования */}
            {groupedPolls.completed.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.4 }}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  📈 История голосований ({groupedPolls.completed.length})
                </h3>
                <div className="space-y-3">
                  {groupedPolls.completed.slice(0, showAllCompleted ? undefined : 10).map((poll, index) => (
                    <motion.div
                      key={poll.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.1 + index * 0.05, duration: 0.3 }}
                    >
                      <PollCard
                        poll={poll}
                        onViewResults={handleViewPollResults}
                      />
                    </motion.div>
                  ))}
                  
                  {groupedPolls.completed.length > 10 && !showAllCompleted && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.6, duration: 0.3 }}
                      className="text-center py-4"
                    >
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowAllCompleted(true)}
                        className="px-6 py-2 text-primary-food-700 dark:text-primary-food-400 hover:bg-primary-food-50 dark:hover:bg-primary-food-900/20 rounded-lg font-medium transition-colors"
                      >
                        Показать ещё {groupedPolls.completed.length - 10} голосований
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Пустое состояние */}
            {sortedPolls.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-12"
              >
                <div className="flex justify-center mb-4">
                  <BarChart3 size={64} className="text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Пока нет голосований
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Голосования появятся здесь после их создания в боте
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
