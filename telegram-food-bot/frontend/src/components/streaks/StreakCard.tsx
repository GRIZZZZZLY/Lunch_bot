/**
 * StreakCard - Полноценная карточка с детальной информацией о серии
 * Показывает прогресс, следующий milestone, мотивационные сообщения
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';
import { getProgressToNextMilestone, STREAK_MILESTONES } from '@/types/streak.types';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  totalVotes: number;
  showConfetti?: boolean;
  compact?: boolean;
  className?: string;
}

export const StreakCard: React.FC<StreakCardProps> = ({
  currentStreak,
  longestStreak,
  totalVotes,
  showConfetti = false,
  compact = false,
  className,
}) => {
  const { width, height } = useWindowSize();
  const { progress, nextMilestone, daysRemaining } = getProgressToNextMilestone(currentStreak);

  const getStreakGradient = (days: number) => {
    if (days >= 30) return 'from-purple-500 via-pink-500 to-purple-600';
    if (days >= 14) return 'from-blue-500 via-cyan-500 to-blue-600';
    if (days >= 7) return 'from-yellow-500 via-orange-500 to-yellow-600';
    if (days >= 3) return 'from-orange-500 via-red-500 to-orange-600';
    return 'from-gray-400 via-gray-500 to-gray-600';
  };

  const getMotivationalMessage = (days: number) => {
    if (days === 0) return 'Начни свою серию сегодня!';
    if (days === 1) return 'Отличное начало! Продолжай завтра!';
    if (days === 2) return 'Ещё один день и будет 3 подряд!';
    if (days < 7) return 'Продолжай в том же духе!';
    if (days < 14) return 'Ты на правильном пути!';
    if (days < 30) return 'Невероятная серия!';
    if (days < 50) return 'Ты легенда!';
    if (days < 100) return 'Мастер привычек!';
    return 'Ты просто невероятен!';
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'bg-gradient-to-r p-4 rounded-xl text-white shadow-lg',
          getStreakGradient(currentStreak),
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Flame size={32} className="fill-current" />
            </motion.div>
            <div>
              <div className="text-3xl font-bold">{currentStreak}</div>
              <div className="text-sm opacity-90">дней подряд</div>
            </div>
          </div>
          
          {nextMilestone && (
            <div className="text-right">
              <div className="text-xs opacity-75">До {nextMilestone.emoji}</div>
              <div className="text-lg font-semibold">{daysRemaining} дн.</div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={200} />}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl',
          'border-l-4 border-orange-500 dark:border-purple-500',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn(
                'p-3 rounded-xl bg-gradient-to-br',
                getStreakGradient(currentStreak)
              )}
              animate={{ 
                scale: currentStreak > 0 ? [1, 1.1, 1] : 1,
              }}
              transition={{ 
                repeat: currentStreak > 0 ? Infinity : 0,
                duration: 2,
              }}
            >
              <Flame size={32} className="text-white fill-current" />
            </motion.div>
            <div>
              <h3 className="text-2xl font-bold text-foreground">
                {currentStreak === 0 ? '—' : currentStreak}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentStreak === 1 ? 'день подряд' : 'дней подряд'}
              </p>
            </div>
          </div>

          {/* Longest Streak Badge */}
          {longestStreak > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-amber-500">
                <Trophy size={16} />
                <span className="text-lg font-semibold">{longestStreak}</span>
              </div>
              <p className="text-xs text-muted-foreground">рекорд</p>
            </div>
          )}
        </div>

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 p-4 rounded-lg bg-muted/50"
        >
          <p className="text-sm text-center font-medium text-foreground">
            {getMotivationalMessage(currentStreak)}
          </p>
        </motion.div>

        {/* Progress to Next Milestone */}
        {nextMilestone && currentStreak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-orange-500" />
                <span className="text-muted-foreground">Следующая цель:</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span>{nextMilestone.emoji}</span>
                <span>{nextMilestone.title}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{currentStreak} дней</span>
                <span className="font-medium text-orange-500">
                  Осталось {daysRemaining} {daysRemaining === 1 ? 'день' : 'дней'}
                </span>
                <span>{nextMilestone.days} дней</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Milestones Grid */}
        {currentStreak > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 pt-6 border-t border-border"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Вехи достижений</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STREAK_MILESTONES.filter(m => m.days <= 30).map((milestone) => {
                const achieved = currentStreak >= milestone.days;
                return (
                  <motion.div
                    key={milestone.days}
                    whileHover={{ scale: achieved ? 1.05 : 1 }}
                    className={cn(
                      'p-3 rounded-lg text-center transition-all',
                      achieved
                        ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg'
                        : 'bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <div className="text-2xl mb-1">{milestone.emoji}</div>
                    <div className="text-xs font-semibold">{milestone.days}</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Total Votes Counter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-center text-sm text-muted-foreground"
        >
          Всего голосований: <span className="font-semibold text-foreground">{totalVotes}</span>
        </motion.div>
      </motion.div>
    </>
  );
};
