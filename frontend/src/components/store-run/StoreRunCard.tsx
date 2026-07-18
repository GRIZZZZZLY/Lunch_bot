import React from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { ShoppingBag, Clock, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountdownTimer } from '@/hooks/useCountdownTimer';
import type { StoreRunListItem } from '@/services/store-run.service';

export interface StoreRunCardProps {
  run: StoreRunListItem;
  currentUserId?: number;
}

export const StoreRunCard: React.FC<StoreRunCardProps> = ({ run, currentUserId }) => {
  const navigate = useNavigate();
  const isInitiator = currentUserId === run.initiatorId;
  const itemsCount = run.items?.length ?? 0;

  // Countdown only for COLLECTING runs
  const timer = useCountdownTimer(run.collectUntil);
  const isCollecting = run.status === 'COLLECTING' && !timer.isExpired;
  const isShopping = run.status === 'SHOPPING' || (run.status === 'COLLECTING' && timer.isExpired);

  const handleClick = () => {
    navigate(`/store-run/${run.id}`);
  };

  const initiatorName = run.initiator?.firstName ?? 'Участник';
  const statusLabel = isCollecting
    ? `Сбор до ${timer.formattedTime}`
    : isShopping
    ? 'В магазине'
    : run.status === 'SETTLED'
    ? 'Завершён'
    : 'Отменён';

  const statusTone = isCollecting
    ? 'text-primary'
    : isShopping
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground';

  return (
    <m.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={cn(
        'relative w-full rounded-2xl border bg-card p-4 text-left transition-all',
        'border-mint-500/28 hover:border-mint-500/45',
        'shadow-[0_8px_20px_rgba(16,185,129,0.08)] hover:shadow-[0_12px_26px_rgba(16,185,129,0.12)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-mint-500/12 p-2.5 ring-1 ring-mint-500/15">
            <ShoppingBag className="h-5 w-5 text-mint-600 dark:text-mint-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {isInitiator ? 'Ты идёшь в ' : `${initiatorName} в `}
              «{run.storeName}»
            </p>
            <div className={cn('mt-0.5 flex items-center gap-1.5 text-sm', statusTone)}>
              <Clock className="h-3.5 w-3.5" />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>

        {itemsCount > 0 && !isInitiator && (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">
            <ShoppingCart className="h-3 w-3" />
            {itemsCount}
          </div>
        )}
      </div>
    </m.button>
  );
};
