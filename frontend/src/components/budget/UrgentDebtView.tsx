import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CreditCard, Phone, Info, CheckCircle } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
import { cn, formatRelativeTime } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface UrgentDebtViewProps {
  debt: Transaction;
  otherDebts: Transaction[];
  credits: Transaction[];
}

/**
 * Сценарий 1: Срочный долг по только что завершенному голосованию
 */
export const UrgentDebtView: React.FC<UrgentDebtViewProps> = ({ debt, otherDebts, credits }) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  
  // CRITICAL: Защита от undefined значений
  if (!debt) {
    console.error('[UrgentDebtView] ❌ debt is undefined!');
    return null;
  }
  
  // Mutation для отметки оплаты
  const markAsPaidMutation = useMutation({
    mutationFn: () => budgetService.markAsPaid(debt.id),
    onSuccess: () => {
      haptic.success();
      toast.success('Оплата отмечена! Ждем подтверждения');
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка отметки оплаты');
    },
  });
  
  const handleMarkAsPaid = () => {
    haptic.impact();
    markAsPaidMutation.mutate();
  };
  
  const handleOpenSBP = () => {
    haptic.impact();
    
    if (!debt.toUser.paymentPhone) {
      toast.error('Номер телефона не указан');
      return;
    }
    
    budgetService.openSBP(debt.toUser.paymentPhone, debt.amount);
  };
  
  // Маскирование номера карты
  const maskCard = (card: string | null) => {
    if (!card) return 'Не указана';
    const cleaned = card.replace(/\D/g, '');
    if (cleaned.length < 4) return card;
    return `**** ${cleaned.slice(-4)}`;
  };
  
  // Форматирование телефона
  const formatPhone = (phone: string | null) => {
    if (!phone) return 'Не указан';
    return phone;
  };
  
  return (
    <div className="space-y-4">
      {/* Информация о заказе */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ваш заказ:</span>
          <span className="font-medium">{debt.menuItem?.name || 'Блюдо'}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">К оплате:</span>
          <span className="text-2xl font-bold text-coral-500 dark:text-coral-300">
            {debt.amount}₽
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">👤 Ответственный:</span>
          <span className="font-medium">
            {debt.toUser.firstName} {debt.toUser.lastName || ''}
          </span>
        </div>
      </div>
      
      {/* Реквизиты для оплаты */}
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <Info className={ICON_SIZES.sm} />
          <span>Реквизиты для оплаты:</span>
        </div>
        
        <div className="space-y-1.5 text-sm">
          {debt.toUser.paymentCard && (
            <div className="flex items-center gap-2">
              <CreditCard className={`${ICON_SIZES.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">Карта:</span>
              <span className="font-mono">{maskCard(debt.toUser.paymentCard)}</span>
            </div>
          )}
          
          {debt.toUser.paymentPhone && (
            <div className="flex items-center gap-2">
              <Phone className={`${ICON_SIZES.sm} text-muted-foreground`} />
              <span className="text-muted-foreground">Телефон:</span>
              <span className="font-mono">{formatPhone(debt.toUser.paymentPhone)}</span>
            </div>
          )}
          
          {debt.toUser.paymentDetails && (
            <div className="text-xs text-muted-foreground mt-2">
              {debt.toUser.paymentDetails}
            </div>
          )}
          
          {!debt.toUser.paymentCard && !debt.toUser.paymentPhone && (
            <div className="text-xs text-muted-foreground">
              Реквизиты не указаны. Свяжитесь с ответственным.
            </div>
          )}
        </div>
      </div>
      
      {/* Кнопки действий */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleMarkAsPaid}
          disabled={markAsPaidMutation.isPending}
          variant="success"
        >
          <CheckCircle className={`${ICON_SIZES.sm} mr-1.5`} />
          {markAsPaidMutation.isPending ? 'Отмечаю...' : 'Оплатил(а)'}
        </Button>
        
        {debt.toUser.paymentPhone && (
          <Button
            onClick={handleOpenSBP}
            variant="outline"
            className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <CreditCard className={`${ICON_SIZES.sm} mr-1.5`} />
            Открыть СБП
          </Button>
        )}
      </div>
      
      {/* Другие долги/кредиты - компактно */}
      {(otherDebts.length > 0 || credits.length > 0) && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium mb-2">Также:</div>
            {otherDebts.length > 0 && (
              <div>• {otherDebts.length} старых долга ({otherDebts.reduce((s, d) => s + d.amount, 0)}₽)</div>
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
