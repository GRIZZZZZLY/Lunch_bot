/* Секция «Сейчас»: победитель последнего голосования, активные закупки,
   компактная строка бюджета, вторичная кнопка «Новая закупка» (FAB удалён). */
import type { ReactNode } from 'react';
import { Button, Status } from '@/shared/ui';
import { Icon } from '@/components/rl/Icon';
import { formatPrice } from '@/features/store-run/lib/selectors';
import type { StoreRunListItem } from '@/services/store-run.service';
import { pluralItems, type BudgetRowModel } from '../lib/selectors';
import styles from '../HomePage.module.css';

const RUN_STATUS: Record<string, { tone: 'warning' | 'success' | 'danger' | 'neutral'; label: string }> = {
  COLLECTING: { tone: 'warning', label: 'Сбор' },
  SHOPPING: { tone: 'warning', label: 'В магазине' },
  SETTLED: { tone: 'success', label: 'Рассчитано' },
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
    <section className={styles.group} aria-label="Сейчас">
      <div className={styles.groupHead}>
        <span className={styles.kicker}>Сейчас</span>
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
                {r.initiator.firstName} · <span className="prog tnum">{pluralItems(r.items.length)}</span>
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
                {budget.kind === 'debt' && 'Вы должны за обед'}
                {budget.kind === 'awaiting' && 'Оплата ждёт подтверждения'}
                {budget.kind === 'collector' && 'Вам должны участники'}
              </span>
            </span>
          </button>
          {budget.kind === 'debt' && budget.payableTxId != null ? (
            <Button variant="secondary" loading={paying} onClick={() => onMarkPaid(budget.payableTxId!)}>
              Оплатил · {formatPrice(budget.amount)}
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
