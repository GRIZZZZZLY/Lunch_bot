import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Bell, CheckCircle, X, User } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface ResponsibleViewProps {
  credits: Transaction[];
  otherDebts: Transaction[];
}

/**
 * Сценарий 5: Пользователь - ответственный (показываем кто должен)
 */
export const ResponsibleView: React.FC<ResponsibleViewProps> = ({ credits, otherDebts }) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  
  // CRITICAL: Защита от undefined/null значений
  if (!credits || !Array.isArray(credits) || credits.length === 0) {
    console.error('[ResponsibleView] ❌ credits is invalid:', credits);
    return null;
  }
  
  // Фильтруем только текущие кредиты (по последнему poll)
  const currentPollId = credits[0]?.pollId;
  const currentCredits = credits.filter(c => c?.pollId === currentPollId);
  
  // Рассчитываем суммы
  const totalToReceive = currentCredits.reduce((sum, c) => sum + c.amount, 0);
  const myShare = currentCredits[0]?.amount || 0; // Предполагаем что ответственный тоже заказывал
  const totalPaid = currentCredits[0]?.poll ? 0 : 0; // TODO: нужно знать общую сумму заказа
  
  // Mutation для подтверждения платежа
  const confirmMutation = useMutation({
    mutationFn: (transactionId: number) => budgetService.confirmPayment(transactionId),
    onSuccess: () => {
      haptic.success();
      toast.success('Платеж подтвержден!');
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка подтверждения');
    },
  });
  
  const handleConfirm = (transactionId: number) => {
    haptic.impact();
    confirmMutation.mutate(transactionId);
  };
  
  const handleRemindAll = () => {
    haptic.impact();
    toast.info('Напоминания отправлены!');
    // TODO: Implement reminder API
  };
  
  return (
    <div className="space-y-4">
      {/* Информация о заказе */}
      <div className="space-y-2 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Вы оплатили:</span>
          <span className="font-bold text-lg">-{totalToReceive + myShare}₽</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">🍽️ Ваша доля:</span>
          <span className="font-medium">{myShare}₽</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">💵 Вернут вам:</span>
          <span className="text-xl font-bold text-green-600 dark:text-green-400">
            +{totalToReceive}₽
          </span>
        </div>
      </div>
      
      {/* Список должников */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">Ожидаются переводы:</span>
        </div>
        
        <div className="space-y-2">
          {currentCredits.map((credit) => (
            <div
              key={credit.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                'bg-muted/50 hover:bg-muted/70 transition-colors'
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <User className="size-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">
                    {credit.fromUser.firstName} {credit.fromUser.lastName || ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {credit.amount}₽
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {credit.status === 'PENDING' && (
                  <Badge variant="secondary" className="text-xs">
                    ⏰ Ожидается
                  </Badge>
                )}
                
                {credit.status === 'PAID' && (
                  <>
                    <Badge variant="default" className="text-xs bg-amber-500">
                      Оплачено
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(credit.id)}
                        disabled={confirmMutation.isPending}
                        className="h-7 px-2 bg-green-500 hover:bg-green-600"
                      >
                        <CheckCircle className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  </>
                )}
                
                {credit.status === 'CONFIRMED' && (
                  <Badge variant="default" className="text-xs bg-green-500">
                    🔔 Подтверждено
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Глобальные действия */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleRemindAll}
          variant="outline"
          size="sm"
        >
          <Bell className="size-4 mr-1.5" />
          Напомнить 🔔
        </Button>
        
        <Button
          onClick={() => {}}
          variant="outline"
          size="sm"
          disabled={currentCredits.some(c => c.status !== 'CONFIRMED')}
        >
          Все оплатили
        </Button>
      </div>
      
      {/* Другие финансы */}
      {otherDebts.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Другие финансы: {otherDebts.length} долгов ({otherDebts.reduce((s, d) => s + d.amount, 0)}₽)
          </div>
          
        </div>
      )}
    </div>
  );
};
