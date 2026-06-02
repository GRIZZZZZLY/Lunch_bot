import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  CheckCircle,
  Circle,
  Crown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Utensils,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useIsGroupAdmin } from '../../hooks/useIsGroupAdmin';
import { useHaptic } from '../../hooks/useHaptic';
import { useAppStore } from '../../store/useAppStore';
import { trackEvent, ANALYTICS_EVENTS } from '../../lib/analytics';
import { pollsService, PollWithDetails, Vote } from '../../services/polls.service';
import { menuService, MenuItem } from '../../services/menu.service';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '../../lib/design-tokens';
import { TYPOGRAPHY_BODY } from '../../lib/typography';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { VotersAvatars } from './VotersAvatars';
import { VotingCardSkeleton } from '../common/Skeletons';
import { NumberTicker } from '../ui/number-ticker';
import { CircularProgressTimer } from '../ui/circular-progress-timer';
import { recordVote } from '../../services/insights.service';
import { getHumanErrorMessage } from '../../lib/error-messages';
import { PollStatusBadge } from './PollStatusBadge';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { GlassCard } from '../ui/glass-card';

interface InlineVotingCardProps {
  poll: PollWithDetails;
  onPollClosed?: () => void;
  onVoteSuccess?: () => void;
}

/**
 * Компонент встроенного голосования для главной страницы
 * Содержит всю логику голосования без перехода на отдельную страницу
 * ПОДДЕРЖИВАЕТ МНОЖЕСТВЕННЫЙ ВЫБОР
 */
export const InlineVotingCard = ({
  poll: initialPoll,
  onPollClosed,
  onVoteSuccess,
}: InlineVotingCardProps) => {
  const { user } = useAuth();
  const isGroupAdmin = useIsGroupAdmin();
  const haptic = useHaptic();
  const addNotification = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const [poll, setPoll] = useState<PollWithDetails>(initialPoll);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]); // ИЗМЕНЕНО: массив вместо одного ID
  const [userVotes, setUserVotes] = useState<Vote[]>([]); // ИЗМЕНЕНО: массив вместо одного vote
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [removingVote, setRemovingVote] = useState(false);
  
  // UX: Показать ещё паттерн для скролла
  const INITIAL_ITEMS_COUNT = 5;
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isMultiSelectMode = poll.isMultiSelect !== false;
  const maxSelections = isMultiSelectMode
    ? Math.max(1, Math.min(poll.maxSelections || 3, 3))
    : 1;

  // Adaptive theme detection
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    return () => observer.disconnect();
  }, []);

  const loadPollData = useCallback(async (pollId: number, silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);

      // Загружаем свежие данные голосования
      const pollResponse = await pollsService.getPollById(pollId);
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
      const menuResponse = await menuService.getActiveItems(pollResponse.data?.groupId ?? poll.groupId);
      if (menuResponse.success && menuResponse.data) {
        let items = menuResponse.data;
        
        // Фильтруем по выбранным блюдам, если они указаны в poll
        if (pollResponse.data?.selectedMenuItemIds) {
          try {
            const selectedIds = JSON.parse(pollResponse.data.selectedMenuItemIds);
            if (Array.isArray(selectedIds) && selectedIds.length > 0) {
              const selectedIdSet = new Set(selectedIds);
              items = items.filter(item => selectedIdSet.has(item.id));
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
        
        // Добавляем специальную опцию "Еда с собой" из БД (всегда последняя)
        // ID 193 - специальная запись в menu_items для флага "заказ с собой"
        const takeawayFromDB = menuResponse.data.find(item => item.name === 'Еда с собой');
        
        if (takeawayFromDB && !items.find(i => i.id === takeawayFromDB.id)) {
          items.push(takeawayFromDB);
          console.log('[InlineVotingCard] ✅ Added takeaway option from DB:', takeawayFromDB.id);
        }
        
        setMenuItems(items);
      }
    } catch (error) {
      console.error('Error loading poll data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  // Загрузка данных
  useEffect(() => {
    setPoll(initialPoll);
    loadPollData(initialPoll.id, false);
  }, [initialPoll, loadPollData]);

  // Автообновление каждые 30 секунд
  useEffect(() => {
    if (poll.status !== 'ACTIVE') return;

    const refreshInterval = setInterval(() => {
      loadPollData(poll.id, true); // silent
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [poll.status, poll.id, loadPollData]);

  /**
   * Один проход по голосам: общее число уникальных пользователей
   * и число уникальных голосующих на каждое блюдо.
   * Заменяет повторные filter+Set на каждый рендер.
   */
  const { uniqueVotersCount, voterCountByItem } = useMemo(() => {
    const votes = poll.votes || [];
    const uniqueUsers = new Set<number>();
    const itemVoters = new Map<number, Set<number>>();
    for (const v of votes) {
      uniqueUsers.add(v.userId);
      let set = itemVoters.get(v.menuItemId);
      if (!set) {
        set = new Set<number>();
        itemVoters.set(v.menuItemId, set);
      }
      set.add(v.userId);
    }
    const counts = new Map<number, number>();
    itemVoters.forEach((set, itemId) => counts.set(itemId, set.size));
    return { uniqueVotersCount: uniqueUsers.size, voterCountByItem: counts };
  }, [poll.votes]);

  // Set выбранных и уже проголосованных блюд — O(1) проверка в рендере
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const votedItemIdSet = useMemo(
    () => new Set(userVotes.map(v => v.menuItemId)),
    [userVotes]
  );

  /**
   * Получить количество уникальных пользователей, проголосовавших
   * Один пользователь = один голос, независимо от количества выбранных блюд
   */
  const getUniqueVotersCount = (): number => uniqueVotersCount;

  /**
   * Получить количество уникальных пользователей, выбравших конкретное блюдо
   */
  const getItemUniqueVotersCount = (itemId: number): number =>
    voterCountByItem.get(itemId) ?? 0;

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
      if (!isMultiSelectMode) {
        return prev.includes(itemId) ? [] : [itemId];
      }

      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId); // Убрать из выбранных
      } else {
        if (prev.length >= maxSelections) {
          haptic.error();
          addNotification({
            type: 'warning',
            message: `Можно выбрать максимум ${maxSelections} ${maxSelections === 1 ? 'блюдо' : maxSelections < 5 ? 'блюда' : 'блюд'}`,
          });
          return prev;
        }
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
        // Тройная ритмичная вибрация для явного подтверждения
        haptic.success();
        setTimeout(() => haptic.light(), 80);
        setTimeout(() => haptic.light(), 160);
        
        // P1.2.4: Track vote event
        trackEvent(ANALYTICS_EVENTS.VOTE_SUBMITTED, {
          pollId: poll.id,
          menuItemIds: selectedItemIds, // ИЗМЕНЕНО: массив
          count: selectedItemIds.length,
          pollType: 'inline',
        });

        // Записываем голоса в историю для инсайтов
        if (user?.id) {
          selectedItemIds.forEach(itemId => {
            const item = menuItems.find(m => m.id === itemId);
            if (item) {
              recordVote(user.id, item.id, item.name, poll.id);
            }
          });
        }
        
        // Показываем toast сразу (без overlay)
        addNotification({
          type: 'success',
          message: '✅ Голос принят!',
        });

        queryClient.invalidateQueries({
          queryKey: ['categoryOrders', poll.id],
        });
        
        // Небольшая задержка для синхронизации
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Обновляем данные
        await loadPollData(poll.id, true);
        
        if (onVoteSuccess) onVoteSuccess();
      } else {
        throw new Error(response.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      haptic.error();
      addNotification({
        type: 'error',
        message: getHumanErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClosePoll = async () => {
    setShowConfirmClose(true);
  };
  
  const confirmClosePoll = async () => {
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
    } catch (error: unknown) {
      haptic.error();
      addNotification({
        type: 'error',
        message: getHumanErrorMessage(error),
      });
    } finally {
      setClosing(false);
      setShowConfirmClose(false);
    }
  };

  // Cancel poll (delete without results)
  const handleCancelPoll = async () => {
    try {
      setClosing(true);
      haptic.impact();

      const response = await pollsService.cancelPoll(poll.id, 'Отменено администратором');
      if (response.success) {
        haptic.success();
        addNotification({
          type: 'success',
          message: '✅ Голосование отменено и удалено',
        });
        if (onPollClosed) onPollClosed();
      } else {
        throw new Error(response.error);
      }
    } catch (error: unknown) {
      haptic.error();
      addNotification({
        type: 'error',
        message: getHumanErrorMessage(error),
      });
    } finally {
      setClosing(false);
      setShowConfirmClose(false);
    }
  };

  // Отменить свой голос
  const handleRemoveVote = async () => {
    try {
      setRemovingVote(true);
      haptic.light();

      const response = await pollsService.removeVote(poll.id);
      if (response.success) {
        haptic.success();
        addNotification({
          type: 'success',
          message: '✅ Твой голос отменён. Можешь проголосовать заново!',
        });
        // Обновляем данные
        await loadPollData(poll.id, true);
        // Сбрасываем выбранные элементы
        setSelectedItemIds([]);
      } else {
        throw new Error(response.error);
      }
    } catch (error: unknown) {
      haptic.error();
      addNotification({
        type: 'error',
        message: getHumanErrorMessage(error),
      });
    } finally {
      setRemovingVote(false);
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
    return <VotingCardSkeleton />;
  }

  // Количество УНИКАЛЬНЫХ пользователей (один пользователь = один голос)
  const voteCount = getUniqueVotersCount();
  const leadingItemId = getLeadingItemId();

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <GlassCard
          intensity="medium"
          className={cn(
            "relative overflow-hidden p-6",
            "border border-border/70"
          )}
          role="region"
          aria-label={`Голосование: ${poll.title || 'Выбери блюдо'}`}
          aria-live="polite"
        >
          {/* Content with z-index */}
          <div className="relative z-10">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "p-1.5 rounded-lg",
              isDark 
                ? "bg-lavender-500/14 text-lavender-400" 
                : "bg-primary/12 text-primary"
            )}>
              <Sparkles size={18} className="currentColor" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">
                Голосование
              </h3>
              <PollStatusBadge 
                status={poll.status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'PAUSED'} 
                hasVoted={userVotes.length > 0}
                size="sm"
              />
              {/* КРУГОВОЙ ТАЙМЕР - компактный */}
              {(() => {
                // Используем endTime если есть, иначе вычисляем из startedAt + duration
                const endTimeToUse = poll.endTime || poll.endedAt;
                
                if (poll.status === 'ACTIVE' && endTimeToUse) {
                  return <CircularProgressTimer endTime={endTimeToUse} size="sm" />;
                }
                
                // Если endTime нет, вычисляем на лету (fallback)
                if (poll.status === 'ACTIVE' && poll.startedAt && poll.duration) {
                  const calculatedEndTime = new Date(poll.startedAt);
                  calculatedEndTime.setMinutes(calculatedEndTime.getMinutes() + poll.duration);
                  return <CircularProgressTimer endTime={calculatedEndTime.toISOString()} size="sm" />;
                }
                
                return null;
              })()}
            </div>
          </div>
          <p className="ml-9 text-xs text-muted-foreground">Выбери блюдо</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin close button - завершить голосование досрочно */}
          {isGroupAdmin && (
            <button
              onClick={handleClosePoll}
              disabled={closing}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400 rounded-lg transition-all duration-200 disabled:opacity-50 border border-emerald-300 dark:border-emerald-700"
              title="Завершить голосование досрочно"
            >
              <CheckCircle size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        {/* Счётчик уникальных пользователей (один пользователь = один голос) */}
        <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/8 px-3 py-2 text-primary">
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
          className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl p-3 mb-4"
        >
          <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
            <CheckCircle size={18} className="flex-shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1">
              <span className="text-sm font-medium block mb-1">
                Ты выбрал {userVotes.length} {userVotes.length === 1 ? 'блюдо' : userVotes.length < 5 ? 'блюда' : 'блюд'}:
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

      {/* Selection mode hint */}
      {userVotes.length === 0 && menuItems.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center gap-2 rounded-lg border border-butter-500/20 bg-butter-500/8 px-3 py-2"
        >
          <Sparkles className={cn(ICON_SIZES.sm, "text-butter-600 dark:text-butter-400 flex-shrink-0")} />
          <p className="text-sm text-foreground">
            {isMultiSelectMode ? (
              <>
                <strong>Выбери до {maxSelections} блюд</strong> — нажми на нужные
              </>
            ) : (
              <>
                <strong>Выбери одно блюдо</strong>
              </>
            )}
          </p>
        </motion.div>
      )}

      {/* Sticky selected counter */}
      {userVotes.length === 0 && selectedItemIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-20 mb-3 rounded-lg border border-primary/20 bg-card px-3 py-2 text-foreground shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              Выбрано: {selectedItemIds.length}/{maxSelections}
            </span>
            <button
              type="button"
              onClick={() => setSelectedItemIds([])}
              className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              Очистить
            </button>
          </div>
        </motion.div>
      )}

      {/* Menu items */}
      <div 
        className="space-y-2" 
        role="listbox" 
        aria-label="Список блюд для голосования"
        aria-multiselectable={isMultiSelectMode}
      >
        <AnimatePresence mode="popLayout">
          {displayedItems.map((item, index) => {
            const isSelected = selectedItemIdSet.has(item.id); // O(1) через Set
            const isVoted = votedItemIdSet.has(item.id); // O(1) через Set
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
                disabled={userVotes.length > 0 || submitting}
                role="option"
                aria-selected={isSelected || isVoted}
                aria-label={`${item.name}${item.price ? `, ${item.price} ₸` : ''}${isVoted ? ', ты проголосовал за это блюдо' : ''}`}
                tabIndex={0}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    'w-full relative overflow-hidden rounded-xl p-4 text-left transition-all duration-200 ease-out',
                    'disabled:cursor-not-allowed',
                    userVotes.length === 0 && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                    // Выбранный вариант - тёплый accent surface
                    isSelected && userVotes.length === 0 && 
                      'border border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/15 scale-[1.01]',
                    // Проголосованный вариант - neutral gray с галочкой
                    isVoted && 'bg-muted/80 text-foreground border border-border',
                    // Обычный вариант - белая карточка
                    !isSelected && !isVoted && 'bg-card text-foreground shadow-sm hover:shadow-md border border-border/70'
                  )}
                >
                {/* Progress bar - адаптивный */}
                {userVotes.length > 0 && percentage > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn(
                      "absolute inset-0",
                        isDark
                          ? "bg-primary/12"
                          : "bg-primary/10"
                     )}
                   />
                )}

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {isVoted ? (
                        <CheckCircle size={22} className="text-gray-600 dark:text-gray-400" />
                        ) : isSelected ? (
                          <CheckCircle size={22} className="text-primary drop-shadow-sm" />
                      ) : (
                        <Circle size={22} className="text-gray-300 dark:text-gray-600" />
                      )}
                    </div>

                    {/* Item name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          TYPOGRAPHY_BODY.weight,
                          "truncate",
                          (isSelected || isVoted) && "drop-shadow-sm"
                        )}>{item.name}</span>
                        {isLeading && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                          >
                            <Crown className={cn(ICON_SIZES.sm, "text-primary flex-shrink-0 drop-shadow-sm")} />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Vote stats */}
                    {userVotes.length > 0 && ( // ИЗМЕНЕНО
                      <div className={cn(
                        "flex items-center gap-3 flex-shrink-0",
                        isVoted && "text-foreground"
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
              'bg-muted/55 dark:bg-muted/55',
              'border border-dashed border-border',
              'hover:border-primary/35 hover:bg-muted/75',
              'transition-all duration-300',
              'group'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-lavender-500/12 p-2 transition-transform group-hover:scale-110">
                  <Utensils size={18} className="text-lavender-600 dark:text-lavender-300" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    Ещё {remainingCount} {getDishWord(remainingCount)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Нажми, чтобы показать все варианты
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

      {/* Vote button - показывается только если есть выбранные */}
      {userVotes.length === 0 && selectedItemIds.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleVote}
          disabled={submitting}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 font-semibold text-primary-foreground shadow-sm transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
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
      
      {/* Кнопка отмены голоса - показывается после голосования */}
      {userVotes.length > 0 && poll.status === 'ACTIVE' && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRemoveVote}
          disabled={removingVote}
          className={cn(
            "w-full mt-4 min-h-[44px] rounded-xl py-3 px-4 font-medium",
            "transition-all duration-200 ease-out flex items-center justify-center gap-2",
            "disabled:opacity-50 border-2",
            // Адаптивные цвета
            isDark
              ? "bg-lavender-500/10 hover:bg-lavender-500/20 border-lavender-500/30 text-lavender-700 dark:text-lavender-300"
              : "bg-peach-500/10 hover:bg-peach-500/20 border-peach-500/30 text-peach-700"
          )}
        >
          {removingVote ? (
            <>
              <LoadingSpinner size="sm" />
              Отмена...
            </>
          ) : (
            <>
              <RotateCcw className={ICON_SIZES.md} />
              Отменить голос и выбрать заново
            </>
          )}
        </motion.button>
      )}
          </div>
        </GlassCard>
      </motion.div>
      
      {/* Confirm Dialog для завершения голосования */}
      <ConfirmDialog
        isOpen={showConfirmClose}
        onClose={() => setShowConfirmClose(false)}
        onConfirm={confirmClosePoll}
        onCancel={handleCancelPoll}
        title="Завершить голосование?"
        description="Завершить — подведём итоги и выберем победителя.\nОтменить — удалит голосование без результатов."
        confirmLabel="Завершить"
        cancelLabel="Отменить голосование"
        variant="warning"
      />
    </>
  );
};
