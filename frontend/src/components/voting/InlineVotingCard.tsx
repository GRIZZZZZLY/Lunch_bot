import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Utensils,
  Zap,
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
import { Skeleton } from '../ui/skeleton';

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
  
  // UX: Показать ещё паттерн для скролла
  const INITIAL_ITEMS_COUNT = 5;
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

      // Загружаем меню и фильтруем по выбранным блюдам
      const menuResponse = await menuService.getActiveItems();
      if (menuResponse.success && menuResponse.data) {
        let items = menuResponse.data;
        
        // Фильтруем по выбранным блюдам, если они указаны в poll
        if (pollResponse.data?.selectedMenuItemIds) {
          try {
            const selectedIds = JSON.parse(pollResponse.data.selectedMenuItemIds);
            if (Array.isArray(selectedIds) && selectedIds.length > 0) {
              items = items.filter(item => selectedIds.includes(item.id));
              console.log('[InlineVotingCard] ✅ Filtered menu items:', {
                allItems: menuResponse.data.length,
                selectedItems: items.length,
                selectedIds,
                filteredItemIds: items.map(i => i.id)
              });
            }
          } catch (parseError) {
            console.warn('[InlineVotingCard] Failed to parse selectedMenuItemIds:', parseError);
          }
        } else {
          console.warn('[InlineVotingCard] ⚠️ No selectedMenuItemIds in poll, showing all items');
        }
        
        setMenuItems(items);
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
    haptic.selection(); // P1: Haptic feedback при выборе
    setSelectedItemId(itemId);
  };

  const handleVote = async () => {
    if (!selectedItemId || userVote || submitting) return;

    try {
      setSubmitting(true);
      haptic.impact('medium'); // P1: Haptic feedback при отправке

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
    if (!window.confirm('Завершить голосование? Результаты будут подведены.')) return;

    try {
      setClosing(true);
      haptic.impact();

      const response = await pollsService.completePoll(poll.id);
      if (response.success) {
        haptic.success();
        addNotification({
          type: 'success',
          message: '✅ Голосование завершено',
        });
        if (onPollClosed) onPollClosed();
      } else {
        throw new Error(response.error);
      }
    } catch (error: any) {
      haptic.error();
      addNotification({
        type: 'error',
        message: error.message || 'Не удалось завершить',
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

  // Вспомогательная функция для правильного склонения слова "блюдо"
  const getDishWord = (count: number): string => {
    if (count === 1) return 'блюдо';
    if (count >= 2 && count <= 4) return 'блюда';
    return 'блюд';
  };

  // Логика отображения блюд
  const displayedItems = isExpanded
    ? menuItems
    : menuItems.slice(0, INITIAL_ITEMS_COUNT);
  const hasMore = menuItems.length > INITIAL_ITEMS_COUNT;
  const remainingCount = menuItems.length - INITIAL_ITEMS_COUNT;

  // Обработчики для кнопок разворачивания/сворачивания
  const handleExpand = () => {
    haptic.selection(); // P1: Улучшенный haptic
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    haptic.selection(); // P1: Улучшенный haptic
    setIsExpanded(false);
    // Прокрутка к началу карточки после небольшой задержки
    setTimeout(() => {
      cardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  // P1: Skeleton loading вместо спиннера
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-lavender-50 via-white to-lavender-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl p-6 shadow-xl border border-lavender-100 dark:border-gray-700">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-2 mt-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const voteCount = poll._count?.votes || 0;
  const leadingItemId = getLeadingItemId();

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-br from-lavender-50 via-white to-mint-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl p-6 shadow-xl border border-lavender-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-lavender-500 to-lavender-600">
              <Sparkles size={18} className="text-white" />
            </div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-lavender-600 to-lavender-700 bg-clip-text text-transparent dark:from-lavender-400 dark:to-lavender-500">
              {userVote ? 'Вы проголосовали!' : 'Голосование активно'}
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm ml-9">Выберите блюдо на обед</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer - P0: butter для warning-подобного элемента */}
          {timeRemaining && (
            <div className="flex items-center gap-2 bg-butter-100 dark:bg-butter-900/30 text-butter-700 dark:text-butter-300 rounded-lg px-3 py-1.5 border border-butter-200 dark:border-butter-800">
              <Clock size={16} />
              <span className="text-sm font-medium">{timeRemaining}</span>
            </div>
          )}

          {/* Admin close button - P0: coral для destructive */}
          {user?.isAdmin && (
            <button
              onClick={handleClosePoll}
              disabled={closing}
              className="p-2 bg-coral-100 hover:bg-coral-200 dark:bg-coral-900/30 dark:hover:bg-coral-800/50 text-coral-700 dark:text-coral-400 rounded-lg transition-all duration-200 disabled:opacity-50 border border-coral-200 dark:border-coral-800"
              title="Завершить голосование"
            >
              <CheckCircle size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        {/* P0: Убрали coral, оставили lavender для статистики */}
        <div className="flex items-center gap-2 bg-lavender-100 dark:bg-lavender-900/30 text-lavender-700 dark:text-lavender-300 rounded-lg px-3 py-2 border border-lavender-200 dark:border-lavender-800">
          <Users size={18} />
          <span className="text-lg font-bold">{voteCount}</span>
          <span className="text-sm">
            {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}
          </span>
        </div>

        {voteCount > 0 && (() => {
          const voters = poll.votes?.map(v => {
            try {
              const telegramIdValue = v.user.telegramId || v.user.id;
              
              // Валидация перед преобразованием в BigInt
              if (!telegramIdValue) {
                return null;
              }
              
              const numValue = Number(telegramIdValue);
              if (isNaN(numValue) || numValue <= 0) {
                return null;
              }
              
              return {
                ...v.user,
                telegramId: BigInt(numValue)
              };
            } catch (error) {
              console.warn(`Error processing voter ${v.user.id}:`, error);
              return null;
            }
          }).filter(Boolean) || [];
          
          return voters.length > 0 ? <VotersAvatars voters={voters} maxDisplay={5} size="sm" /> : null;
        })()}

        {/* P1: Live Updates Badge */}
        {poll.status === 'ACTIVE' && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1.5 text-xs text-mint-600 dark:text-mint-400"
          >
            <div className="w-2 h-2 bg-mint-500 rounded-full animate-pulse" />
            <span className="font-medium">Live</span>
          </motion.div>
        )}
      </div>

      {/* User vote indicator */}
      {userVote && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-mint-100 to-mint-50 dark:from-mint-900/30 dark:to-mint-800/20 border border-mint-300 dark:border-mint-700 rounded-xl p-3 mb-4"
        >
          <div className="flex items-center gap-2 text-mint-700 dark:text-mint-300">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">
              Вы выбрали: <strong>{menuItems.find(i => i.id === userVote.menuItemId)?.name}</strong>
            </span>
          </div>
        </motion.div>
      )}

      {/* P2: Empty State для первого голосующего */}
      {!userVote && voteCount === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6 mb-4 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl"
        >
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-lavender-100 dark:bg-lavender-900/30 flex items-center justify-center">
            <Zap size={24} className="text-lavender-500" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">
            Будьте первым!
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Начните голосование и выберите блюдо
          </p>
        </motion.div>
      )}

      {/* Menu items */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {displayedItems.map((item, index) => {
            const isSelected = selectedItemId === item.id;
            const isVoted = userVote?.menuItemId === item.id;
            const votes = getItemVoteCount(item.id);
            const percentage = getItemPercentage(item.id);
            const isLeading = item.id === leadingItemId && voteCount > 0;

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  delay: isExpanded ? index * 0.03 : index * 0.05,
                  duration: 0.2
                }}
                onClick={() => handleSelectItem(item.id)}
                disabled={!!userVote || submitting}
                className={cn(
                  'w-full relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300',
                  'disabled:cursor-not-allowed',
                  !userVote && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                  // P0: Выбранный вариант - lavender mono-gradient
                  isSelected && !userVote && 'bg-gradient-to-r from-lavender-500 to-lavender-600 text-white scale-[1.02] shadow-lg shadow-lavender-500/50',
                  // Проголосованный вариант
                  isVoted && 'bg-gradient-to-r from-mint-500 to-mint-600 text-white shadow-lg shadow-mint-500/50',
                  // Обычный вариант - белая карточка
                  !isSelected && !isVoted && 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700'
                )}
              >
                {/* P0: Progress bar - lavender mono */}
                {userVote && percentage > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute inset-0 bg-gradient-to-r from-lavender-200/40 to-lavender-300/40 dark:from-lavender-800/20 dark:to-lavender-700/20"
                  />
                )}

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {isVoted ? (
                        <CheckCircle size={22} className="text-white drop-shadow-md" />
                      ) : isSelected ? (
                        <CheckCircle size={22} className="text-white drop-shadow-md" />
                      ) : (
                        <Circle size={22} className="text-gray-400 dark:text-gray-500" />
                      )}
                    </div>

                    {/* Item name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium truncate",
                          (isSelected || isVoted) && "drop-shadow-sm"
                        )}>{item.name}</span>
                        {isLeading && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                          >
                            <Crown size={16} className="text-butter-400 flex-shrink-0 drop-shadow-sm" />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Vote stats */}
                    {userVote && (
                      <div className={cn(
                        "flex items-center gap-3 flex-shrink-0",
                        isVoted && "text-white"
                      )}>
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

      {/* Кнопка "Показать ещё" - Card стиль с превью */}
      {!isExpanded && hasMore && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <button
            onClick={handleExpand}
            className={cn(
              'w-full p-4 rounded-xl',
              'bg-gradient-to-br from-lavender-50 to-mint-50',
              'dark:from-gray-800 dark:to-gray-850',
              'border-2 border-dashed border-lavender-300 dark:border-lavender-700',
              'hover:border-solid hover:bg-gradient-to-br hover:from-lavender-100 hover:to-mint-100',
              'dark:hover:from-gray-750 dark:hover:to-gray-800',
              'transition-all duration-300',
              'group'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-lavender-200 dark:bg-lavender-800 group-hover:scale-110 transition-transform">
                  <Utensils size={18} className="text-lavender-600 dark:text-lavender-300" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    Ещё {remainingCount} {getDishWord(remainingCount)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Нажмите, чтобы показать все варианты
                  </p>
                </div>
              </div>
              <ChevronDown
                size={20}
                className="text-lavender-500 dark:text-lavender-400 group-hover:translate-y-1 transition-transform"
              />
            </div>
          </button>
        </motion.div>
      )}

      {/* Кнопка "Свернуть" */}
      {isExpanded && hasMore && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleCollapse}
          className={cn(
            'w-full mt-3 py-2 px-4 rounded-lg',
            'bg-gray-100 dark:bg-gray-800',
            'text-gray-600 dark:text-gray-400',
            'font-medium text-sm',
            'flex items-center justify-center gap-2',
            'hover:bg-gray-200 dark:hover:bg-gray-700',
            'transition-all duration-200'
          )}
        >
          <ChevronUp size={16} />
          Свернуть
        </motion.button>
      )}

      {/* Vote button */}
      {!userVote && selectedItemId && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleVote}
          disabled={submitting}
          className="w-full mt-4 bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-600 hover:to-peach-700 text-white rounded-xl py-3 px-4 font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-peach-500/50"
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
