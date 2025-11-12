import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Trophy,
  Clock,
  Users,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { PollWithDetails } from '../../services/polls.service';
import { ParticipantsList } from './ParticipantsList';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useTelegram } from '../../hooks/useTelegram';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getDishCategoryIcon } from '../../lib/iconMapping';
import { ICON_SIZES } from '@/lib/design-tokens';

interface CompletedPollWidgetProps {
  poll: PollWithDetails;
  showCelebration?: boolean;
  onCelebrationEnd?: () => void;
  className?: string;
}

/**
 * Компонент для отображения завершённого голосования
 * Timeline-view с expandable результатами
 */
export const CompletedPollWidget: React.FC<CompletedPollWidgetProps> = ({
  poll,
  showCelebration = false,
  onCelebrationEnd,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { colorScheme } = useTelegram();
  const isDark = colorScheme === 'dark';

  // Получаем результаты голосования
  const pollResult = poll.results?.[0];
  const votes = poll.votes || [];
  const voteCount = poll._count?.votes || 0;

  // Подсчитываем все выбранные блюда с количеством голосов и списком участников
  const dishVoteCounts = votes.reduce((acc, vote) => {
    const dishId = vote.menuItemId;
    if (!acc[dishId]) {
      acc[dishId] = {
        dish: vote.menuItem,
        count: 0,
        voters: [], // НОВОЕ: массив участников
      };
    }
    acc[dishId].count++;
    acc[dishId].voters.push(vote.user); // НОВОЕ: добавляем участника
    return acc;
  }, {} as Record<number, { dish: any; count: number; voters: any[] }>);

  // Сортируем блюда по количеству голосов (от большего к меньшему)
  const sortedDishes = Object.values(dishVoteCounts)
    .sort((a, b) => b.count - a.count);

  // Топ-3 для отображения без клика
  const topDishes = sortedDishes.slice(0, 3);
  const remainingDishes = sortedDishes.slice(3);

  // Самое популярное блюдо (для pulse эффекта)
  const mostPopular = sortedDishes[0];

  // Находим победителя (для backward compatibility)
  const winnerDish = pollResult?.winnerItem;
  const winnerVoteCount = winnerDish ? (dishVoteCounts[winnerDish.id]?.count || 0) : 0;
  const winnerPercentage = voteCount > 0 ? Math.round((winnerVoteCount / voteCount) * 100) : 0;

  // Форматируем время завершения
  const endTime = poll.endedAt || (poll as any).endTime;
  const formattedTime = endTime ? format(new Date(endTime), 'HH:mm', { locale: ru }) : '';

  // Подготавливаем данные для ParticipantsList
  const participants = votes.map(v => ({
    id: v.user.id,
    firstName: v.user.firstName,
    lastName: v.user.lastName || '',
    photoUrl: (v.user as any).photoUrl,
    dishName: v.menuItem?.name || 'Неизвестно',
    dishPrice: v.menuItem?.price || 0,
    dishEmoji: (v.menuItem as any)?.emoji,
  }));

  // Запускаем confetti при celebration
  useEffect(() => {
    if (showCelebration) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

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
    }
  }, [showCelebration, onCelebrationEnd]);

  return (
    <div className={cn('relative', className)}>

      {/* Celebration message (3 секунды) */}
      <AnimatePresence mode="wait">
        {showCelebration && winnerDish && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "rounded-2xl p-8 shadow-xl border-2 text-center bg-white dark:bg-gray-800",
              isDark
                ? "border-pastel-lavender-400"
                : "border-pastel-peach-400"
            )}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mb-4 flex items-center justify-center"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-xl">
                <Trophy className="w-12 h-12 text-white drop-shadow-md" />
              </div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "text-2xl font-bold mb-2",
                isDark
                  ? "text-pastel-lavender-400"
                  : "text-pastel-peach-600"
              )}
            >
              Победитель!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-gray-700 dark:text-gray-300"
            >
              <strong>{winnerDish.name}</strong>
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-gray-500 dark:text-gray-400 mt-2"
            >
              {winnerPercentage}% голосов ({winnerVoteCount} из {voteCount})
            </motion.p>
          </motion.div>
        )}

        {/* Menu Summary Card (после celebration) */}
        {!showCelebration && (
          <motion.div
            key="menu-summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "rounded-xl p-4 shadow-sm border-2 bg-white dark:bg-gray-800",
              isDark
                ? "border-pastel-lavender-300"
                : "border-pastel-peach-300"
            )}
          >
            {/* Header с временем */}
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "flex-shrink-0 px-2 py-1 rounded-md",
                isDark
                  ? "bg-pastel-lavender-100 dark:bg-pastel-lavender-900/30"
                  : "bg-pastel-peach-100"
              )}>
                <span className={cn(
                  "text-xs font-medium flex items-center gap-1",
                  isDark
                    ? "text-pastel-lavender-600 dark:text-pastel-lavender-400"
                    : "text-pastel-peach-600"
                )}>
                  <Clock className={ICON_SIZES.xs} />
                  {formattedTime}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Голосование завершено
              </span>
            </div>

            {/* Заголовок секции меню */}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Trophy className={`${ICON_SIZES.md} text-yellow-500 dark:text-yellow-400`} />
              Заказываем сегодня
            </h3>

            {/* Список блюд с Peek Animation */}
            <div className="space-y-2 mb-3">
              {topDishes.map((item, index) => {
                const isMostPopular = mostPopular && item.dish.id === mostPopular.dish.id;
                const voters = item.voters || [];
                const displayVoters = voters.slice(0, 10); // Лимит 10 участников

                return (
                  <motion.div
                    key={item.dish.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border",
                      isMostPopular
                        ? "bg-pastel-sage-50 dark:bg-pastel-sage-900/20 border-pastel-sage-200 dark:border-pastel-sage-700"
                        : "bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {/* Иконка блюда */}
                    <motion.div 
                      className="flex-shrink-0"
                      animate={isMostPopular ? {
                        scale: [1, 1.1, 1],
                      } : {}}
                      transition={isMostPopular ? {
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "loop",
                      } : {}}
                    >
                      {(() => {
                        const Icon = getDishCategoryIcon((item.dish as any).category || 'default');
                        return (
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isMostPopular
                              ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                              : "bg-gray-100 dark:bg-gray-700"
                          )}>
                            <Icon className={cn(
                              "w-6 h-6",
                              isMostPopular ? "text-white" : "text-gray-600 dark:text-gray-300"
                            )} />
                          </div>
                        );
                      })()}
                    </motion.div>

                    {/* Название и статистика */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.dish.name}
                        </span>
                        {isMostPopular && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5 }}
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-mint-600 dark:text-mint-400 flex-shrink-0" />
                          </motion.div>
                        )}
                      </div>
                      {/* ИЗМЕНЕНО: убрали процент */}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.count} {item.count === 1 ? 'человек' : item.count < 5 ? 'человека' : 'человек'}
                      </span>
                    </div>

                    {/* НОВОЕ: Участники (аватары + имена) справа */}
                    {displayVoters.length > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0 max-w-[180px]">
                        {displayVoters.map((voter, vIndex) => (
                          <div
                            key={voter.id}
                            className="flex items-center gap-1 bg-lavender-50 dark:bg-lavender-900/20 rounded-full pl-0.5 pr-2 py-0.5 border border-lavender-200 dark:border-lavender-700"
                            title={`${voter.firstName} ${voter.lastName || ''}`}
                          >
                            {/* Аватар */}
                            <div className={cn(
                              `${ICON_SIZES.md} rounded-full flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0`,
                              isDark
                                ? "bg-gradient-to-br from-pastel-lavender-400 to-pastel-lavender-600"
                                : "bg-gradient-to-br from-pastel-peach-400 to-pastel-peach-600"
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
                  </motion.div>
                );
              })}

              {/* Если блюд больше 3 */}
              {remainingDishes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: topDishes.length * 0.1 + 0.2 }}
                  className="text-center"
                >
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <span>+{remainingDishes.length} {remainingDishes.length === 1 ? 'блюдо' : remainingDishes.length < 5 ? 'блюда' : 'блюд'}</span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className={ICON_SIZES.xs} />
                    </motion.div>
                  </button>
                </motion.div>
              )}
            </div>

            {/* Ответственный (всегда виден) */}
            {pollResult?.responsible && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className={`${ICON_SIZES.xl} rounded-full bg-lavender-100 dark:bg-lavender-900/30 flex items-center justify-center flex-shrink-0`}>
                    <Users className={`${ICON_SIZES.sm} text-lavender-600 dark:text-lavender-400`} />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Ответственный
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {pollResult.responsible.firstName}
                      {pollResult.responsible.lastName && ` ${pollResult.responsible.lastName}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Общая статистика */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Участвовало: <strong>{voteCount}</strong> {voteCount === 1 ? 'человек' : voteCount < 5 ? 'человека' : 'человек'}
                {sortedDishes.length > 0 && sortedDishes[0].dish.price && (
                  <> · Общая сумма: <strong>{sortedDishes.reduce((sum, item) => sum + (item.dish.price || 0) * item.count, 0)} ₽</strong></>
                )}
              </div>
            </div>

            {/* Expanded results - оставшиеся блюда и детали */}
            <AnimatePresence>
              {isExpanded && remainingDishes.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {/* Оставшиеся блюда */}
                    {remainingDishes.map((item, index) => {
                      const voters = item.voters || [];
                      const displayVoters = voters.slice(0, 10); // Лимит 10 участников

                      return (
                        <motion.div
                          key={item.dish.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05, duration: 0.2 }}
                          className="flex items-center gap-3 p-2 rounded-lg bg-white/30 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700"
                        >
                          {/* Иконка */}
                          <div className="flex-shrink-0">
                            {(() => {
                              const Icon = getDishCategoryIcon((item.dish as any).category || 'default');
                              return (
                                <div className={`${ICON_SIZES.xl} rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center`}>
                                  <Icon className={`${ICON_SIZES.md} text-gray-600 dark:text-gray-300`} />
                                </div>
                              );
                            })()}
                          </div>

                          {/* Название и статистика */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                              {item.dish.name}
                            </span>
                            {/* ИЗМЕНЕНО: убрали процент */}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.count} {item.count === 1 ? 'человек' : item.count < 5 ? 'человека' : 'человек'}
                            </span>
                          </div>

                          {/* НОВОЕ: Участники (аватары + имена) справа */}
                          {displayVoters.length > 0 && (
                            <div className="flex items-center gap-1 flex-shrink-0 max-w-[180px]">
                              {displayVoters.map((voter, vIndex) => (
                                <div
                                  key={voter.id}
                                  className="flex items-center gap-1 bg-lavender-50 dark:bg-lavender-900/20 rounded-full pl-0.5 pr-2 py-0.5 border border-lavender-200 dark:border-lavender-700"
                                  title={`${voter.firstName} ${voter.lastName || ''}`}
                                >
                                  {/* Аватар */}
                                  <div className={cn(
                                    `${ICON_SIZES.md} rounded-full flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0`,
                                    isDark
                                      ? "bg-gradient-to-br from-pastel-lavender-400 to-pastel-lavender-600"
                                      : "bg-gradient-to-br from-pastel-peach-400 to-pastel-peach-600"
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
                              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                {item.dish.price} ₽
                              </span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Participants list */}
                    {participants.length > 0 && (
                      <div className="pt-2">
                        <ParticipantsList
                          participants={participants}
                          userParticipated={true}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
