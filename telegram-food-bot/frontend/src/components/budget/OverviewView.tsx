import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { CheckCircle, Bell, TrendingDown, TrendingUp, Wallet, ShoppingBag, Utensils } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
import { cn, formatRelativeTime } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

const safeFormatRelativeTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const dateValue = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(dateValue.getTime())) return '—';

  return formatRelativeTime(dateValue);
};

const getUserName = (user?: { firstName?: string; lastName?: string | null }) => {
  if (!user) return 'Пользователь';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Пользователь';
};

const getMenuItemName = (menuItem?: { name?: string | null } | null) => {
  return menuItem?.name || 'Блюдо';
};

const getItemLabel = (tx: Transaction) => {
  if (tx.storeRunId != null) {
    return tx.storeItem?.name || 'Товар';
  }
  return getMenuItemName(tx.menuItem);
};

const getSourceIcon = (tx: Transaction) => {
  if (tx.storeRunId != null) {
    return <ShoppingBag className="h-3.5 w-3.5 text-mint-600 dark:text-mint-400" aria-label="Магазин" />;
  }
  return <Utensils className="h-3.5 w-3.5 text-peach-600 dark:text-peach-400" aria-label="Обед" />;
};


interface OverviewViewProps {
  debts: Transaction[];
  credits: Transaction[];
}

/**
 * Сценарий 4: Обзор всех финансов (долгов и кредитов)
 */
export const OverviewView = ({
  debts,
  credits,
}: OverviewViewProps) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  const safeDebts = debts || [];
  const safeCredits = credits || [];
  const [selectedTab, setSelectedTab] = useState<string>(
    safeDebts.length > 0 || safeCredits.length === 0 ? 'debts' : 'credits'
  );

  const activeTab =
    selectedTab === 'debts' && safeDebts.length === 0 && safeCredits.length > 0
      ? 'credits'
      : selectedTab === 'credits' && safeCredits.length === 0 && safeDebts.length > 0
        ? 'debts'
        : selectedTab;

  const displayDebts = safeDebts.slice(0, 2);
  const displayCredits = safeCredits.slice(0, 2);
  
  const markAsPaidMutation = useMutation({
    mutationFn: (transactionId: number) => budgetService.markAsPaid(transactionId),
    onSuccess: () => {
      haptic.success();
      toast.success('Оплата отмечена!');
      void queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка отметки');
    },
  });
  
  const handleMarkAsPaid = (transactionId: number) => {
    haptic.impact();
    markAsPaidMutation.mutate(transactionId);
  };
  
  const remindMutation = useMutation({
    mutationFn: (transactionId: number) => budgetService.sendReminder(transactionId),
    onSuccess: () => {
      haptic.success();
      toast.success('Напоминание отправлено!');
      void queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
    onError: () => {
      haptic.error();
      toast.error('Ошибка отправки');
    },
  });

  const handleRemind = (transactionId: number) => {
    haptic.impact();
    remindMutation.mutate(transactionId);
  };
  
  return (
    <Tabs value={activeTab} onValueChange={setSelectedTab} className="w-full">
      {/* Tabs */}
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="debts" className="relative">
          <TrendingDown className={cn(ICON_SIZES.sm, "mr-1.5")} />
          Я должен
          {safeDebts.length > 0 && (
            <Badge className="ml-2 h-5 min-w-5 px-1.5" variant="destructive">
              {safeDebts.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="credits" className="relative">
          <TrendingUp className={cn(ICON_SIZES.sm, "mr-1.5")} />
          Мне должны
          {safeCredits.length > 0 && (
            <Badge className="ml-2 h-5 min-w-5 px-1.5">
              {safeCredits.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* Вкладка долгов */}
      <TabsContent value="debts" className="mt-0">
        {safeDebts.length > 0 ? (
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
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      {getSourceIcon(debt)}
                      <span>{getItemLabel(debt)} — {debt.amount ?? 0}₽</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      → {getUserName(debt.toUser)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {safeFormatRelativeTime(debt.createdAt)}
                    </div>
                  </div>
                  
                  <div>
                    {debt.status === 'PENDING' && (
                      <Badge variant="secondary" className="text-xs">
                        К оплате
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
                    variant="success"
                    size="sm"
                    className="w-full h-8"
                  >
                    <CheckCircle className={`${ICON_SIZES.xs} mr-1.5`} />
                    Оплатил(а)
                  </Button>
                )}
              </div>
            ))}
            
            {safeDebts.length > 2 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                + еще {safeDebts.length - 2}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 text-pastel-sage-400" />
            <p className="text-sm">Ничего не должны</p>
          </div>
        )}
      </TabsContent>
      
      {/* Вкладка кредитов */}
      <TabsContent value="credits" className="mt-0">
        {safeCredits.length > 0 ? (
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
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    {getSourceIcon(credit)}
                    <span>{credit.fromUser.firstName} {credit.fromUser.lastName || ''}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {credit.amount ?? 0}₽ • {safeFormatRelativeTime(credit.createdAt)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {credit.status === 'PENDING' && (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        Ожидается
                      </Badge>
                      <Button
                        onClick={() => handleRemind(credit.id)}
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        aria-label="Напомнить"
                      >
                        <Bell className={ICON_SIZES.xs} />
                      </Button>
                    </>
                  )}
                  
                  {credit.status === 'PAID' && (
                    <Badge variant="default" className="text-xs bg-amber-500">
                      Оплачено
                    </Badge>
                  )}
                  
                  {credit.status === 'CONFIRMED' && (
                    <Badge variant="default" className="text-xs bg-green-500">
                      Подтверждено
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            
            {safeCredits.length > 2 && (
              <div className="text-xs text-muted-foreground text-center py-1">
                + еще {safeCredits.length - 2}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="mx-auto mb-2 h-8 w-8 text-pastel-sage-400" />
            <p className="text-sm">Никто не должен</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
