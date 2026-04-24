import { motion } from 'framer-motion';
import { useBudgetWidget } from '../../hooks/useBudgetWidget';
import { PastelCard, CardContent, CardHeader, CardTitle } from '../ui/pastel-card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  ArrowRight,
  Crown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useHaptic } from '../../hooks/useHaptic';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '../../services/budget.service';
import { toast } from 'sonner';
import { ICON_SIZES } from '@/lib/design-tokens';

interface BudgetWidgetCompactProps {
  onViewAll?: () => void; // Callback для перехода на полную страницу бюджета
}

/**
 * BudgetWidgetCompact - компактная версия виджета бюджета для вкладки "Моё"
 * Показывает краткую сводку долгов/кредитов с quick actions
 */
export const BudgetWidgetCompact = ({
  onViewAll,
}: BudgetWidgetCompactProps) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  const { 
    scenario, 
    currentDebt, 
    otherDebts, 
    credits, 
    totalDebts, 
    totalCredits 
  } = useBudgetWidget();
  
  // Combine all debts for display
  const allDebts = currentDebt ? [currentDebt, ...otherDebts] : otherDebts;

  // Mutation для отметки оплаты
  const markAsPaidMutation = useMutation({
    mutationFn: (transactionId: number) => budgetService.markAsPaid(transactionId),
    onSuccess: () => {
      haptic.success();
      toast.success('Оплата отмечена!');
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка отметки');
    },
  });

  // Пустое состояние - показываем позитивное сообщение
  if (scenario === 'hidden' || (!allDebts?.length && !credits?.length)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <PastelCard variant="sage">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className={`${ICON_SIZES.sm} text-primary`} />
              Бюджет
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Empty State - Positive Message */}
            <div className="text-center py-6">
              <div className="mb-4">
                <CheckCircle2 className={`${ICON_SIZES['2xl']} text-green-500 mx-auto`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Всё оплачено! 🎉
              </h3>
              <p className="text-sm text-muted-foreground">
                Нет активных финансовых обязательств
              </p>
            </div>
          </CardContent>
        </PastelCard>
      </motion.div>
    );
  }

  // Иконки для разных статусов
  const getStatusIcon = () => {
    switch (scenario) {
      case 'urgent-debt':
        return <AlertCircle className={`${ICON_SIZES.sm} text-red-500`} />;
      case 'waiting-confirmation':
        return <CheckCircle2 className={`${ICON_SIZES.sm} text-yellow-500`} />;
      case 'success-message':
        return <CheckCircle2 className={`${ICON_SIZES.sm} text-green-500`} />;
      case 'responsible-view':
        return <Crown className={`${ICON_SIZES.sm} text-primary`} />;
      default:
        return <Wallet className={`${ICON_SIZES.sm} text-primary`} />;
    }
  };

  // Получаем первый долг (если есть)
  const firstDebt = allDebts?.[0];
  const firstCredit = credits?.[0];

  const handleMarkAsPaid = () => {
    if (firstDebt) {
      haptic.impact();
      markAsPaidMutation.mutate(firstDebt.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <PastelCard variant="default">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {getStatusIcon()}
              Финансы
            </CardTitle>
            
            {scenario === 'urgent-debt' && (
              <Badge variant="destructive" className="text-xs">
                Новое
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            {/* Debts */}
            {totalDebts > 0 && (
              <div className={cn(
                "p-3 rounded-lg",
                "bg-red-500/10 border border-red-500/20"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className={`${ICON_SIZES.xs} .5 text-red-500`} />
                  <span className="text-xs text-muted-foreground">Я должен</span>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {totalDebts}₽
                </p>
                {allDebts.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {allDebts.length} транз.
                  </p>
                )}
              </div>
            )}

            {/* Credits */}
            {totalCredits > 0 && (
              <div className={cn(
                "p-3 rounded-lg",
                "bg-green-500/10 border border-green-500/20"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className={`${ICON_SIZES.xs} .5 text-green-500`} />
                  <span className="text-xs text-muted-foreground">Должны мне</span>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {totalCredits}₽
                </p>
                {credits.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {credits.length} транз.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions for urgent debt */}
          {scenario === 'urgent-debt' && firstDebt && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Должен: {firstDebt.toUser?.firstName || 'N/A'}
                </span>
                <span className="font-semibold">{firstDebt.amount}₽</span>
              </div>
              
              <Button
                size="sm"
                className="w-full"
                onClick={handleMarkAsPaid}
                disabled={markAsPaidMutation.isPending}
              >
                <CheckCircle2 className={`${ICON_SIZES.sm} mr-2`} />
                Отметить оплату
              </Button>
            </div>
          )}

          {/* Success message */}
          {scenario === 'success-message' && (
            <div className={cn(
              "p-3 rounded-lg text-center",
              "bg-green-500/10 border border-green-500/20"
            )}>
              <CheckCircle2 className={`${ICON_SIZES.xl} text-green-500 mx-auto mb-2`} />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Оплата подтверждена! 🎉
              </p>
            </div>
          )}

          {/* Responsible view */}
          {scenario === 'responsible-view' && firstCredit && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Вам должен: {firstCredit.fromUser?.firstName || 'N/A'}
                </span>
                <span className="font-semibold">{firstCredit.amount}₽</span>
              </div>
              
              <Badge variant="secondary" className="w-full justify-center">
                Ожидание оплаты
              </Badge>
            </div>
          )}

          {/* View All Button */}
          {onViewAll && (allDebts.length > 1 || credits.length > 1) && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                haptic.light();
                onViewAll();
              }}
            >
              Посмотреть все
              <ArrowRight className={`${ICON_SIZES.xs} .5 ml-1`} />
            </Button>
          )}
        </CardContent>
      </PastelCard>
    </motion.div>
  );
};
