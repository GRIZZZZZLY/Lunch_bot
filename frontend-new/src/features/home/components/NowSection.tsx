/* Секция «Сейчас»: победитель последнего голосования, активные закупки,
   компактная строка бюджета, вторичная кнопка «Новая закупка» (FAB удалён). */
import type { ReactNode } from 'react';
import { Status, type StatusTone } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { formatPrice } from '@/features/store-run/lib/selectors';
import type { StoreRunListItem } from '@/services/store-run.service';
import { plural, pluralItems, type BudgetRowModel } from '../lib/selectors';
import styles from '../HomePage.module.css';

/* Домен закупки говорит шафраном (--shop), расчёт — щавелем (--money):
   статус голосования на этом же экране носит терракоту и не сливается. */
const RUN_STATUS: Record<string, { tone: StatusTone; label: string }> = {
  COLLECTING: { tone: 'shop', label: 'Сбор' },
  SHOPPING: { tone: 'shop', label: 'В магазине' },
  SETTLED: { tone: 'money', label: 'Рассчитано' },
  CANCELLED: { tone: 'danger', label: 'Отменено' },
};

export function NowSection({
  winner,
  runs,
  budget,
  paying,
  onOpenRun,
  onMarkPaid,
  onOpenBudget,
  onNewRun,
}: {
  winner: ReactNode;
  runs: StoreRunListItem[];
  budget: BudgetRowModel;
  paying: boolean;
  onOpenRun: (id: number) => void;
  onMarkPaid: (txId: number) => void;
  onOpenBudget: () => void;
  onNewRun: () => void;
}) {
  const hasContent = winner != null || runs.length > 0 || budget.kind !== 'hidden';

  return (
    <section className={styles.group} aria-labelledby="now-heading">
      <div className={styles.groupHead}>
        <h2 id="now-heading" className={styles.kicker}>
          Сейчас
        </h2>
      </div>

      {winner}

      {runs.map((r) => {
        const st = RUN_STATUS[r.status] ?? { tone: 'neutral' as const, label: r.status };
        return (
          <button
            key={r.id}
            type="button"
            className={`${styles.row} ${styles.tappable}`}
            onClick={() => onOpenRun(r.id)}
          >
            <span className={`${styles.rowIcon} ${styles.shop}`} aria-hidden>
              <Icon name="cart" size={18} />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{r.storeName}</span>
              <span className={styles.rowSub}>
                {r.initiator.firstName} ·{' '}
                <span className={`tnum ${styles.prog}`}>{pluralItems(r.items.length)}</span>
              </span>
            </span>
            <Status tone={st.tone}>{st.label}</Status>
          </button>
        );
      })}

      {budget.kind !== 'hidden' && (
        <div className={styles.row}>
          <button type="button" className={styles.rowTapArea} onClick={onOpenBudget}>
            <span className={`${styles.rowIcon} ${styles.money}`} aria-hidden>
              <Icon name="wallet" size={18} />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowName}>Бюджет команды</span>
              <span className={styles.rowSub}>
                {budget.kind === 'debt' &&
                  (budget.payableCount > 1 ? (
                    <>
                      Вы должны за обед ·{' '}
                      <span className="tnum">
                        {plural(budget.payableCount, 'перевод', 'перевода', 'переводов')}
                      </span>
                    </>
                  ) : (
                    'Вы должны за обед'
                  ))}
                {budget.kind === 'awaiting' && 'Оплата ждёт подтверждения'}
                {budget.kind === 'collector' &&
                  (budget.confirmed > 0 ? (
                    <>
                      Вам должны участники · получено{' '}
                      <span className="tnum">{formatPrice(budget.confirmed)}</span>
                    </>
                  ) : (
                    'Вам должны участники'
                  ))}
              </span>
            </span>
          </button>
          {/* Одна кнопка гасит одну транзакцию: при нескольких долгах суммы
              разные, и подпись «Оплатил · всё» была бы обещанием, которого
              мутация не выполняет. Несколько переводов разбираем в /budget. */}
          {budget.kind === 'debt' && budget.payableTxId != null && budget.payableCount === 1 ? (
            <Button variant="secondary" loading={paying} onClick={() => onMarkPaid(budget.payableTxId!)}>
              Оплатил · {formatPrice(budget.payableAmount)}
            </Button>
          ) : (
            <span className={`tnum ${styles.moneyVal}`}>{formatPrice(budget.amount)}</span>
          )}
        </div>
      )}

      {!hasContent && (
        <div className={styles.row}>
          <span className={styles.rowSub}>Пока тихо — ни закупок, ни долгов.</span>
        </div>
      )}

      <div className={styles.newRunBtn}>
        <Button variant="ghost" block onClick={onNewRun}>
          + Новая закупка в магазине
        </Button>
      </div>
    </section>
  );
}
