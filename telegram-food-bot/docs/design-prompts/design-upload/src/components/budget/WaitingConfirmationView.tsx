import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Clock, X } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
import { formatRelativeTime } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface WaitingConfirmationViewProps {
  debt: Transaction;
  otherDebts: Transaction[];
  credits: Transaction[];
}

/**
 * Сценарий 2: Долг оплачен, ждем подтверждения от ответственного
 */
export const WaitingConfirmationView = ({ 
  debt, 
  otherDebts, 
  credits 
}: WaitingConfirmationViewProps) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  const debtId = debt?.id ?? 0;
  
  // Mutation для отмены отметки
  const cancelMarkMutation = useMutation({
    mutationFn: () => budgetService.cancelMark(debtId),
    onSuccess: () => {
      haptic.success();
      toast.success('Отметка оплаты отменена');
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка отмены');
    },
  });
  
  const handleCancelMark = () => {
    haptic.impact();
    cancelMarkMutation.mutate();
  };
  
  const safeFormatRelativeTime = (value?: string | Date | null): string => {
    if (!value) return '—';
    const dateValue = typeof value === 'string' ? new Date(value) : value;

    if (Number.isNaN(dateValue.getTime())) return '—';

    return formatRelativeTime(dateValue);
  };

  if (!debt) {
    console.error('[WaitingConfirmationView] ❌ debt is undefined!');
    return null;
  }

  const userName = [debt.toUser?.firstName, debt.toUser?.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-4">
      {/* Статус */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
          <Clock className={`${ICON_SIZES.xl} text-amber-600 dark:text-amber-400`} />
        </div>
        
        <p className="text-sm text-muted-foreground mb-1">
          Вы отметили оплату
        </p>
        <h4 className="font-semibold text-lg mb-2">
          {debt.menuItem?.name || 'Блюдо'} — {debt.amount}₽
        </h4>
        <p className="text-sm text-muted-foreground">
          {userName || 'Ответственный'} проверит платеж
        </p>
        
        {debt.paidAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Отмечено {safeFormatRelativeTime(debt.paidAt)}
          </p>
        )}
      </div>
      
      {/* Кнопка отмены */}
      <Button
        onClick={handleCancelMark}
        disabled={cancelMarkMutation.isPending}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <X className={`${ICON_SIZES.sm} mr-1.5`} />
        {cancelMarkMutation.isPending ? 'Отменяю...' : 'Отменить отметку'}
      </Button>
      
      {/* Другие финансы */}
      {(otherDebts.length > 0 || credits.length > 0) && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium mb-2">⚡ Другие финансы:</div>
            {otherDebts.length > 0 && (
              <div>• {otherDebts.length} долгов ({otherDebts.reduce((s, d) => s + d.amount, 0)}₽)</div>
            )}
            {credits.length > 0 && (
              <div>• Вам должны: {credits.reduce((s, c) => s + c.amount, 0)}₽</div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
};
