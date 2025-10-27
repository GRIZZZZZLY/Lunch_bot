import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, Bell, TrendingDown, TrendingUp } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { useToast } from '../common/ToastManager';
import { cn, formatRelativeTime } from '../../lib/utils';

interface OverviewViewProps {
  debts: Transaction[];
  credits: Transaction[];
  totalDebts: number;
  totalCredits: number;
}

/**
 * Сценарий 4: Обзор всех финансов (долгов и кредитов)
 */
export const OverviewView: React.FC<OverviewViewProps> = ({ 
  debts, 
  credits, 
  totalDebts, 
  totalCredits 
}) => {
  const haptic = useHaptic();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  
  // CRITICAL: Защита от undefined/null значений
  const safeDebts = debts || [];
  const safeCredits = credits || [];
  const safeTotalDebts = totalDebts || 0;
  const safeTotalCredits = totalCredits || 0;
  
  // Показываем только последние 2-3 элемента
  const displayDebts = safeDebts.slice(0, 2);
  const displayCredits = safeCredits.slice(0, 2);
  
  // Mutation для отметки оплаты
  const markAsPaidMutation = useMutation({
    mutationFn: (transactionId: number) => budgetService.markAsPaid(transactionId),
    onSuccess: () => {
      haptic.success();
      showToast('Оплата отмечена!', 'success');
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      showToast('Ошибка отметки', 'error');
    },
  });
  
  const handleMarkAsPaid = (transactionId: number) => {
    haptic.impact();
    markAsPaidMutation.mutate(transactionId);
  };
  
  const handleRemind = (transactionId: number) => {
    haptic.impact();
    showToast('Напоминание отправлено!', 'info');
    // TODO: Implement reminder API
  };
  
  return (
    <div className="space-y-5">
      {/* Секция долгов */}
      {safeDebts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-coral-500" />
              <span className="text-sm font-medium">Мои долги:</span>
            </div>
            <span className="font-bold text-coral-600 dark:text-coral-400">
              {safeTotalDebts}₽
            </span>
          </div>
          
          <div className="space-y-3">
            {displayDebts.map((debt) => (
              <div
                key={debt.id}
                className={cn(
                  'flex flex-col gap-2.5 p-4 rounded-card',
                  'bg-muted/50 hover:bg-muted/70 transition-colors'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      🍽️ {debt.menuItem?.name || 'Блюдо'} — {debt.amount}₽
                    </div>
                    <div className="text-xs text-muted-foreground">
                      → {debt.toUser.firstName} {debt.toUser.lastName || ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      📅 {formatRelativeTime(debt.createdAt)}
                    </div>
                  </div>
                  
                  <div>
                    {debt.status === 'PENDING' && (
                      <Badge variant="secondary" className="text-xs">
                        ⏰ К оплате
                      </Badge>
                    )}
                    {debt.status === 'PAID' && (
                      <Badge variant="default" className="text-xs bg-amber-500">
                        Ожидается
                      </Badge>
                    )}
                    {debt.status === 'CONFIRMED' && (
                      <Badge variant="default" className="text-xs bg-green-500">
                        Оплачено
                      </Badge>
                    )}
                  </div>
                </div>
                
                {debt.status === 'PENDING' && (
                  <Button
                    onClick={() => handleMarkAsPaid(debt.id)}
                    disabled={markAsPaidMutation.isPending}
                    size="sm"
                    className="w-full h-8 bg-green-500 hover:bg-green-600"
                  >
                    <CheckCircle className="size-3 mr-1.5" />
                    Оплатил(а)
                  </Button>
                )}
              </div>
            ))}
            
            {debts.length > 2 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                + еще {debts.length - 2} долгов
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Секция кредитов */}
      {safeCredits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" />
              <span className="text-sm font-medium">Мне должны:</span>
            </div>
            <span className="font-bold text-green-600 dark:text-green-400">
              {safeTotalCredits}₽
            </span>
          </div>
          
          <div className="space-y-3">
            {displayCredits.map((credit) => (
              <div
                key={credit.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-card',
                  'bg-muted/50 hover:bg-muted/70 transition-colors'
                )}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    👤 {credit.fromUser.firstName} {credit.fromUser.lastName || ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {credit.amount}₽ • {formatRelativeTime(credit.createdAt)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {credit.status === 'PENDING' && (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        ⏰ Ожидается
                      </Badge>
                      <Button
                        onClick={() => handleRemind(credit.id)}
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                      >
                        <Bell className="size-3" />
                      </Button>
                    </>
                  )}
                  
                  {credit.status === 'PAID' && (
                    <Badge variant="default" className="text-xs bg-amber-500">
                      ✅ Оплачено
                    </Badge>
                  )}
                  
                  {credit.status === 'CONFIRMED' && (
                    <Badge variant="default" className="text-xs bg-green-500">
                      🔔 Подтверждено
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            
            {credits.length > 2 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                + еще {credits.length - 2} кредитов
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
