import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface HomeActionsSectionProps {
  showAdminAction: boolean;
  onCreatePoll: () => void;
  onInviteFriend: () => void;
  onAddToGroup: () => void;
}

interface TileSpec {
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  onClick: () => void;
  tone: 'lavender' | 'peach';
}

const TONE_STYLES: Record<TileSpec['tone'], { border: string; bg: string; icon: string; shadow: string }> = {
  lavender: {
    border: 'border-lavender-500/28 hover:border-lavender-500/45',
    bg: 'bg-lavender-500/8',
    icon: 'text-lavender-600 dark:text-lavender-400',
    shadow: 'shadow-[0_8px_20px_rgba(139,92,246,0.08)] hover:shadow-[0_12px_26px_rgba(139,92,246,0.12)]',
  },
  peach: {
    border: 'border-peach-500/28 hover:border-peach-500/45',
    bg: 'bg-peach-500/8',
    icon: 'text-peach-600 dark:text-peach-400',
    shadow: 'shadow-[0_8px_20px_rgba(216,106,44,0.08)] hover:shadow-[0_12px_26px_rgba(216,106,44,0.12)]',
  },
};

export const HomeActionsSection: React.FC<HomeActionsSectionProps> = ({
  showAdminAction,
  onCreatePoll,
  onInviteFriend,
  onAddToGroup,
}) => {
  const tiles: TileSpec[] = [
    {
      label: 'Пригласить',
      description: 'Зовите коллег',
      icon: UserPlus,
      onClick: onInviteFriend,
      tone: 'lavender',
    },
    {
      label: 'В новую группу',
      description: 'Добавить бота',
      icon: Users,
      onClick: onAddToGroup,
      tone: 'peach',
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

      {/* Social pair — Пригласить · В новую группу */}
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
                <div>
                  <p className="text-base font-semibold text-foreground">{tile.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tile.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
