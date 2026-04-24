import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { ThemeToggle } from '../ui/theme-toggle';
import { TYPOGRAPHY_H2, TYPOGRAPHY_SMALL } from '@/lib/typography';
import { cn } from '@/lib/utils';

interface HomeHeroCardProps {
  greeting: string;
  message: string;
  currentStreak?: number;
  user?: {
    id?: number;
    firstName?: string;
    lastName?: string | null;
  } | null;
  onAvatarClick: () => void;
}

/**
 * Компактное приветствие на главной странице (~60px)
 * Формат: [Аватар] Приветствие • Контекст
 */
export const HomeHeroCard: React.FC<HomeHeroCardProps> = ({
  greeting,
  message,
  currentStreak = 0,
  user,
  onAvatarClick,
}) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
    className={cn(
      'rounded-2xl border border-border/70 bg-card/98 shadow-[0_8px_20px_rgba(33,24,13,0.06)]',
      'dark:shadow-[0_10px_28px_rgba(0,0,0,0.2)]'
    )}
  >
    <div className='flex items-center justify-between gap-4 px-4 py-3'>
      <div className='flex min-w-0 flex-1 items-center gap-4'>
        <div className='min-w-0'>
          <h1 className={cn('truncate text-foreground text-2xl font-bold tracking-tight leading-snug')}>
            {greeting}
          </h1>
          {message ? (
            <p className={cn('mt-1 text-foreground/70 dark:text-muted-foreground', TYPOGRAPHY_SMALL.className)}>
              {message}
            </p>
          ) : null}
        </div>
      </div>

      <div className='flex flex-shrink-0 items-center gap-2'>
        <ThemeToggle variant='ghost' size='sm' />
        <div className='flex flex-col items-center gap-1'>
          <div className='cursor-pointer' onClick={onAvatarClick}>
            <UserAvatar
              userId={user?.id}
              firstName={user?.firstName || 'User'}
              lastName={user?.lastName || undefined}
              size='md'
              className='ring-2 ring-primary/20'
            />
          </div>
          {currentStreak > 0 && (
            <div className='inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary'>
              <Flame className='size-3.5 fill-current' />
              <span>{currentStreak} дн.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);
