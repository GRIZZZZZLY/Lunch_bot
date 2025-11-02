import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Trophy,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { PollWithDetails } from '../../services/polls.service';
import { ParticipantsList } from './ParticipantsList';
import { ConfettiAnimation } from './ConfettiAnimation';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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

  // Получаем результаты голосования
  const pollResult = poll.results?.[0]; // Берём первый результат из массива
  const votes = poll.votes || [];
  const voteCount = poll._count?.votes || 0;

  // Находим победителя
  const winnerDish = pollResult?.winnerItem;
  const winnerVoteCount = votes.filter(v => v.menuItemId === winnerDish?.id).length;
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

  return (
    <div className={cn('relative', className)}>
      {/* Конфетти при celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            <ConfettiAnimation onComplete={onCelebrationEnd} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration message (3 секунды) */}
      <AnimatePresence mode="wait">
        {showCelebration && winnerDish && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gradient-to-br from-mint-50 via-white to-mint-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl p-8 shadow-xl border border-mint-200 dark:border-gray-700 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="text-6xl mb-4"
            >
              {(winnerDish as any).emoji || '🍽️'}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold bg-gradient-to-r from-mint-600 to-mint-700 bg-clip-text text-transparent dark:from-mint-400 dark:to-mint-500 mb-2"
            >
              🎉 Победитель!
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

        {/* Timeline view (после celebration) */}
        {!showCelebration && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {/* Collapsed header */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full bg-gradient-to-br from-mint-50/50 via-white/80 to-mint-50/50 dark:from-gray-800/50 dark:via-gray-850/80 dark:to-gray-900/50 rounded-xl p-4 shadow-sm border border-mint-100 dark:border-gray-700 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                {/* Left side - Status */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 bg-mint-100 dark:bg-mint-900/30 rounded-full flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-mint-600 dark:text-mint-400" />
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedTime}
                      </span>
                      <span className="text-xs text-mint-600 dark:text-mint-400 font-medium">
                        Голосование завершено
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {winnerDish && (
                        <>
                          <span className="text-sm">{(winnerDish as any).emoji || '🍽️'}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {winnerDish.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({winnerPercentage}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side - Stats and expand button */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{voteCount}</span>
                  </div>

                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </motion.div>
                </div>
              </div>
            </button>

            {/* Expanded results */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                    {/* Winner card */}
                    {winnerDish && (
                      <div className="bg-gradient-to-br from-mint-100 to-mint-50 dark:from-mint-900/30 dark:to-mint-800/20 rounded-lg p-4 border border-mint-200 dark:border-mint-700">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-3xl">{(winnerDish as any).emoji || '🍽️'}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {winnerDish.name}
                              </h4>
                              <Trophy className="w-4 h-4 text-butter-500" />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {winnerVoteCount} {winnerVoteCount === 1 ? 'голос' : winnerVoteCount < 5 ? 'голоса' : 'голосов'} • {winnerPercentage}%
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-mint-600 dark:text-mint-400">
                              {winnerDish.price} ₽
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${winnerPercentage}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="bg-gradient-to-r from-mint-500 to-mint-600 h-2 rounded-full"
                          />
                        </div>
                      </div>
                    )}

                    {/* Participants list */}
                    {participants.length > 0 && (
                      <ParticipantsList
                        participants={participants}
                        userParticipated={true}
                      />
                    )}

                    {/* Responsible person (if assigned) */}
                    {pollResult?.responsible && (
                      <div className="bg-lavender-50 dark:bg-lavender-900/20 rounded-lg p-3 border border-lavender-200 dark:border-lavender-700">
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="w-4 h-4 text-lavender-600 dark:text-lavender-400" />
                          <span className="text-gray-700 dark:text-gray-300">
                            Ответственный:{' '}
                            <strong>
                              {pollResult.responsible.firstName}
                              {pollResult.responsible.lastName && ` ${pollResult.responsible.lastName}`}
                            </strong>
                          </span>
                        </div>
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
