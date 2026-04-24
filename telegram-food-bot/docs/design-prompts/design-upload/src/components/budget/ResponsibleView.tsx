import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService, SendRemindersResult } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Bell, CheckCircle, X, User, Info } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface ResponsibleViewProps {
  credits: Transaction[];
  otherDebts: Transaction[];
}

/**
 * Сценарий 5: Пользователь - ответственный (показываем кто должен)
 */
export const ResponsibleView = ({ credits, otherDebts }: ResponsibleViewProps) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  const safeCredits = Array.isArray(credits) ? credits : [];
  const currentPollId = safeCredits[0]?.pollId;
  const currentCredits = safeCredits.filter(c => c?.pollId === currentPollId);
  
  // Получаем итоговые суммы по заказу
  const { data: pollTotals } = useQuery({
    queryKey: ['pollTotals', currentPollId],
    queryFn: () => budgetService.getPollTotals(currentPollId),
    enabled: !!currentPollId,
  });
  
  // Рассчитываем суммы
  const totalToReceive = currentCredits.reduce((sum, c) => sum + (c.amount || 0), 0);
  const myShare = pollTotals?.responsibleShare || 0;
  
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
  
  const remindAllMutation = useMutation({
    mutationFn: () => budgetService.sendRemindersToAll(currentPollId || 0),
    onSuccess: (data: SendRemindersResult) => {
      haptic.success();
      
      // Формируем детальное сообщение
      if (data.failedCount === 0) {
        // Все успешно
        toast.success(`✅ Отправлено ${data.sentCount} из ${data.totalCount} напоминаний`);
      } else if (data.sentCount === 0) {
        // Все неудачно
        toast.error(`❌ Не удалось отправить напоминания (${data.failedCount} чел.)`);
      } else {
        // Частично успешно
        const failedNames = data.failedUsers
          .slice(0, 3)
          .map(u => `${u.firstName}${u.lastName ? ` ${  u.lastName.charAt(0)  }.` : ''}`)
          .join(', ');
        
        const moreCount = data.failedCount - 3;
        const namesList = moreCount > 0 
          ? `${failedNames} и еще ${moreCount}`
          : failedNames;
        
        toast.warning(
          `⚠️ Отправлено ${data.sentCount} из ${data.totalCount}. ${namesList} не могут получить уведомление. Попросите их написать /start боту.`,
          { duration: 6000 }
        );
      }
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка отправки');
    },
  });

  const handleRemindAll = () => {
    if (!currentPollId) {
      toast.error('Не удалось определить текущий опрос');
      return;
    }
    haptic.impact();
    remindAllMutation.mutate();
  };

  if (safeCredits.length === 0) {
    console.error('[ResponsibleView] ❌ credits is invalid:', credits);
    return null;
  }
  
  return (
    <div className="space-y-4">
      {/* Информация о заказе */}
      <div className="space-y-2 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Вы оплатили:</span>
          <span className="font-bold text-lg">-{totalToReceive + myShare}₽</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ваша доля:</span>
          <span className="font-medium">{myShare}₽</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Вернут вам:</span>
          <span className="text-xl font-bold text-mint-500 dark:text-mint-300">
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
                <User className={`${ICON_SIZES.md} text-muted-foreground`} />
                <div>
              <div className="font-medium text-sm">
                {[credit.fromUser?.firstName, credit.fromUser?.lastName]
                  .filter(Boolean)
                  .join(' ') || 'Пользователь'}
              </div>
                  <div className="text-xs text-muted-foreground">
                    {credit.amount}₽
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {credit.status === 'PENDING' && (
                  <Badge variant="secondary" className="text-xs">
                    Ожидается
                  </Badge>
                )}
                
                {credit.status === 'PAID' && (
                  <>
                    <Badge variant="warning" className="text-xs">
                      Оплачено
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleConfirm(credit.id)}
                        disabled={confirmMutation.isPending}
                        className="h-7 px-2"
                      >
                        <CheckCircle className={ICON_SIZES.xs} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                      >
                        <X className={ICON_SIZES.xs} />
                      </Button>
                    </div>
                  </>
                )}
                
                {credit.status === 'CONFIRMED' && (
                  <Badge variant="success" className="text-xs">
                    Подтверждено
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Глобальные действия */}
      <div className="grid grid-cols-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRemindAll}
                variant="outline"
                size="sm"
                className="relative"
              >
                <Bell className={`${ICON_SIZES.sm} mr-1.5`} />
                Напомнить
                <Info className={`${ICON_SIZES.xs} ml-1.5 text-muted-foreground`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[250px]">
              <p className="text-xs">
                Напоминание получат только пользователи, запустившие бота (написавшие /start)
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
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
