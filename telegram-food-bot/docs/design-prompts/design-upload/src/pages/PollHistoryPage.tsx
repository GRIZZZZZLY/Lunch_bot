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
  const [filter, setFilter] = useState<'all' | 'won' | 'participated' | 'skipped'>('all');
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
    if (filter === 'all') return true;

    const pollAny = poll as Poll & {
      votes?: Array<{ userId: number; menuItemId: number }>;
      results?: Array<{ winnerItemId?: number | null }>;
      result?: { winnerItemId?: number | null };
    };
    const myVotes = (pollAny.votes || []).filter(v => user?.id && v.userId === user.id);
    const hasVoted = myVotes.length > 0;
    const winnerId = pollAny.results?.[0]?.winnerItemId ?? pollAny.result?.winnerItemId ?? null;
    const wonWithWinner = hasVoted && winnerId !== null && myVotes.some(v => v.menuItemId === winnerId);

    if (filter === 'won') return wonWithWinner;
    if (filter === 'participated') return hasVoted && !wonWithWinner;
    if (filter === 'skipped') return !hasVoted;
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
          {/* Spinner при обновлении (заголовок уже в PageHeader) */}
          {loading && polls.length > 0 && (
            <div className="flex justify-end">
              <LoadingSpinner size="sm" />
            </div>
          )}

          {/* Filter chips — Все · Я победил · Я участвовал · Пропустил */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {([
              { id: 'all', label: 'Все' },
              { id: 'won', label: 'Я победил' },
              { id: 'participated', label: 'Я участвовал' },
              { id: 'skipped', label: 'Пропустил' },
            ] as const).map(chip => {
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => {
                    setFilter(chip.id);
                    haptic.selection();
                  }}
                  className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all border ${
                    active
                      ? 'bg-peach-500/15 text-peach-700 dark:text-peach-300 border-peach-500/40 shadow-[0_4px_12px_rgba(216,106,44,0.12)]'
                      : 'bg-card text-muted-foreground border-border/70 hover:border-peach-500/30 hover:text-foreground'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
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
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                            poll.status === 'ACTIVE'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                              : 'bg-muted text-muted-foreground border-border'
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
