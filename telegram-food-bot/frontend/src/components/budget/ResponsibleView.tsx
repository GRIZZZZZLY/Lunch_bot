import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Transaction, budgetService, SendRemindersResult } from '../../services/budget.service';
import { Button } from '../ui/button';
import { Bell, CheckCircle, X, Info } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';
import { toast } from 'sonner';
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

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

/**
 * Сценарий 5: Пользователь — ответственный (показываем кто должен).
 * Variant B: крупная сумма-герой, прогресс сбора, моноширинные суммы.
 */
export const ResponsibleView = ({ credits, otherDebts }: ResponsibleViewProps) => {
  const haptic = useHaptic();
  const queryClient = useQueryClient();
  const safeCredits = Array.isArray(credits) ? credits : [];
  const currentPollId = safeCredits[0]?.pollId;

  // Получаем итоговые суммы по заказу
  const { data: pollTotals } = useQuery({
    queryKey: ['pollTotals', currentPollId],
    queryFn: () => budgetService.getPollTotals(currentPollId),
    enabled: !!currentPollId,
  });

  // Один проход по кредитам текущего заказа: список + сумма + счётчики статусов
  // (вместо filter + reduce + трёх filter + every по одному массиву).
  const {
    currentCredits,
    totalToReceive,
    confirmedCount,
    paidCount,
    pendingCount,
    collectedPct,
    allConfirmed,
  } = useMemo(() => {
    const list = safeCredits.filter(c => c?.pollId === currentPollId);
    let total = 0;
    let confirmed = 0;
    let paid = 0;
    let pending = 0;
    for (const c of list) {
      total += c.amount || 0;
      if (c.status === 'CONFIRMED') confirmed++;
      else if (c.status === 'PAID') paid++;
      else if (c.status === 'PENDING') pending++;
    }
    return {
      currentCredits: list,
      totalToReceive: total,
      confirmedCount: confirmed,
      paidCount: paid,
      pendingCount: pending,
      collectedPct: list.length > 0 ? (confirmed / list.length) * 100 : 0,
      allConfirmed: list.length > 0 && confirmed === list.length,
    };
  }, [safeCredits, currentPollId]);

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

      if (data.failedCount === 0) {
        toast.success(`✅ Отправлено ${data.sentCount} из ${data.totalCount} напоминаний`);
      } else if (data.sentCount === 0) {
        toast.error(`❌ Не удалось отправить напоминания (${data.failedCount} чел.)`);
      } else {
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
    <div className="space-y-5">
      {/* Сумма-герой: сколько вернут */}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Тебе вернут
        </p>
        <p className="mt-1 text-[44px] leading-none font-extrabold tracking-[-0.03em] text-mint-600 dark:text-mint-400 tabular-nums">
          +{fmt(totalToReceive)}&nbsp;₽
        </p>
        <p className="mt-2.5 text-xs text-muted-foreground tabular-nums">
          Оплачено <span className="font-semibold text-foreground">{fmt(totalToReceive + myShare)}&nbsp;₽</span>
          {' · '}твоя доля <span className="font-semibold text-foreground">{fmt(myShare)}&nbsp;₽</span>
        </p>

        {/* Прогресс сбора */}
        <div className="mt-3 flex items-center justify-center gap-5">
          <div className="text-center">
            <div className="text-base font-bold text-mint-600 dark:text-mint-400 tabular-nums">{confirmedCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">пришло</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-butter-600 dark:text-butter-400 tabular-nums">{paidCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">оплачено</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-muted-foreground tabular-nums">{pendingCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ждём</div>
          </div>
        </div>
      </div>

      {/* Полоса прогресса */}
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-mint-500 transition-all duration-300"
          style={{ width: `${collectedPct}%` }}
        />
      </div>

      {/* Список должников */}
      <div>
        <p className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Переводы
        </p>

        <div className="space-y-2">
          {currentCredits.map((credit) => {
            const name = [credit.fromUser?.firstName, credit.fromUser?.lastName]
              .filter(Boolean)
              .join(' ') || 'Пользователь';
            const initial = (credit.fromUser?.firstName || 'П').charAt(0).toUpperCase();

            return (
              <div
                key={credit.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/45"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-coral-500 text-white text-sm font-bold">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{fmt(credit.amount)}&nbsp;₽</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {credit.status === 'PENDING' && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground">
                      ждём
                    </span>
                  )}

                  {credit.status === 'PAID' && (
                    <>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-butter-500/16 text-butter-600 dark:text-butter-400">
                        оплачено
                      </span>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleConfirm(credit.id)}
                        disabled={confirmMutation.isPending}
                        className="h-7 w-7 p-0"
                      >
                        <CheckCircle className={ICON_SIZES.xs} />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                        <X className={ICON_SIZES.xs} />
                      </Button>
                    </>
                  )}

                  {credit.status === 'CONFIRMED' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-mint-500/16 text-mint-600 dark:text-mint-400">
                      <CheckCircle className={ICON_SIZES.xs} /> пришло
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Глобальные действия */}
      <div className="grid grid-cols-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRemindAll}
                disabled={remindAllMutation.isPending}
                size="sm"
                className="relative"
              >
                <Bell className={`${ICON_SIZES.sm} mr-1.5`} />
                Напомнить
                <Info className={`${ICON_SIZES.xs} ml-1.5 opacity-70`} />
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
          disabled={!allConfirmed}
        >
          Все оплатили
        </Button>
      </div>

      {/* Другие финансы */}
      {otherDebts.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground tabular-nums">
            Другие финансы: {otherDebts.length} долгов ({fmt(otherDebts.reduce((s, d) => s + d.amount, 0))}&nbsp;₽)
          </div>
        </div>
      )}
    </div>
  );
};
