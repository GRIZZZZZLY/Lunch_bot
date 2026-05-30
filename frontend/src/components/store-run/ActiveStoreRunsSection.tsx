import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronRight } from 'lucide-react';
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
          'relative w-full overflow-hidden rounded-[22px] border bg-card p-4 text-left transition-all',
          'border-mint-500/30 hover:border-mint-500/50',
          'shadow-[0_10px_24px_-12px_rgba(34,181,115,0.40)] hover:shadow-[0_14px_30px_-12px_rgba(34,181,115,0.50)]',
        )}
      >
        {/* Тонированный радиальный градиент */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,181,115,0.12),transparent_60%)]" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-mint-500/14 ring-1 ring-mint-500/15">
              <ShoppingBag className="h-5 w-5 text-mint-600 dark:text-mint-400" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-mint-600 dark:text-mint-400">
                Магазин
              </p>
              <p className="text-[17px] font-bold tracking-tight text-foreground">Иду в магазин</p>
              <p className="text-sm text-foreground/82 dark:text-muted-foreground truncate">
                Собрать общий заказ в КБ, Пятёрочку и т.д.
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-mint-600/70 dark:text-mint-400/70" />
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
