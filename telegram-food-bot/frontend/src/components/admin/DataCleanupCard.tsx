import React, { useState } from 'react';
import { Trash2, Database } from 'lucide-react';
import { PastelCard } from '../ui/pastel-card';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { CleanupStats } from '@/services/admin.service';

interface DataCleanupCardProps {
  stats: CleanupStats | null;
  onCleanupPolls: (daysOld: number) => Promise<void>;
  onCleanupTransactions: (daysOld: number) => Promise<void>;
  loading?: boolean;
}

export const DataCleanupCard: React.FC<DataCleanupCardProps> = ({
  stats,
  onCleanupPolls,
  onCleanupTransactions,
  loading = false,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCleanup = async (type: 'polls' | 'transactions', days: number) => {
    const message = type === 'polls' 
      ? `Удалить голосования старше ${days} дней?`
      : `Удалить транзакции старше ${days} дней?`;
    
    if (!confirm(message)) return;

    setActionLoading(`${type}-${days}`);
    try {
      if (type === 'polls') {
        await onCleanupPolls(days);
      } else {
        await onCleanupTransactions(days);
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <PastelCard variant="default" className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-coral-500/12 p-2 text-coral-600 dark:text-coral-400">
          <Database className={cn(ICON_SIZES.md)} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            Очистка данных
          </h3>
          <p className="text-sm text-muted-foreground">
            Удаление старых записей
          </p>
        </div>
      </div>

      {stats && (
        <div className="space-y-4">
          <div className="rounded-xl border border-coral-500/20 bg-coral-500/8 p-3 text-sm text-foreground">
            <div className="font-medium text-coral-700 dark:text-coral-300">Danger zone</div>
            <div className="mt-1 text-muted-foreground">Используйте очистку только для старых архивных данных. Эти действия необратимы.</div>
          </div>
          {/* Polls */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            <div className="mb-2 text-sm font-medium text-foreground">
              Завершённые голосования
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="font-semibold text-foreground">{stats.oldPolls.count30Days}</div>
                <div className="text-muted-foreground">&gt;30 дней</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{stats.oldPolls.count60Days}</div>
                <div className="text-muted-foreground">&gt;60 дней</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{stats.oldPolls.count90Days}</div>
                <div className="text-muted-foreground">&gt;90 дней</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleCleanup('polls', 30)}
              disabled={loading || actionLoading === 'polls-30'}
              className="w-full text-xs"
            >
              <Trash2 className={cn(ICON_SIZES.sm, "mr-2")} />
              Удалить старше 30 дней
            </Button>
          </div>

          {/* Transactions */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            <div className="mb-2 text-sm font-medium text-foreground">
              Оплаченные транзакции
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="font-semibold text-foreground">{stats.oldTransactions.count30Days}</div>
                <div className="text-muted-foreground">&gt;30 дней</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{stats.oldTransactions.count60Days}</div>
                <div className="text-muted-foreground">&gt;60 дней</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{stats.oldTransactions.count90Days}</div>
                <div className="text-muted-foreground">&gt;90 дней</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleCleanup('transactions', 90)}
              disabled={loading || actionLoading === 'transactions-90'}
              className="w-full text-xs"
            >
              <Trash2 className={cn(ICON_SIZES.sm, "mr-2")} />
              Удалить старше 90 дней
            </Button>
          </div>
        </div>
      )}
    </PastelCard>
  );
};
