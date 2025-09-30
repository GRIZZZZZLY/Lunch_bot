import React, { useState, useEffect } from 'react';
import { Layout, Header } from '../components/layout/Layout';
import { PollCard } from '../components/polls/PollCard';
import { PollResults } from '../components/polls/PollResults';
import { LoadingSpinner, Skeleton } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

import { useTelegram } from '../hooks/useTelegram';
import { usePolls, useUI } from '../store/useAppStore';
import { pollsService, Poll, PollStats, PopularItem } from '../services/polls.service';

type ViewMode = 'overview' | 'history' | 'results';

/**
 * Страница статистики и голосований
 */
export const StatsPage: React.FC = () => {
  const { backButton } = useTelegram();
  const { addNotification } = useUI();
  
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'votes' | 'title'>('date');

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

  // Фильтрация и сортировка голосований
  const filteredPolls = polls.filter(poll =>
    poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (poll.description && poll.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedPolls = pollsService.sortPolls(filteredPolls, sortBy, 'desc');
  const groupedPolls = pollsService.groupPollsByStatus(sortedPolls);

  if (viewMode === 'results' && selectedPoll) {
    return (
      <Layout>
        <Header />
        <PollResults poll={selectedPoll} onBack={handleBackToOverview} />
      </Layout>
    );
  }

  return (
    <Layout>
      <Header />
      
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📊 Статистика
          </h1>
          {pollsLoading && <LoadingSpinner size="sm" />}
        </div>

        {/* Общая статистика */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalPolls}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Всего голосований
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.activePolls}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Активных
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.totalVotes}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Общий голосов
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.averageParticipants.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Среднее участие
              </div>
            </div>
          </div>
        )}

        {/* Популярные блюда */}
        {popularItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🏆 Популярные блюда
            </h3>
            <div className="space-y-3">
              {popularItems.slice(0, 5).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.voteCount} голосов
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.winCount} побед
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Поиск и фильтры */}
        <div className="space-y-3">
          <Input
            placeholder="Поиск голосований..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            fullWidth
          />

          <div className="flex space-x-2 overflow-x-auto pb-2">
            <Button
              variant={sortBy === 'date' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('date')}
            >
              📅 По дате
            </Button>
            <Button
              variant={sortBy === 'votes' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('votes')}
            >
              👥 По голосам
            </Button>
            <Button
              variant={sortBy === 'title' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('title')}
            >
              📝 По названию
            </Button>
          </div>
        </div>

        {/* Список голосований */}
        {pollsLoading ? (
          <div className="space-y-3">
            <Skeleton count={5} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Активные голосования */}
            {groupedPolls.active.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Активные голосования ({groupedPolls.active.length})
                </h3>
                <div className="space-y-3">
                  {groupedPolls.active.map(poll => (
                    <PollCard
                      key={poll.id}
                      poll={poll}
                      onViewResults={handleViewPollResults}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Завершенные голосования */}
            {groupedPolls.completed.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  📈 История голосований ({groupedPolls.completed.length})
                </h3>
                <div className="space-y-3">
                  {groupedPolls.completed.slice(0, 10).map(poll => (
                    <PollCard
                      key={poll.id}
                      poll={poll}
                      onViewResults={handleViewPollResults}
                    />
                  ))}
                  
                  {groupedPolls.completed.length > 10 && (
                    <div className="text-center py-4">
                      <Button variant="ghost" onClick={() => {/* TODO: показать больше */}}>
                        Показать ещё {groupedPolls.completed.length - 10} голосований
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Пустое состояние */}
            {filteredPolls.length === 0 && (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchTerm ? 'Голосования не найдены' : 'Пока нет голосований'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm 
                    ? 'Попробуйте изменить поисковый запрос'
                    : 'Голосования появятся здесь после их создания в боте'
                  }
                </p>
                {searchTerm && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setSearchTerm('')}
                    className="mt-3"
                  >
                    Очистить поиск
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};
