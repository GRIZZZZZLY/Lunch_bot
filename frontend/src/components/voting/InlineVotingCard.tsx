import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Users,
  CheckCircle,
  Circle,
  Crown,
  Sparkles,
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
import { ICON_SIZES } from '../../lib/design-tokens';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { VotersAvatars } from './VotersAvatars';
import { Skeleton } from '../ui/skeleton';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import { NumberTicker } from '../ui/number-ticker';

interface InlineVotingCardProps {
  poll: PollWithDetails;
  onPollClosed?: () => void;
  onVoteSuccess?: () => void;
}

/**
 * Компонент бейджа с обратным отсчётом времени
 * УЛУЧШЕННАЯ ВЕРСИЯ - большой, яркий, заметный
 */
const CountdownBadge: React.FC<{ endTime: string | Date | undefined }> = ({ endTime }) => {
  // Защита от undefined
  if (!endTime) {
    console.warn('[CountdownBadge] endTime is undefined');
    return null;
  }

  const { formattedTime, isLastMinute, isExpired } = useCountdownTimer(endTime);

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        <Clock className={ICON_SIZES.sm} />
        <span className="font-semibold text-sm">Завершено</span>
      </div>
    );
  }

  return (
    <motion.div
      animate={isLastMinute ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 0.8, repeat: Infinity }}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-lg",
        isLastMinute
          ? "bg-gradient-to-r from-pastel-rose-400 to-pastel-rose-500 text-white animate-pulse"
          : "bg-gradient-to-r from-pastel-peach-400 to-pastel-peach-500 text-white"
      )}
    >
      <Clock className={cn(ICON_SIZES.md, isLastMinute && "animate-pulse")} />
      <span className="text-base tracking-wide">{formattedTime}</span>
    </motion.div>
  );
};

/**
 * Компонент встроенного голосования для главной страницы
 * Содержит всю логику голосования без перехода на отдельную страницу
 * ПОДДЕРЖИВАЕТ МНОЖЕСТВЕННЫЙ ВЫБОР
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
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]); // ИЗМЕНЕНО: массив вместо одного ID
  const [userVotes, setUserVotes] = useState<Vote[]>([]); // ИЗМЕНЕНО: массив вместо одного vote
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  
  // UX: Показать ещё паттерн для скролла
  const INITIAL_ITEMS_COUNT = 5;
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Загрузка данных
  useEffect(() => {
    loadPollData();
  }, [initialPoll.id]);

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
      console.log('[InlineVotingCard] 📥 Poll data received:', {
        success: pollResponse.success,
        hasData: !!pollResponse.data,
        pollId: pollResponse.data?.id,
        groupId: pollResponse.data?.groupId,
        status: pollResponse.data?.status,
        fullPoll: pollResponse.data
      });
      
      if (pollResponse.success && pollResponse.data) {
        setPoll(pollResponse.data);

        // Проверяем голоса пользователя (все голоса, если множественный выбор)
        if (user) {
          console.log('[InlineVotingCard] 🔍 Looking for user votes:', {
            currentUserId: user.id,
            userTelegramId: user.telegramId,
            userFirstName: user.firstName,
            totalVotes: pollResponse.data.votes?.length || 0,
            allVoterIds: pollResponse.data.votes?.map(v => ({ userId: v.userId, userName: v.user?.firstName })) || []
          });
          
          // ИЗМЕНЕНО: ищем ВСЕ голоса пользователя, а не только первый
          const existingVotes = pollResponse.data.votes?.filter(v => v.userId === user.id) || [];
          
          console.log('[InlineVotingCard] 🎯 User votes result:', {
            found: existingVotes.length,
            voteIds: existingVotes.map(v => v.id),
            menuItemIds: existingVotes.map(v => v.menuItemId),
            menuItemNames: existingVotes.map(v => v.menuItem?.name)
          });
          
          setUserVotes(existingVotes);
          setSelectedItemIds(existingVotes.map(v => v.menuItemId));
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



  /**
   * Получить количество уникальных пользователей, проголосовавших
   * Один пользователь = один голос, независимо от количества выбранных блюд
   */
  const getUniqueVotersCount = (): number => {
    if (!poll.votes || poll.votes.length === 0) return 0;
    const uniqueUserIds = new Set(poll.votes.map(v => v.userId));
    return uniqueUserIds.size;
  };

  /**
   * Получить количество уникальных пользователей, выбравших конкретное блюдо
   */
  const getItemUniqueVotersCount = (itemId: number): number => {
    if (!poll.votes) return 0;
    const votersForItem = poll.votes
      .filter(v => v.menuItemId === itemId)
      .map(v => v.userId);
    const uniqueVoters = new Set(votersForItem);
    return uniqueVoters.size;
  };

  /**
   * Получить процент пользователей, выбравших блюдо
   * Процент от общего количества проголосовавших пользователей
   */
  const getItemUniquePercentage = (itemId: number): number => {
    const totalVoters = getUniqueVotersCount();
    if (totalVoters === 0) return 0;
    const itemVoters = getItemUniqueVotersCount(itemId);
    return Math.round((itemVoters / totalVoters) * 100);
  };

  /**
   * Получить список уникальных пользователей (для аватаров)
   * Убирает дубликаты, если пользователь голосовал за несколько блюд
   */
  const getUniqueVoters = () => {
    if (!poll.votes) return [];
    
    const uniqueUsersMap = new Map();
    poll.votes.forEach(v => {
      if (!uniqueUsersMap.has(v.userId)) {
        try {
          const telegramIdValue = v.user.telegramId || v.user.id;
          const numValue = Number(telegramIdValue);
          
          if (!isNaN(numValue) && numValue > 0) {
            uniqueUsersMap.set(v.userId, {
              id: v.user.id,
              firstName: v.user.firstName,
              lastName: v.user.lastName,
              username: v.user.username,
              telegramId: BigInt(numValue)
            });
          }
        } catch (error) {
          console.warn(`Error processing voter ${v.user.id}:`, error);
        }
      }
    });
    
    return Array.from(uniqueUsersMap.values());
  };

  const handleSelectItem = (itemId: number) => {
    if (userVotes.length > 0) return; // Уже проголосовал
    haptic.selection(); // P1: Haptic feedback при выборе
    
    // ИЗМЕНЕНО: Toggle выбор (добавить/удалить из массива)
    setSelectedItemIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId); // Убрать из выбранных
      } else {
        return [...prev, itemId]; // Добавить в выбранные
      }
    });
  };

  const handleVote = async () => {
    if (selectedItemIds.length === 0 || userVotes.length > 0 || submitting) return;

    try {
      setSubmitting(true);
      haptic.medium(); // P1: Haptic feedback при отправке

      // ИЗМЕНЕНО: Отправляем множественное голосование
      const response = await pollsService.voteForMultipleItems(poll.id, selectedItemIds);

      if (response.success) {
        haptic.success();
        
        // P1.2.4: Track vote event
        trackEvent(ANALYTICS_EVENTS.VOTE_SUBMITTED, {
          pollId: poll.id,
          menuItemIds: selectedItemIds, // ИЗМЕНЕНО: массив
          count: selectedItemIds.length,
          pollType: 'inline',
        });
        
        addNotification({
          type: 'success',
          message: `✓ Голоса учтены! Выбрано блюд: ${selectedItemIds.length}`,
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

  /**
   * УСТАРЕВШАЯ функция - оставлена для обратной совместимости
   * Используйте getItemUniqueVotersCount вместо этого
   */
  const getItemVoteCount = (itemId: number): number => {
    return getItemUniqueVotersCount(itemId);
  };

  /**
   * УСТАРЕВШАЯ функция - оставлена для обратной совместимости
   * Используйте getItemUniquePercentage вместо этого
   */
  const getItemPercentage = (itemId: number): number => {
    return getItemUniquePercentage(itemId);
  };

  /**
   * Получить ID блюда-лидера (больше всего уникальных пользователей)
   */
  const getLeadingItemId = (): number | null => {
    if (!menuItems.length) return null;
    return menuItems.reduce((leader, item) => {
      return getItemUniqueVotersCount(item.id) > getItemUniqueVotersCount(leader.id) ? item : leader;
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

  // Количество УНИКАЛЬНЫХ пользователей (один пользователь = один голос)
  const voteCount = getUniqueVotersCount();
  const leadingItemId = getLeadingItemId();

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-br from-pastel-peach-50 via-white to-pastel-lavender-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl p-6 shadow-xl border border-pastel-peach-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-lavender-500 to-lavender-600">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold bg-gradient-to-r from-lavender-600 to-lavender-700 bg-clip-text text-transparent dark:from-lavender-400 dark:to-lavender-500">
                {userVotes.length > 0 ? 'Вы проголосовали!' : 'Голосование активно'}
              </h3>
              {/* НОВЫЙ ТАЙМЕР В ЗАГОЛОВКЕ - большой и заметный */}
              {(() => {
                console.log('[InlineVotingCard] Timer check:', {
                  status: poll.status,
                  endTime: poll.endTime,
                  endedAt: poll.endedAt,
                  startedAt: poll.startedAt,
                  duration: poll.duration,
                  shouldShow: poll.status === 'ACTIVE' && (poll.endTime || poll.endedAt)
                });
                
                // Используем endTime если есть, иначе вычисляем из startedAt + duration
                const endTimeToUse = poll.endTime || poll.endedAt;
                
                if (poll.status === 'ACTIVE' && endTimeToUse) {
                  return <CountdownBadge endTime={endTimeToUse} />;
                }
                
                // Если endTime нет, вычисляем на лету (fallback)
                if (poll.status === 'ACTIVE' && poll.startedAt && poll.duration) {
                  const calculatedEndTime = new Date(poll.startedAt);
                  calculatedEndTime.setMinutes(calculatedEndTime.getMinutes() + poll.duration);
                  console.log('[InlineVotingCard] Using calculated endTime:', calculatedEndTime.toISOString());
                  return <CountdownBadge endTime={calculatedEndTime.toISOString()} />;
                }
                
                return null;
              })()}
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm ml-9">Выберите блюдо на обед</p>
        </div>

        <div className="flex items-center gap-2">
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
        {/* Счётчик уникальных пользователей (один пользователь = один голос) */}
        <div className="flex items-center gap-2 bg-lavender-100 dark:bg-lavender-900/30 text-lavender-700 dark:text-lavender-300 rounded-lg px-3 py-2 border border-lavender-200 dark:border-lavender-800">
          <Users size={18} />
          <span className="text-lg font-bold">{voteCount}</span>
          <span className="text-sm">
            {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}
          </span>
        </div>

        {/* Аватары уникальных пользователей (без дубликатов) */}
        {voteCount > 0 && (() => {
          const uniqueVoters = getUniqueVoters();
          return uniqueVoters.length > 0 ? <VotersAvatars voters={uniqueVoters} maxDisplay={5} size="sm" /> : null;
        })()}
      </div>

      {/* Напоминание администратору УДАЛЕНО - не имеет смысла при активном голосовании */}

      {/* User votes indicator - ИЗМЕНЕНО: множественный выбор */}
      {userVotes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-pastel-sage-100 to-pastel-sage-50 dark:from-pastel-sage-900/30 dark:to-pastel-sage-800/20 border border-pastel-sage-300 dark:border-pastel-sage-700 rounded-xl p-3 mb-4"
        >
          <div className="flex items-start gap-2 text-pastel-sage-700 dark:text-pastel-sage-300">
            <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium block mb-1">
                Вы выбрали {userVotes.length} {userVotes.length === 1 ? 'блюдо' : userVotes.length < 5 ? 'блюда' : 'блюд'}:
              </span>
              <ul className="text-sm space-y-0.5">
                {userVotes.map(vote => (
                  <li key={vote.id}>
                    • <strong>{menuItems.find(i => i.id === vote.menuItemId)?.name}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* P2: Empty State для первого голосующего - ИЗМЕНЕНО: текст про множественный выбор */}
      {userVotes.length === 0 && voteCount === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6 mb-4 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl"
        >
          <div className={`${ICON_SIZES['2xl']} mx-auto mb-2 rounded-full bg-lavender-100 dark:bg-lavender-900/30 flex items-center justify-center`}>
            <Zap className={cn(ICON_SIZES.lg, "text-lavender-500")} />
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">
            Будьте первым!
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Выберите одно или несколько блюд
          </p>
        </motion.div>
      )}

      {/* Menu items */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {displayedItems.map((item, index) => {
            const isSelected = selectedItemIds.includes(item.id); // ИЗМЕНЕНО: проверка массива
            const isVoted = userVotes.some(v => v.menuItemId === item.id); // ИЗМЕНЕНО: проверка массива
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
                disabled={userVotes.length > 0 || submitting} // ИЗМЕНЕНО
                className={cn(
                  'w-full relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300',
                  'disabled:cursor-not-allowed',
                  userVotes.length === 0 && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]', // ИЗМЕНЕНО
                  // P0: Выбранный вариант - lavender mono-gradient с пульсацией
                  isSelected && userVotes.length === 0 && 'bg-gradient-to-r from-pastel-lavender-400 to-pastel-lavender-500 text-white animate-pulse-selection shadow-lg shadow-pastel-lavender-500/50', // ИЗМЕНЕНО: добавлена анимация пульсации
                  // Проголосованный вариант
                  isVoted && 'bg-gradient-to-r from-pastel-sage-400 to-pastel-sage-500 text-white shadow-lg shadow-pastel-sage-500/50',
                  // Обычный вариант - белая карточка
                  !isSelected && !isVoted && 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700'
                )}
              >
                {/* P0: Progress bar - lavender mono */}
                {userVotes.length > 0 && percentage > 0 && ( // ИЗМЕНЕНО
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
                        <Circle size={22} className="text-gray-400 dark:text-gray-400 dark:text-gray-400" />
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
                            <Crown className={cn(ICON_SIZES.sm, "text-pastel-peach-400 flex-shrink-0 drop-shadow-sm")} />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Vote stats */}
                    {userVotes.length > 0 && ( // ИЗМЕНЕНО
                      <div className={cn(
                        "flex items-center gap-3 flex-shrink-0",
                        isVoted && "text-white"
                      )}>
                        <span className="text-sm font-medium">
                          <NumberTicker value={percentage} decimalPlaces={0} />%
                        </span>
                        <div className="flex items-center gap-1 text-sm">
                          <Users size={14} />
                          <span>
                            <NumberTicker value={votes} decimalPlaces={0} />
                          </span>
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
              'bg-gradient-to-br from-pastel-peach-50 to-pastel-lavender-50',
              'dark:from-gray-800 dark:to-gray-850',
              'border-2 border-dashed border-pastel-peach-300 dark:border-pastel-peach-700',
              'hover:border-solid hover:bg-gradient-to-br hover:from-pastel-peach-100 hover:to-pastel-lavender-100',
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
              <ChevronDown className={ICON_SIZES.md} 
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
          <ChevronUp className={ICON_SIZES.sm} />
          Свернуть
        </motion.button>
      )}

      {/* Vote button - ИЗМЕНЕНО: показывается только если есть выбранные */}
      {userVotes.length === 0 && selectedItemIds.length > 0 && (
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
              <CheckCircle className={ICON_SIZES.md} />
              Проголосовать {selectedItemIds.length > 1 ? `(${selectedItemIds.length})` : ''}
            </>
          )}
        </motion.button>
      )}
    </motion.div>
  );
};
