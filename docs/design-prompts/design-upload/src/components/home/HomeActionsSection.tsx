import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, UserPlus, UtensilsCrossed, History, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface HomeActionsSectionProps {
  showAdminAction: boolean;
  onCreatePoll: () => void;
  onInviteFriend: () => void;
}

interface TileSpec {
  label: string;
  icon: React.FC<{ className?: string }>;
  onClick: () => void;
  tone: 'peach' | 'lavender' | 'butter' | 'mint';
}

const TONE_STYLES: Record<TileSpec['tone'], { border: string; bg: string; icon: string; shadow: string; accent: string }> = {
  peach: {
    border: 'border-peach-500/28 hover:border-peach-500/45',
    bg: 'bg-peach-500/8',
    icon: 'text-peach-600 dark:text-peach-400',
    shadow: 'shadow-[0_8px_20px_rgba(216,106,44,0.08)] hover:shadow-[0_12px_26px_rgba(216,106,44,0.12)]',
    accent: 'bg-peach-500/90',
  },
  lavender: {
    border: 'border-lavender-500/28 hover:border-lavender-500/45',
    bg: 'bg-lavender-500/8',
    icon: 'text-lavender-600 dark:text-lavender-400',
    shadow: 'shadow-[0_8px_20px_rgba(139,92,246,0.08)] hover:shadow-[0_12px_26px_rgba(139,92,246,0.12)]',
    accent: 'bg-lavender-500/90',
  },
  butter: {
    border: 'border-butter-500/28 hover:border-butter-500/45',
    bg: 'bg-butter-500/10',
    icon: 'text-butter-600 dark:text-butter-400',
    shadow: 'shadow-[0_8px_20px_rgba(234,179,8,0.08)] hover:shadow-[0_12px_26px_rgba(234,179,8,0.12)]',
    accent: 'bg-butter-500/90',
  },
  mint: {
    border: 'border-mint-500/28 hover:border-mint-500/45',
    bg: 'bg-mint-500/10',
    icon: 'text-mint-600 dark:text-mint-400',
    shadow: 'shadow-[0_8px_20px_rgba(34,197,94,0.08)] hover:shadow-[0_12px_26px_rgba(34,197,94,0.12)]',
    accent: 'bg-mint-500/90',
  },
};

export const HomeActionsSection: React.FC<HomeActionsSectionProps> = ({
  showAdminAction,
  onCreatePoll,
  onInviteFriend,
}) => {
  const navigate = useNavigate();

  const tiles: TileSpec[] = [
    {
      label: 'Меню',
      icon: UtensilsCrossed,
      onClick: () => navigate('/menu'),
      tone: 'peach',
    },
    {
      label: 'История',
      icon: History,
      onClick: () => navigate('/poll/history'),
      tone: 'butter',
    },
    {
      label: 'Статистика',
      icon: BarChart3,
      onClick: () => navigate('/stats'),
      tone: 'mint',
    },
    {
      label: 'Пригласить',
      icon: UserPlus,
      onClick: onInviteFriend,
      tone: 'lavender',
    },
  ];

  return (
    <div className="space-y-3">
      {showAdminAction && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCreatePoll}
          className="relative w-full rounded-2xl border border-peach-500/28 bg-card p-4 shadow-[0_10px_22px_rgba(216,106,44,0.08)] transition-all hover:border-peach-500/45 hover:shadow-[0_14px_28px_rgba(216,106,44,0.12)]"
        >
          <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-primary/90 dark:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/12 p-2.5 ring-1 ring-primary/10">
                <Sparkles className={cn(ICON_SIZES.lg, 'text-primary')} />
              </div>
              <div className="text-left">
                <p className="text-lg font-semibold text-foreground">Создать голосование</p>
                <p className="text-sm text-foreground/82 dark:text-muted-foreground">Разовое или по расписанию</p>
              </div>
            </div>
          </div>
        </motion.button>
      )}

      {/* 2x2 actions grid — Меню · История · Статистика · Пригласить */}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile, idx) => {
          const Icon = tile.icon;
          const t = TONE_STYLES[tile.tone];
          return (
            <motion.button
              key={tile.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * idx, duration: 0.24, ease: 'easeOut' }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={tile.onClick}
              className={cn(
                'relative w-full rounded-2xl border bg-card p-4 text-left transition-all',
                t.border,
                t.shadow,
              )}
            >
              <div className="flex flex-col items-start gap-3">
                <div className={cn('rounded-xl p-2.5 ring-1 ring-inset ring-border/40', t.bg)}>
                  <Icon className={cn(ICON_SIZES.lg, t.icon)} />
                </div>
                <p className="text-base font-semibold text-foreground">{tile.label}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
