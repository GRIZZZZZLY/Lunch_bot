import React from 'react';
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
export const WaitingConfirmationView: React.FC<WaitingConfirmationViewProps> = ({ 
  debt, 
  otherDebts, 
  credits 
}) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  
  // CRITICAL: Защита от undefined значений
  if (!debt) {
    console.error('[WaitingConfirmationView] ❌ debt is undefined!');
    return null;
  }
  
  // Mutation для отмены отметки
  const cancelMarkMutation = useMutation({
    mutationFn: () => budgetService.cancelMark(debt.id),
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
          {debt.toUser.firstName} проверит платеж
        </p>
        
        {debt.paidAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Отмечено {formatRelativeTime(debt.paidAt)}
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
