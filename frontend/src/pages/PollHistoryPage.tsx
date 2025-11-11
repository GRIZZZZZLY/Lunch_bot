import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Layout';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PullToRefresh } from '../components/common/PullToRefresh';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { useHaptic } from '../hooks/useHaptic';
import { pollsService, Poll } from '../services/polls.service';
import { ICON_SIZES } from '@/lib/design-tokens';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент

/**
 * Страница истории голосований
 */
export const PollHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { backButton } = useTelegram();
  const { addNotification } = useUI();
  const haptic = useHaptic();

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'votes'>('date');

  useEffect(() => {
    loadHistory();
  }, [page, filter]);

  useEffect(() => {
    backButton.onClick(() => navigate('/'));
    backButton.show();

    return () => {
      backButton.hide();
    };
  }, []);

  const loadHistory = async (refresh = false) => {
    try {
      if (refresh) {
        setPage(0);
        setLoading(true);
      }

      const response = await pollsService.getPollHistory({
        limit: 20,
        offset: refresh ? 0 : page * 20,
      });

      if (response.success && response.data) {
        const newPolls = refresh ? response.data.polls : [...polls, ...response.data.polls];
        setPolls(newPolls);
        setHasMore(response.data.hasNext);
      }
    } catch (error) {
      console.error('Error loading poll history:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки истории',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadHistory(true);
    haptic.success();
  };

  const handlePollClick = (pollId: number) => {
    haptic.light();
    // Перенаправляем на страницу результатов для завершенных голосований
    navigate(`/poll/${pollId}/results`);
  };

  const filteredPolls = polls.filter(poll => {
    if (filter === 'completed') return poll.status === 'COMPLETED';
    return true;
  });

  const sortedPolls = pollsService.sortPolls(filteredPolls, sortBy, 'desc');

  if (loading && polls.length === 0) {
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
      
      <PageHeader 
        title="История голосований"
        subtitle="Просмотр завершенных голосований"
        showBack={true}
        onBack={() => navigate('/')}
      />

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-4">
          {/* Заголовок */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-telegram-text-color">
              История голосований
            </h1>
            {loading && polls.length > 0 && <LoadingSpinner size="sm" />}
          </div>

          {/* Фильтры */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => {
                setFilter('all');
                haptic.selection();
              }}
              className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                filter === 'all'
                  ? 'bg-telegram-button-color text-white'
                  : 'bg-telegram-secondary-bg-color text-telegram-text-color'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => {
                setFilter('completed');
                haptic.selection();
              }}
              className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                filter === 'completed'
                  ? 'bg-telegram-button-color text-white'
                  : 'bg-telegram-secondary-bg-color text-telegram-text-color'
              }`}
            >
              Завершённые
            </button>
          </div>

          {/* Сортировка */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-telegram-hint-color">Сортировка:</span>
            <button
              onClick={() => {
                setSortBy('date');
                haptic.selection();
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                sortBy === 'date'
                  ? 'bg-telegram-button-color/20 text-telegram-button-color'
                  : 'text-telegram-hint-color'
              }`}
            >
              По дате
            </button>
            <button
              onClick={() => {
                setSortBy('votes');
                haptic.selection();
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                sortBy === 'votes'
                  ? 'bg-telegram-button-color/20 text-telegram-button-color'
                  : 'text-telegram-hint-color'
              }`}
            >
              По голосам
            </button>
          </div>

          {/* Список */}
          {sortedPolls.length === 0 ? (
            <EmptyState type="no-history" onAction={() => navigate('/')} />
          ) : (
            <div className="space-y-3">
              {sortedPolls.map((poll, index) => (
                <button
                  key={poll.id}
                  onClick={() => handlePollClick(poll.id)}
                  className="w-full text-left bg-telegram-secondary-bg-color rounded-2xl p-4 border border-telegram-secondary-bg-color/50 hover:border-telegram-button-color/50 transition-all animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-telegram-text-color">
                          {poll.title || 'Голосование'}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            poll.status === 'ACTIVE'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-gray-500/20 text-gray-400 dark:text-gray-400'
                          }`}
                        >
                          {poll.status === 'ACTIVE' ? 'Активно' : 'Завершено'}
                        </span>
                      </div>

                      {poll.description && (
                        <p className="text-sm text-telegram-hint-color mb-2 line-clamp-2">
                          {poll.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-telegram-hint-color">
                        <span>
                          👥 {poll._count?.votes || 0}{' '}
                          {poll._count?.votes === 1 ? 'голос' : 'голосов'}
                        </span>
                        <span>
                          📅 {pollsService.formatPollDate(poll.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="text-telegram-button-color">
                      <svg
                        className={ICON_SIZES.md}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && sortedPolls.length > 0 && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => {
                  setPage(page + 1);
                  haptic.medium();
                }}
                disabled={loading}
                className="px-6 py-3 bg-telegram-secondary-bg-color text-telegram-text-color rounded-xl hover:bg-telegram-button-color/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Загрузка...' : 'Загрузить ещё'}
              </button>
            </div>
          )}
        </div>
      </PullToRefresh>
    </>
  );
};
