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

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Settings, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { recurringPollService, RecurringPoll } from '@/services/recurring-poll.service';
import { ICON_SIZES } from '@/lib/design-tokens';
import { useIsGroupAdmin } from '@/hooks/useIsGroupAdmin';

interface RecurringPollBadgeProps {
  groupId: number | undefined;
  className?: string;
  onClick?: () => void;
}

export const RecurringPollBadge = ({
  groupId,
  className,
  onClick,
}: RecurringPollBadgeProps) => {
  const isAdmin = useIsGroupAdmin();
  const [schedule, setSchedule] = useState<RecurringPoll | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
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
  }, [groupId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  if (loading || !schedule) {
    return null;
  }

  if (!schedule.isEnabled) {
    return null; // Не показываем если выключено
  }

  const scheduleText = recurringPollService.formatSchedule(schedule);
  const nextRunText = recurringPollService.getNextRunInfo(schedule);
  const adminCardClassName = cn(
    'group relative w-full overflow-hidden rounded-[28px] border border-lavender-500/32',
    'bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,244,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(39,31,58,0.96),rgba(27,22,41,0.98))]',
    'px-4 py-4 text-left shadow-[0_16px_30px_rgba(139,92,246,0.12)] transition-all duration-300',
    'hover:-translate-y-0.5 hover:border-lavender-500/45 hover:shadow-[0_18px_34px_rgba(139,92,246,0.18)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    className
  );
  const userCardClassName = cn(
    'relative w-full overflow-hidden rounded-[24px] border border-border/70 bg-card/96 p-4 shadow-sm dark:shadow-[0_10px_22px_rgba(0,0,0,0.18)]',
    className
  );

  return (
    <AnimatePresence>
      {isAdmin ? (
        <motion.button
          type='button'
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={adminCardClassName}
          onClick={onClick}
          data-testid='recurring-poll-card'
        >
          <div
            data-testid='recurring-poll-accent'
            className='absolute inset-y-3 left-0 w-1 rounded-r-full bg-lavender-500/90'
          />
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_42%)] opacity-80' />
          <div className='relative flex items-center justify-between gap-3'>
            <div className='flex items-start gap-3'>
              <div
                data-testid='recurring-poll-icon-shell'
                className='rounded-2xl bg-lavender-500/12 p-3 ring-1 ring-lavender-500/12 dark:bg-lavender-500/14 dark:ring-lavender-400/14'
              >
                <Settings className={`${ICON_SIZES.lg} text-lavender-500`} />
              </div>

              <div className='min-w-0 text-left'>
                <p className='text-[17px] font-semibold leading-6 text-foreground'>
                  Настроить голосование
                </p>
                <div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/76 dark:text-muted-foreground'>
                  <div className='flex items-center gap-1.5'>
                    <Calendar className={ICON_SIZES.xs} />
                    <span>{scheduleText}</span>
                  </div>
                  <div className='flex items-center gap-1.5 font-medium text-lavender-600 dark:text-lavender-400'>
                    <Clock className={ICON_SIZES.xs} />
                    <span>{nextRunText}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender-500/10 text-lavender-500 transition-transform duration-300 group-hover:translate-x-0.5'>
              <ChevronRight className={ICON_SIZES.md} />
            </div>
          </div>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={userCardClassName}
        >
          <div className='flex items-center gap-3'>
            <div className='size-10 rounded-full bg-primary/10 dark:bg-primary/8 flex items-center justify-center flex-shrink-0'>
              <Calendar className={`${ICON_SIZES.md} text-primary`} />
            </div>

            <div className='flex-1 min-w-0'>
              <p className='text-sm font-semibold text-foreground'>Расписание голосований</p>
              <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/82 dark:text-muted-foreground'>
                <div className='flex items-center gap-1'>
                  <Calendar className={ICON_SIZES.xs} />
                  <span>{scheduleText}</span>
                </div>
                <div className='flex items-center gap-1 font-semibold text-primary'>
                  <Clock className={ICON_SIZES.xs} />
                  <span>{nextRunText}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
