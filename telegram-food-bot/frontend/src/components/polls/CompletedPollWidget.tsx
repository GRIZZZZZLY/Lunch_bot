import { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Trophy,
  Clock,
  Users,
  Utensils,
  X,
  Ban,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { PollWithDetails, Vote } from '../../services/polls.service';
import { ParticipantsList } from './ParticipantsList';
import { useTelegram } from '../../hooks/useTelegram';
import { format } from 'date-fns';
import { ICON_SIZES } from '@/lib/design-tokens';
import { GlassCard } from '../ui/glass-card';

interface CompletedPollWidgetProps {
  poll: PollWithDetails;
  showCelebration?: boolean;
  onCelebrationEnd?: () => void;
  className?: string;
  /** Свернуть в pill-режим по умолчанию (Home — true, отдельные экраны — false) */
  defaultCollapsed?: boolean;
  /** Колбэк для кнопки × (скрыть виджет полностью) */
  onDismiss?: () => void;
  /** Показывать admin-кнопку «Отменить голосование» (только групп-админу) */
  canCancel?: boolean;
  /** Колбэк отмены голосования (перевод в CANCELLED). Подтверждение — на стороне родителя */
  onCancel?: () => void;
  /** Идёт запрос отмены — блокирует кнопку */
  isCancelling?: boolean;
}

interface CelebrationPanelProps {
  winnerName: string;
  winnerPercentage: number;
  winnerVoteCount: number;
  voteCount: number;
  isDark: boolean;
}

const CelebrationPanel = ({ winnerName, winnerPercentage, winnerVoteCount, voteCount, isDark }: CelebrationPanelProps) => (
  <m.div
    key="celebration"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className={cn(
      'rounded-2xl p-8 shadow-xl border-2 text-center bg-white dark:bg-gray-800',
      isDark ? 'border-pastel-lavender-400' : 'border-pastel-peach-400'
    )}
  >
    <m.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      className="mb-4 flex items-center justify-center"
    >
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-xl">
        <Trophy className="w-12 h-12 text-white drop-shadow-md" />
      </div>
    </m.div>
    <m.h2
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn('text-2xl font-bold mb-2', isDark ? 'text-pastel-lavender-400' : 'text-pastel-peach-600')}
    >
      Победитель!
    </m.h2>
    <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-xl text-gray-700 dark:text-gray-300">
      <strong>{winnerName}</strong>
    </m.p>
    <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-sm text-gray-500 dark:text-gray-400 mt-2">
      {winnerPercentage}% голосов ({winnerVoteCount} из {voteCount})
    </m.p>
  </m.div>
);

interface CollapsedPollPillProps {
  winnerName: string;
  showTotalAmount: boolean;
  totalAmount: number;
  responsible?: { firstName?: string } | null;
  canCancel: boolean;
  isCancelling: boolean;
  onExpand: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
}

const CollapsedPollPill = ({
  winnerName,
  showTotalAmount,
  totalAmount,
  responsible,
  canCancel,
  isCancelling,
  onExpand,
  onCancel,
  onDismiss,
}: CollapsedPollPillProps) => (
  <m.div key="pill" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onExpand();
        }
      }}
      className="group relative flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 cursor-pointer transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Trophy className={ICON_SIZES.sm} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{winnerName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {showTotalAmount && <span className="font-medium text-foreground">{totalAmount} ₽</span>}
          {responsible && (
            <>
              {showTotalAmount && <span className="opacity-50">·</span>}
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lavender-400 to-lavender-600 text-[10px] font-semibold text-white">
                  {responsible.firstName?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="truncate">{responsible.firstName}</span>
              </span>
            </>
          )}
        </div>
      </div>
      <ChevronDown className={cn(ICON_SIZES.sm, 'flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5')} />
      {canCancel && onCancel && (
        <button type="button" onClick={event => { event.stopPropagation(); onCancel(); }} disabled={isCancelling} aria-label="Отменить голосование" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50">
          <Ban className={ICON_SIZES.xs} />
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={event => { event.stopPropagation(); onDismiss(); }} aria-label="Скрыть виджет" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <X className={ICON_SIZES.xs} />
        </button>
      )}
    </div>
  </m.div>
);

const EMPTY_VOTES: Vote[] = [];

/**
 * Компонент для отображения завершённого голосования
 * Timeline-view с expandable результатами + pill-режим (collapsed)
 */
const useCompletedPollWidgetController = ({
  poll,
  showCelebration = false,
  onCelebrationEnd,
  className,
  defaultCollapsed = false,
  onDismiss,
  canCancel = false,
  onCancel,
  isCancelling = false,
}: CompletedPollWidgetProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { colorScheme } = useTelegram();
  const isDark = colorScheme === 'dark';

  // Получаем результаты голосования
  const pollResult =
    poll.results?.[0] ||
    (poll as PollWithDetails & { result?: PollWithDetails['results'][number] }).result;
  const votes = poll.votes || EMPTY_VOTES;
  const voteCount = poll._count?.votes ?? votes.length;

  // Подсчитываем все выбранные блюда с количеством голосов и списком участников.
  // useMemo: тяжёлый проход по голосам пересчитывается только при их изменении,
  // а не на каждый рендер (раскрытие/сворачивание виджета и т.п.).
  const dishVoteCounts = useMemo(
    () =>
      votes.reduce((acc, vote) => {
        const dishId = vote.menuItemId;
        if (!acc[dishId]) {
          acc[dishId] = {
            dish: vote.menuItem,
            count: 0,
            voters: [],
          };
        }
        acc[dishId].count++;
        acc[dishId].voters.push(vote.user); // НОВОЕ: добавляем участника
        return acc;
      }, {} as Record<number, { dish: Vote['menuItem']; count: number; voters: Vote['user'][] }>),
    [votes]
  );

  // Сортируем блюда по количеству голосов (от большего к меньшему)
  const sortedDishes = useMemo(
    () => Object.values(dishVoteCounts).sort((a, b) => b.count - a.count),
    [dishVoteCounts]
  );

  // Топ-3 для отображения без клика
  const topDishes = sortedDishes.slice(0, 3);
  const remainingDishes = sortedDishes.slice(3);
  const showDishCounts = voteCount > 1;
  const totalAmount = sortedDishes.reduce(
    (sum, item) => sum + (item.dish.price || 0) * item.count,
    0
  );
  const showTotalAmount = totalAmount > 0;
  const showParticipantSummary = voteCount > 1;
  const showSummary = showParticipantSummary || showTotalAmount;

  // Находим победителя (для backward compatibility)
  const winnerDish = pollResult?.winnerItem;
  const winnerVoteCount = winnerDish ? (dishVoteCounts[winnerDish.id]?.count || 0) : 0;
  const winnerPercentage = voteCount > 0 ? Math.round((winnerVoteCount / voteCount) * 100) : 0;

  // Форматируем время завершения
  const endTime = poll.endedAt || poll.endTime;
  const formattedTime = endTime ? format(new Date(endTime), 'HH:mm') : '';

  // Подготавливаем данные для ParticipantsList
  const participants = useMemo(
    () =>
      votes.map(v => ({
        id: v.user.id,
        firstName: v.user.firstName,
        lastName: v.user.lastName || '',
        photoUrl: (v.user as { photoUrl?: string }).photoUrl,
        dishName: v.menuItem?.name || 'Неизвестно',
        dishPrice: v.menuItem?.price || 0,
        dishEmoji: (v.menuItem as { emoji?: string } | undefined)?.emoji,
      })),
    [votes]
  );

  const isActuallyCollapsed = showCelebration ? false : isCollapsed;

  // Celebration всегда показываем в развёрнутом виде (confetti на pill не падает)
  // Запускаем confetti при celebration (async loaded)
  useEffect(() => {
    if (showCelebration) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      // Load confetti dynamically
      import('canvas-confetti').then(({ default: confetti }) => {
        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            onCelebrationEnd?.();
            return;
          }

          const particleCount = 50 * (timeLeft / duration);

          confetti({
            particleCount,
            startVelocity: 30,
            spread: 360,
            origin: {
              x: randomInRange(0.1, 0.3),
              y: Math.random() - 0.2,
            },
            colors: ['#FFB899', '#C4B5FD', '#7DD3FC', '#8CE0B9', '#FCA5A5'], // pastel colors
          });

          confetti({
            particleCount,
            startVelocity: 30,
            spread: 360,
            origin: {
              x: randomInRange(0.7, 0.9),
              y: Math.random() - 0.2,
            },
            colors: ['#FFB899', '#C4B5FD', '#7DD3FC', '#8CE0B9', '#FCA5A5'],
          });
        }, 250);

        return () => clearInterval(interval);
      }).catch(() => {
        onCelebrationEnd?.();
      });
    }
  }, [showCelebration, onCelebrationEnd]);


  return { isExpanded, setIsExpanded, isCollapsed, setIsCollapsed, colorScheme, isDark, pollResult, votes, voteCount, dishVoteCounts, sortedDishes, topDishes, remainingDishes, showDishCounts, totalAmount, showTotalAmount, showParticipantSummary, showSummary, winnerDish, winnerVoteCount, winnerPercentage, endTime, formattedTime, participants, isActuallyCollapsed };
};

type CompletedPollController = ReturnType<typeof useCompletedPollWidgetController>;

interface ExpandedPollResultsProps {
  isExpanded: boolean;
  dishes: CompletedPollController['remainingDishes'];
  participants: CompletedPollController['participants'];
  topDishesCount: number;
  showDishCounts: boolean;
  isDark: boolean;
}

const ExpandedPollResults = ({
  isExpanded,
  dishes,
  participants,
  topDishesCount,
  showDishCounts,
  isDark,
}: ExpandedPollResultsProps) => (
  <AnimatePresence>
    {isExpanded && dishes.length > 0 && (
      <m.div
        initial={{ opacity: 0, scaleY: 0.98 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0, scaleY: 0.98 }}
        transition={{ duration: 0.3 }}
        className="mt-3 origin-top overflow-hidden"
      >
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {dishes.map((item, index) => {
            const displayVoters = (item.voters || []).slice(0, 10);
            const actualIndex = topDishesCount + index;
            return (
              <m.div
                key={item.dish.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2',
                  actualIndex === 0 && 'border-primary/25 bg-primary/6',
                  actualIndex > 0 && 'border-border/70 bg-muted/30'
                )}
              >
                <div className={`${ICON_SIZES.xl} rounded-lg bg-muted flex flex-shrink-0 items-center justify-center`}>
                  <Utensils className={`${ICON_SIZES.md} text-gray-600 dark:text-gray-300`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{item.dish.name}</span>
                  {showDishCounts && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.count} {item.count === 1 ? 'человек' : item.count < 5 ? 'человека' : 'человек'}
                    </span>
                  )}
                </div>
                {displayVoters.length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0 max-w-[180px]">
                    {displayVoters.map(voter => (
                      <div key={voter.id} className="flex items-center gap-1 bg-lavender-50 dark:bg-lavender-900/20 rounded-full pl-0.5 pr-2 py-0.5 border border-lavender-200 dark:border-lavender-700" title={`${voter.firstName} ${voter.lastName || ''}`}>
                        <div className={cn(`${ICON_SIZES.md} rounded-full flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0`, isDark ? 'bg-gradient-to-br from-pastel-lavender-400 to-pastel-lavender-600' : 'bg-gradient-to-br from-pastel-peach-400 to-pastel-peach-600')}>
                          {voter.firstName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60px]">{voter.firstName}</span>
                      </div>
                    ))}
                  </div>
                )}
                {item.dish.price && <div className="text-right flex-shrink-0"><span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{item.dish.price} ₽</span></div>}
              </m.div>
            );
          })}
          {participants.length > 0 && (
            <div className="pt-2">
              <ParticipantsList participants={participants} userParticipated={true} />
            </div>
          )}
        </div>
      </m.div>
    )}
  </AnimatePresence>
);

export const CompletedPollWidget = ({
  poll,
  showCelebration = false,
  onCelebrationEnd,
  className,
  defaultCollapsed = false,
  onDismiss,
  canCancel = false,
  onCancel,
  isCancelling = false,
}: CompletedPollWidgetProps) => {
  const { isExpanded, setIsExpanded, isCollapsed, setIsCollapsed, colorScheme, isDark, pollResult, votes, voteCount, dishVoteCounts, sortedDishes, topDishes, remainingDishes, showDishCounts, totalAmount, showTotalAmount, showParticipantSummary, showSummary, winnerDish, winnerVoteCount, winnerPercentage, endTime, formattedTime, participants, isActuallyCollapsed } = useCompletedPollWidgetController({ poll, showCelebration, onCelebrationEnd, className, defaultCollapsed, onDismiss, canCancel, onCancel, isCancelling });
  return (
    <div className={cn('relative', className)}>

      {/* Celebration message (3 секунды) */}
      <AnimatePresence mode="wait">
        {showCelebration && winnerDish && (
          <CelebrationPanel
            winnerName={winnerDish.name}
            winnerPercentage={winnerPercentage}
            winnerVoteCount={winnerVoteCount}
            voteCount={voteCount}
            isDark={isDark}
          />
        )}

        {/* Pill (collapsed) — компактная плашка для Home */}
        {!showCelebration && isActuallyCollapsed && (
          <CollapsedPollPill
            winnerName={winnerDish?.name ?? topDishes[0]?.dish.name ?? 'Голосование завершено'}
            showTotalAmount={showTotalAmount}
            totalAmount={totalAmount}
            responsible={pollResult?.responsible}
            canCancel={canCancel}
            isCancelling={isCancelling}
            onExpand={() => setIsCollapsed(false)}
            onCancel={onCancel}
            onDismiss={onDismiss}
          />
        )}

        {/* Menu Summary Card (после celebration) */}
        {!showCelebration && !isActuallyCollapsed && (
          <m.div
            key="menu-summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassCard
              intensity="solid"
              className={cn(
                "relative overflow-hidden p-4",
                "border border-border/70"
              )}
            >
              {/* Content with z-index */}
              <div className="relative z-10">
            {/* Header с временем */}
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "flex-shrink-0 px-2 py-1 rounded-md",
                  isDark
                    ? "bg-lavender-500/10"
                    : "bg-primary/10"
                )}>
                <span className={cn(
                  "text-xs font-medium flex items-center gap-1",
                  isDark
                    ? "text-lavender-400"
                    : "text-primary"
                )}>
                  <Clock className={ICON_SIZES.xs} />
                  {formattedTime}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Голосование завершено
              </span>
              {defaultCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  aria-label="Свернуть"
                  className="ml-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <ChevronUp className={ICON_SIZES.xs} />
                </button>
              )}
            </div>

            {/* Заголовок секции меню */}
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary"
                )}>
                  <Trophy className={cn(ICON_SIZES.sm)} />
                </div>
                Заказываем сегодня
              </h3>

            {/* Список блюд с Peek Animation */}
            <div className="space-y-2 mb-3">
              {topDishes.map((item, index) => {
                const voters = item.voters || [];
                const displayVoters = voters.slice(0, 10); // Лимит 10 участников

                return (
                  <m.div
                    key={item.dish.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2.5",
                        index === 0 && "border-primary/25 bg-primary/6",
                        index > 0 && "border-border/70 bg-muted/35"
                      )}
                    >
                    {/* Иконка блюда */}
                    <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Utensils className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </div>
                    </div>

                    {/* Название и статистика */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                        {item.dish.name}
                      </span>
                      {showDishCounts && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.count} {item.count === 1 ? 'человек' : item.count < 5 ? 'человека' : 'человек'}
                        </span>
                      )}
                    </div>

                    {/* НОВОЕ: Участники (аватары + имена) справа */}
                    {displayVoters.length > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0 max-w-[180px]">
                        {displayVoters.map((voter) => (
                          <div
                            key={voter.id}
                            className="flex items-center gap-1 bg-lavender-50 dark:bg-lavender-900/20 rounded-full pl-0.5 pr-2 py-0.5 border border-lavender-200 dark:border-lavender-700"
                            title={`${voter.firstName} ${voter.lastName || ''}`}
                          >
                            {/* Аватар */}
                            <div className={cn(
                              `${ICON_SIZES.md} rounded-full flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0`,
                              isDark
                                ? "bg-lavender-500"
                                : "bg-primary"
                            )}>
                              {voter.firstName?.[0]?.toUpperCase() || '?'}
                            </div>
                            {/* Имя (только если помещается) */}
                            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60px]">
                              {voter.firstName}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Цена */}
                    {item.dish.price && (
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-semibold text-mint-600 dark:text-mint-400">
                          {item.dish.price} ₽
                        </span>
                      </div>
                    )}
                  </m.div>
                );
              })}

              {/* Если блюд больше 3 */}
              {remainingDishes.length > 0 && (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: topDishes.length * 0.1 + 0.2 }}
                  className="text-center"
                >
                  <button type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <span>+{remainingDishes.length} {remainingDishes.length === 1 ? 'блюдо' : remainingDishes.length < 5 ? 'блюда' : 'блюд'}</span>
                    <m.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className={ICON_SIZES.xs} />
                    </m.div>
                  </button>
                </m.div>
              )}
            </div>

            {/* Duty banner — Сегодня дежурит (prominent lavender block) */}
            {pollResult?.responsible && (
              <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
                className={cn(
                  'mt-3 rounded-2xl border p-4',
                  'border-lavender-500/25 bg-lavender-500/10',
                  'dark:border-lavender-500/30 dark:bg-lavender-500/12',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lavender-400 to-lavender-600 text-base font-bold text-white shadow-sm">
                    {pollResult.responsible.firstName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-lavender-700 dark:text-lavender-300">
                      Сегодня дежурит
                    </div>
                    <div className="truncate text-sm font-semibold text-foreground">
                      {pollResult.responsible.firstName}
                      {pollResult.responsible.lastName && ` ${pollResult.responsible.lastName}`}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      принимает заказ · раздаёт
                    </div>
                  </div>
                </div>
              </m.div>
            )}

            {/* Общая статистика */}
            {showSummary && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {showParticipantSummary && (
                    <>
                      Участвовало: <strong>{voteCount}</strong>{' '}
                      {voteCount === 1 ? 'человек' : voteCount < 5 ? 'человека' : 'человек'}
                    </>
                  )}
                  {showTotalAmount && (
                    <>
                      {showParticipantSummary && ' · '}
                      Общая сумма: <strong>{totalAmount} ₽</strong>
                    </>
                  )}
                </div>
              </div>
            )}

            <ExpandedPollResults
              isExpanded={isExpanded}
              dishes={remainingDishes}
              participants={participants}
              topDishesCount={topDishes.length}
              showDishCounts={showDishCounts}
              isDark={isDark}
            />
              </div>
            </GlassCard>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
