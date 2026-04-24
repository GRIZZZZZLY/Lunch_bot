import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveStoreRuns } from '@/hooks/queries/useStoreRunQueries';
import { CreateStoreRunSheet } from './CreateStoreRunSheet';
import { StoreRunCard } from './StoreRunCard';
import { useTelegram } from '@/hooks/useTelegram';

export interface ActiveStoreRunsSectionProps {
  /** Group to use when initiating a new run. Usually user's primary group. */
  groupId: number | null;
  /** Current user id, used to distinguish initiator-own cards. */
  currentUserId?: number;
}

export const ActiveStoreRunsSection: React.FC<ActiveStoreRunsSectionProps> = ({
  groupId,
  currentUserId,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();
  const { data: runs = [], isLoading } = useActiveStoreRuns();

  const handleOpenSheet = () => {
    hapticFeedback?.impactOccurred?.('light');
    setSheetOpen(true);
  };

  const handleCreated = (storeRunId: number) => {
    navigate(`/store-run/${storeRunId}`);
  };

  return (
    <div className="space-y-3">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleOpenSheet}
        className={cn(
          'relative w-full rounded-2xl border bg-card p-4 text-left transition-all',
          'border-mint-500/28 hover:border-mint-500/45',
          'shadow-[0_10px_22px_rgba(16,185,129,0.08)] hover:shadow-[0_14px_28px_rgba(16,185,129,0.12)]',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-500/12 p-2.5 ring-1 ring-mint-500/15">
              <ShoppingBag className="h-5 w-5 text-mint-600 dark:text-mint-400" />
            </div>
            <div className="text-left">
              <p className="text-lg font-semibold text-foreground">Иду в магазин</p>
              <p className="text-sm text-foreground/82 dark:text-muted-foreground">
                Собрать общий заказ в КБ, Пятёрочку и т.д.
              </p>
            </div>
          </div>
        </div>
      </motion.button>

      {runs.length > 0 && !isLoading && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Активные забеги
          </p>
          {runs.map((run) => (
            <StoreRunCard key={run.id} run={run} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      <CreateStoreRunSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        groupId={groupId}
        onCreated={handleCreated}
      />
    </div>
  );
};
