/**
 * RecurringPollBadge - Индикатор активного расписания на главной странице
 * 
 * Показывает:
 * - Статус (включено/выключено)
 * - Время следующего запуска
 * - Быстрые действия
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Calendar, Clock, Settings, ChevronRight } from 'lucide-react';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { cn } from '@/lib/utils';
import { recurringPollService, RecurringPoll } from '@/services/recurring-poll.service';
import { ICON_SIZES } from '@/lib/design-tokens';

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
        <PastelCard
          variant="lavender"
          className={cn(
            'cursor-pointer hover:border-pastel-lavender-500',
            'transition-all duration-200'
          )}
          onClick={onClick}
        >
          <CardContent className="p-4 pt-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="size-10 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <RotateCcw className={`${ICON_SIZES.md} text-purple-500 animate-pulse`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    🔄 Автоматические голосования
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className={ICON_SIZES.xs} />
                    <span>{scheduleText}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className={ICON_SIZES.xs} />
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {nextRunText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              {onClick && (
                <ChevronRight className={`${ICON_SIZES.md} text-muted-foreground flex-shrink-0`} />
              )}
            </div>
          </CardContent>
        </PastelCard>
      </motion.div>
    </AnimatePresence>
  );
};
