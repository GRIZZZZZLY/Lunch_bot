import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Bell, Check, AlertCircle } from 'lucide-react';
import { PastelCard } from '../ui/pastel-card';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { DebtorInfo, DebtStats } from '@/services/admin.service';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DebtManagementCardProps {
  debtors: DebtorInfo[];
  stats: DebtStats | null;
  onForgiveDebt: (debtId: number) => Promise<void>;
  onRemindDebtor: (debtId: number) => Promise<void>;
  onRemindAll: () => Promise<void>;
  loading?: boolean;
}

export const DebtManagementCard: React.FC<DebtManagementCardProps> = ({
  debtors,
  stats,
  onForgiveDebt,
  onRemindDebtor,
  onRemindAll,
  loading = false,
}) => {
  const [expandedDebtor, setExpandedDebtor] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleForgiveDebt = async (debtId: number) => {
    if (!confirm('Вы уверены, что хотите списать этот долг?')) return;
    
    setActionLoading(debtId);
    try {
      await onForgiveDebt(debtId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemindDebtor = async (debtId: number) => {
    setActionLoading(debtId);
    try {
      await onRemindDebtor(debtId);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Статистика */}
      {stats && (
        <PastelCard variant="default" className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-semibold text-foreground">
                {stats.totalDebtors}
              </div>
              <div className="text-xs text-muted-foreground">
                Всего должников
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-coral-600 dark:text-coral-400">
                {stats.totalDebtAmount.toFixed(2)}₽
              </div>
              <div className="text-xs text-muted-foreground">
                Общая задолженность
              </div>
            </div>
          </div>

          <Button
            size="sm"
            onClick={onRemindAll}
            disabled={loading}
            variant="outline"
            className="w-full mt-3"
          >
            <Bell className={cn(ICON_SIZES.sm, "mr-2")} />
            Напомнить всем ({stats.totalDebtors})
          </Button>
        </PastelCard>
      )}

      {/* Список должников */}
      <PastelCard variant="default" className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-coral-500/12 p-2 text-coral-600 dark:text-coral-400">
            <DollarSign className={cn(ICON_SIZES.md)} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Список должников
            </h3>
            <p className="text-sm text-muted-foreground">
              Активные долги
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {debtors.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Check className={cn(ICON_SIZES.xl, "mx-auto mb-2 opacity-50")} />
                <p className="text-sm">Нет активных должников</p>
            </div>
          ) : (
            debtors.map((debtor, index) => (
              <motion.div
                key={debtor.userId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-border/70 bg-card/72 p-3 transition-colors hover:bg-muted/35"
              >
                <div 
                  className="cursor-pointer"
                  onClick={() => setExpandedDebtor(expandedDebtor === debtor.userId ? null : debtor.userId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                        <span className="font-medium text-foreground">
                          {debtor.userName}
                        </span>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Долгов: {debtor.debtCount}</span>
                          {debtor.oldestDebt && (
                            <span className="flex items-center gap-1 text-coral-500">
                              <AlertCircle className={ICON_SIZES.xs} />
                              {formatDistanceToNow(new Date(debtor.oldestDebt), { addSuffix: true, locale: ru })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-semibold text-coral-600 dark:text-coral-400">
                          {debtor.totalDebt.toFixed(2)}₽
                        </div>
                    </div>
                  </div>
                </div>

                {expandedDebtor === debtor.userId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 space-y-2 border-t border-border/70 pt-3"
                  >
                    {debtor.debts.map((debt) => (
                      <div
                        key={debt.id}
                          className="rounded-lg border border-border/60 bg-muted/35 p-2 text-xs"
                       >
                        <div className="flex items-center justify-between mb-2">
                          <span>
                            Кредитор: {debt.toUser.firstName}
                          </span>
                          <span className="font-bold">
                            {debt.amount.toFixed(2)}₽
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemindDebtor(debt.id)}
                            disabled={actionLoading === debt.id}
                            className="flex-1 text-xs h-7"
                          >
                            <Bell className={cn(ICON_SIZES.xs, "mr-1")} />
                            Напомнить
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleForgiveDebt(debt.id)}
                            disabled={actionLoading === debt.id}
                            className="flex-1 text-xs h-7"
                          >
                            Списать
                          </Button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </PastelCard>
    </div>
  );
};
