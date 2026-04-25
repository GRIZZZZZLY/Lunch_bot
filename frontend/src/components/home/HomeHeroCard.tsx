import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { ThemeToggle } from '../ui/theme-toggle';
import { TYPOGRAPHY_SMALL } from '@/lib/typography';
import { cn } from '@/lib/utils';
import { TimeColors } from '@/hooks/useTimeBasedGradient';

export type PollStatus = 'none' | 'active' | 'completed' | 'completed-result';

export interface PollMeta {
  time?: string;        // e.g. "11:30" for active end time
  winner?: string;      // e.g. "Борщ"
  responsible?: string; // e.g. "Саша"
}

interface HomeHeroCardProps {
  greeting: string;
  message: string;
  currentStreak?: number;
  user?: { id?: number; firstName?: string; lastName?: string | null } | null;
  onAvatarClick: () => void;
  timeColors?: TimeColors;
  pollStatus?: PollStatus;
  pollMeta?: PollMeta;
}

function PollBadge({ status, meta }: { status: PollStatus; meta: PollMeta }) {
  if (status === 'none') return null;

  const isActive = status === 'active';

  let text = '';
  let bg = '';
  let border = '';
  let color = '';

  if (status === 'active') {
    text = meta.time ? `🗳 Голосование до ${meta.time}` : '🗳 Идёт голосование';
    bg = 'rgba(139,92,246,0.12)';
    border = 'rgba(139,92,246,0.30)';
    color = '#c4b5fd';
  } else if (status === 'completed-result') {
    const parts = ['✅', meta.winner, meta.responsible ? `· Отв: ${meta.responsible}` : ''].filter(Boolean);
    text = parts.join(' ');
    bg = 'rgba(251,146,60,0.12)';
    border = 'rgba(251,146,60,0.28)';
    color = '#fb923c';
  } else {
    // completed
    text = '✅ Голосование завершено';
    bg = 'rgba(92,174,135,0.12)';
    border = 'rgba(92,174,135,0.28)';
    color = '#6ee7b7';
  }

  const badge = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border"
      style={{ background: bg, borderColor: border, color }}
    >
      {text}
    </span>
  );

  if (isActive) {
    return (
      <motion.div
        className="mt-1.5"
        animate={{ scale: [1, 1.04, 1], opacity: [1, 0.85, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {badge}
      </motion.div>
    );
  }

  return <div className="mt-1.5">{badge}</div>;
}

export const HomeHeroCard: React.FC<HomeHeroCardProps> = ({
  greeting,
  message,
  currentStreak = 0,
  user,
  onAvatarClick,
  timeColors,
  pollStatus = 'none',
  pollMeta = {},
}) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
    className="relative overflow-hidden rounded-2xl bg-card border"
    style={{
      borderColor: timeColors?.border ?? 'var(--border)',
      boxShadow: timeColors?.shadow,
    }}
  >
    {/* Time-of-day overlay */}
    {timeColors && (
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: timeColors.overlay }}
      />
    )}

    {/* Shimmer */}
    {timeColors && (
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.05) 50%,transparent 60%)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPositionX: ['0%', '200%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
    )}

    {/* Content */}
    <div className="relative z-10 flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-foreground text-2xl font-bold tracking-tight leading-snug">
            {greeting}
          </h1>
          {message ? (
            <p className={cn('mt-1 text-foreground/70 dark:text-muted-foreground', TYPOGRAPHY_SMALL.className)}>
              {message}
            </p>
          ) : null}
          <PollBadge status={pollStatus} meta={pollMeta} />
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <ThemeToggle variant="ghost" size="sm" />
        <div className="flex flex-col items-center gap-1">
          <div className="cursor-pointer" onClick={onAvatarClick}>
            <UserAvatar
              userId={user?.id}
              firstName={user?.firstName || 'User'}
              lastName={user?.lastName || undefined}
              size="md"
              className="ring-2 ring-primary/20"
            />
          </div>
          {currentStreak > 0 && (
            <div className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Flame className="size-3.5 fill-current" />
              <span>{currentStreak} дн.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);
