/* Бюджет команды (Phase 6b, система C). Полный сценарный цикл на сырых
   транзакциях: должник отмечает оплату и отменяет отметку, сборщик
   подтверждает оплату и напоминает. Две роли могут сосуществовать. */
import { useMemo } from 'react';
import {
  useCancelMark,
  useConfirmPayment,
  useCredits,
  useDebts,
  useMarkPaid,
  useSendReminder,
} from '@/hooks/useBudget';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { EmptyState, Skeleton, Status } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import { formatPrice } from '@/features/store-run/lib/selectors';
import { buildBudget } from './lib/buildBudget';
import styles from './BudgetPage.module.css';

export function BudgetPage() {
  useScreenHeader('Бюджет команды');
  const { data: debts = [], isLoading: debtsLoading } = useDebts();
  const { data: credits = [], isLoading: creditsLoading } = useCredits();
  const markPaid = useMarkPaid();
  const cancelMark = useCancelMark();
  const confirmPayment = useConfirmPayment();
  const sendReminder = useSendReminder();

  const vm = useMemo(() => buildBudget(debts, credits), [debts, credits]);
  const busyId = markPaid.variables ?? cancelMark.variables ?? confirmPayment.variables ?? sendReminder.variables;

  if (debtsLoading || creditsLoading) {
    return (
      <div className={`rl ${styles.screen}`}>
        <div className={styles.group} style={{ padding: 16 }}>
          <Skeleton variant="text" width="40%" />
          <div style={{ height: 12 }} />
          <Skeleton variant="block" height={56} />
        </div>
      </div>
    );
  }

  if (vm.isEmpty) {
    return (
      <div className={`rl ${styles.screen}`}>
        <div className={styles.stateWrap}>
          <EmptyState
            icon="wallet"
            title="Нет активных расчётов"
            description="Долги и оплаты появятся здесь после завершения голосования или закупки."
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`rl ${styles.screen}`}>
      {vm.myDebts.length > 0 && (
        <section className={styles.group} aria-label="Мои долги">
          <div className={styles.groupHead}>
            <span className={styles.groupTitle}>Мои долги</span>
            <span className={`tnum ${styles.groupTotal}`}>{formatPrice(vm.myDebtTotal)}</span>
          </div>
          {vm.myDebts.map((d) => (
            <div key={d.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden>
                {d.name[0].toUpperCase()}
              </div>
              <div className={styles.rowMain}>
                {/* Сумма — главное на денежном экране, имя контрагента вторично.
                    Статус говорит чип у имени: и текстовый дубль не нужен, и
                    зона действия остаётся под одну кнопку — строка не переносится. */}
                <span className={styles.rowPerson}>
                  <span>{d.name}</span>
                  {d.status === 'PAID' && <Status tone="warning">Ждёт</Status>}
                </span>
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(d.amount)}</span>
              </div>
              {d.status === 'PENDING' ? (
                <Button
                  variant="primary"
                  loading={busyId === d.id && markPaid.isPending}
                  onClick={() => markPaid.mutate(d.id)}
                >
                  Оплатил
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  loading={busyId === d.id && cancelMark.isPending}
                  onClick={() => cancelMark.mutate(d.id)}
                >
                  Отменить отметку
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      {vm.settledRecently && vm.myDebts.length === 0 && (
        <div className={styles.successLine}>
          <div className={styles.successText}>
            <span className={styles.successTitle}>Долг закрыт</span>
            <span className={styles.successSub}>оплата подтверждена сборщиком</span>
          </div>
          <Status tone="success">оплачено</Status>
        </div>
      )}

      {vm.owed.length > 0 && (
        <section className={styles.group} aria-label="Вам должны">
          <div className={styles.groupHead}>
            <span className={styles.groupTitle}>Вам должны</span>
            <span className={`tnum ${styles.groupTotal}`}>
              {formatPrice(vm.owedReceived)} из {formatPrice(vm.owedExpected)}
            </span>
          </div>
          <div className={styles.progress}>
            <span
              className={styles.progressFill}
              style={{ width: `${vm.owedExpected > 0 ? (vm.owedReceived / vm.owedExpected) * 100 : 0}%` }}
            />
          </div>
          {vm.owed.map((c) => (
            <div key={c.id} className={styles.row}>
              <div className={styles.avatar} aria-hidden>
                {c.name[0].toUpperCase()}
              </div>
              <div className={styles.rowMain}>
                <span className={styles.rowPerson}>
                  <span>{c.name}</span>
                  <span className={styles.rowPersonNote}>
                    {c.status === 'PAID' ? 'отметил оплату' : 'ждёт оплаты'}
                  </span>
                </span>
                <span className={`tnum ${styles.rowAmount}`}>{formatPrice(c.amount)}</span>
              </div>
              {c.status === 'PAID' ? (
                <Button
                  variant="primary"
                  loading={busyId === c.id && confirmPayment.isPending}
                  onClick={() => confirmPayment.mutate(c.id)}
                >
                  Подтвердить
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  loading={busyId === c.id && sendReminder.isPending}
                  onClick={() => sendReminder.mutate(c.id)}
                >
                  Напомнить
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      {vm.allCollected && vm.owed.length === 0 && (
        <div className={styles.successLine}>
          <div className={styles.successText}>
            <span className={styles.successTitle}>Все рассчитались</span>
            <span className={styles.successSub}>
              {pluralize(vm.owedCount, 'участник', 'участника', 'участников')} · {formatPrice(vm.owedExpected)}
            </span>
          </div>
          <Status tone="success">закрыто</Status>
        </div>
      )}
    </div>
  );
}
