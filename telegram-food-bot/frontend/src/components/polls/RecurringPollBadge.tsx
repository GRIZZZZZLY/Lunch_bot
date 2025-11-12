/**
 * RecurringPollBadge - Индикатор активного расписания на главной странице
 * 
 * Показывает:
 * - Статус (включено/выключено)
 * - Время следующего запуска
 * - Быстрые действия
 * 
 * Для админов: кликабельная кнопка с лавандовым glow
 * Для юзеров: информационный badge без взаимодействия
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Calendar, Clock, Settings, ChevronRight } from 'lucide-react';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { cn } from '@/lib/utils';
import { recurringPollService, RecurringPoll } from '@/services/recurring-poll.service';
import { ICON_SIZES } from '@/lib/design-tokens';
import { useAuth } from '@/hooks/useAuth';

interface RecurringPollBadgeProps {
  groupId: number | undefined;
  className?: string;
  onClick?: () => void;
}

export const RecurringPollBadge: React.FC<RecurringPollBadgeProps> = ({
  groupId,
  className,
  onClick,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const [schedule, setSchedule] = useState<RecurringPoll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, [groupId]);

  const loadSchedule = async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await recurringPollService.getGroupSchedule(groupId);

      if (response.success && response.data) {
        setSchedule(response.data);
      } else {
        setSchedule(null);
      }
    } catch (error) {
      console.error('[RecurringPollBadge] Error loading schedule:', error);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !schedule) {
    return null;
  }

  if (!schedule.isEnabled) {
    return null; // Не показываем если выключено
  }

  const scheduleText = recurringPollService.formatSchedule(schedule);
  const nextRunText = recurringPollService.getNextRunInfo(schedule);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn('w-full', className)}
      >
        <div
          className={cn(
            'rounded-xl p-4 border-2 transition-all duration-300',
            // Фон: как у карточки с результатами голосования
            'bg-white dark:bg-gray-800',
            // Для админа: лавандовая обводка + glow + курсор
            isAdmin && [
              'border-pastel-lavender-400',
              'shadow-[0_0_15px_rgba(196,181,253,0.4)]',
              'hover:shadow-[0_0_25px_rgba(196,181,253,0.6)]',
              'cursor-pointer',
              'hover:border-pastel-lavender-500',
            ],
            // Для юзера: нейтральная обводка без glow
            !isAdmin && [
              'border-gray-700/50',
              'cursor-default',
            ]
          )}
          onClick={isAdmin ? onClick : undefined}
        >
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className={cn(
              "size-10 rounded-full flex items-center justify-center flex-shrink-0",
              isAdmin 
                ? "bg-gradient-to-br from-pastel-lavender-500/30 to-pastel-lavender-600/30"
                : "bg-gray-700/50"
            )}>
              {isAdmin ? (
                <Settings className={`${ICON_SIZES.md} text-pastel-lavender-400`} />
              ) : (
                <Calendar className={`${ICON_SIZES.md} text-gray-400`} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className={cn(
                  "text-sm font-semibold",
                  isAdmin 
                    ? "text-pastel-lavender-400" 
                    : "text-gray-300"
                )}>
                  {isAdmin ? 'Настроить голосование' : 'Расписание голосований'}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className={ICON_SIZES.xs} />
                  <span>{scheduleText}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className={ICON_SIZES.xs} />
                  <span className={cn(
                    "font-medium",
                    isAdmin ? "text-pastel-lavender-400" : "text-gray-400"
                  )}>
                    {nextRunText}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow - только для админа */}
            {isAdmin && onClick && (
              <ChevronRight className={`${ICON_SIZES.md} text-pastel-lavender-400 flex-shrink-0`} />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
