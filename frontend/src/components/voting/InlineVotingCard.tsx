import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  CheckCircle,
  Circle,
  TrendingUp,
  Crown,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHaptic } from '../../hooks/useHaptic';
import { useUI } from '../../store/useAppStore';
import { trackEvent, ANALYTICS_EVENTS } from '../../lib/analytics';
import { pollsService, PollWithDetails, Vote } from '../../services/polls.service';
import { menuService, MenuItem } from '../../services/menu.service';
import { cn } from '../../lib/utils';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { VotersAvatars } from './VotersAvatars';

interface InlineVotingCardProps {
  poll: PollWithDetails;
  onPollClosed?: () => void;
  onVoteSuccess?: () => void;
}

/**
 * Компонент встроенного голосования для главной страницы
 * Содержит всю логику голосования без перехода на отдельную страницу
 */
export const InlineVotingCard: React.FC<InlineVotingCardProps> = ({
  poll: initialPoll,
  onPollClosed,
  onVoteSuccess,
}) => {
  const { user } = useAuth();
  const haptic = useHaptic();
  const { addNotification } = useUI();

  const [poll, setPoll] = useState<PollWithDetails>(initialPoll);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Загрузка данных
  useEffect(() => {
    loadPollData();
  }, [initialPoll.id]);

  // Обновление таймера
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = formatTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining === 'Завершено' && onPollClosed) {
        clearInterval(timer);
        onPollClosed();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [poll]);

  // Автообновление каждые 10 секунд
  useEffect(() => {
    if (poll.status !== 'ACTIVE') return;

    const refreshInterval = setInterval(() => {
      loadPollData(true); // silent
    }, 10000);

    return () => clearInterval(refreshInterval);
  }, [poll.status]);

  const loadPollData = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);

      // Загружаем свежие данные голосования
      const pollResponse = await pollsService.getPollById(poll.id);
      if (pollResponse.success && pollResponse.data) {
        setPoll(pollResponse.data);

        // Проверяем голос пользователя
        if (user) {
          const existingVote = pollResponse.data.votes?.find(v => v.userId === user.id);
          setUserVote(existingVote || null);
          setSelectedItemId(existingVote?.menuItemId || null);
        }
      }

      // Загружаем меню
      const menuResponse = await menuService.getActiveItems();
      if (menuResponse.success && menuResponse.data) {
        setMenuItems(menuResponse.data);
      }
    } catch (error) {
      console.error('Error loading poll data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const formatTimeRemaining = (): string => {
    const endTime = poll.endedAt || poll.endTime;
    if (!endTime) return '';

    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return 'Завершено';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}ч ${minutes}м`;
    if (minutes > 0) return `${minutes}м ${seconds}с`;
    return `${seconds}с`;
  };

  const handleSelectItem = (itemId: number) => {
    if (userVote) return; // Уже проголосовал
    setSelectedItemId(itemId);
  };

  const handleVote = async () => {
    if (!selectedItemId || userVote || submitting) return;

    try {
      setSubmitting(true);

      const response = await pollsService.voteForItem(poll.id, selectedItemId);

      if (response.success) {
        haptic.success();
        
        // P1.2.4: Track vote event
        trackEvent(ANALYTICS_EVENTS.VOTE_SUBMITTED, {
          pollId: poll.id,
          menuItemId: selectedItemId,
          pollType: 'inline',
        });
        
        // Небольшая задержка для синхронизации
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Обновляем данные
        await loadPollData(true);
        
        if (onVoteSuccess) onVoteSuccess();
      } else {
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      haptic.error();
      addNotification({
        type: 'error',
        message: 'Ошибка при голосовании',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClosePoll = async () => {
    if (!window.confirm('Отменить голосование? Все голоса будут потеряны.')) return;

    try {
      setClosing(true);
      haptic.impact();

      const response = await pollsService.cancelPoll(poll.id);
      if (response.success) {
        haptic.success();
        addNotification({
          type: 'success',
          message: '🚫 Голосование отменено',
        });
        if (onPollClosed) onPollClosed();
      } else {
        throw new Error(response.error);
      }
    } catch (error: any) {
      haptic.error();
      addNotification({
        type: 'error',
        message: error.message || 'Не удалось отменить',
      });
    } finally {
      setClosing(false);
    }
  };

  const getItemVoteCount = (itemId: number): number => {
    return poll.votes?.filter(v => v.menuItemId === itemId).length || 0;
  };

  const getItemPercentage = (itemId: number): number => {
    const totalVotes = poll._count?.votes || 0;
    if (totalVotes === 0) return 0;
    const itemVotes = getItemVoteCount(itemId);
    return Math.round((itemVotes / totalVotes) * 100);
  };

  const getLeadingItemId = (): number | null => {
    if (!menuItems.length) return null;
    return menuItems.reduce((leader, item) => {
      return getItemVoteCount(item.id) > getItemVoteCount(leader.id) ? item : leader;
    }, menuItems[0]).id;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const voteCount = poll._count?.votes || 0;
  const leadingItemId = getLeadingItemId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-2xl p-6 text-white shadow-xl"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={20} />
            <h3 className="text-xl font-bold">
              {userVote ? 'Вы проголосовали!' : 'Голосование активно'}
            </h3>
          </div>
          <p className="text-white/80 text-sm">Выберите блюдо на обед</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          {timeRemaining && (
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <Clock size={16} />
              <span className="text-sm font-medium">{timeRemaining}</span>
            </div>
          )}

          {/* Admin cancel button */}
          {user?.isAdmin && (
            <button
              onClick={handleClosePoll}
              disabled={closing}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
              title="Отменить голосование"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
          <Users size={18} />
          <span className="text-lg font-bold">{voteCount}</span>
          <span className="text-white/80 text-sm">
            {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}
          </span>
        </div>

        {voteCount > 0 && (() => {
          const voters = poll.votes?.map(v => {
            const telegramIdValue = v.user.telegramId || v.user.id;
            
            // Валидация перед преобразованием в BigInt
            if (!telegramIdValue || isNaN(Number(telegramIdValue))) {
              console.warn(`Invalid telegramId for user ${v.user.id}, skipping voter avatar`);
              return null;
            }
            
            return {
              ...v.user,
              telegramId: BigInt(telegramIdValue)
            };
          }).filter(Boolean) || [];
          
          return <VotersAvatars voters={voters} maxDisplay={5} size="sm" />;
        })()}
      </div>

      {/* User vote indicator */}
      {userVote && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-500/20 border border-green-400/30 rounded-xl p-3 mb-4"
        >
          <div className="flex items-center gap-2 text-green-100">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">
              Вы выбрали: <strong>{menuItems.find(i => i.id === userVote.menuItemId)?.name}</strong>
            </span>
          </div>
        </motion.div>
      )}

      {/* Menu items */}
      <div className="max-h-[360px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-1">
        <AnimatePresence mode="popLayout">
          {menuItems.map((item, index) => {
            const isSelected = selectedItemId === item.id;
            const isVoted = userVote?.menuItemId === item.id;
            const votes = getItemVoteCount(item.id);
            const percentage = getItemPercentage(item.id);
            const isLeading = item.id === leadingItemId && voteCount > 0;

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSelectItem(item.id)}
                disabled={!!userVote || submitting}
                className={cn(
                  'w-full relative overflow-hidden rounded-xl p-4 text-left transition-all duration-200',
                  'disabled:cursor-not-allowed',
                  !userVote && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                  isSelected && !userVote && 'ring-2 ring-white scale-[1.02]',
                  isVoted && 'bg-white/20 ring-2 ring-green-400',
                  !isSelected && !isVoted && 'bg-white/10 hover:bg-white/15 hover:shadow-lg'
                )}
              >
                {/* Progress bar background */}
                {userVote && percentage > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute inset-0 bg-white/10"
                  />
                )}

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {isVoted ? (
                        <CheckCircle size={22} className="text-green-300" />
                      ) : isSelected ? (
                        <CheckCircle size={22} />
                      ) : (
                        <Circle size={22} className="text-white/40" />
                      )}
                    </div>

                    {/* Item name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{item.name}</span>
                        {isLeading && (
                          <Crown size={16} className="text-yellow-300 flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Vote stats */}
                    {userVote && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-medium">{percentage}%</span>
                        <div className="flex items-center gap-1 text-sm">
                          <Users size={14} />
                          <span>{votes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Vote button */}
      {!userVote && selectedItemId && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleVote}
          disabled={submitting}
          className="w-full mt-4 bg-white text-purple-600 rounded-xl py-3 px-4 font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <LoadingSpinner size="sm" />
              Отправка...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              Проголосовать
            </>
          )}
        </motion.button>
      )}
    </motion.div>
  );
};
