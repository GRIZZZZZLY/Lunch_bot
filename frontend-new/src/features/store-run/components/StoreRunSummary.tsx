/* Сводка COLLECTING как тикет: шапка (инициатор + счётчики + countdown),
   перфорация, корешок. На корешке живут действия над самой закупкой —
   «Закрыть сбор» и «Отменить закупку»; «Добавить позицию» к закупке не
   относится и остаётся в липкой зоне под большим пальцем. */
import type { ReactNode } from 'react';
import { Avatar } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import type { StoreRunWithRelations } from '@/services/store-run.service';
import styles from '../StoreRunPage.module.css';

export function StoreRunSummary({
  run,
  isInitiator,
  participantsCount,
  itemsCount,
  stub,
  children,
}: {
  run: StoreRunWithRelations;
  isInitiator: boolean;
  participantsCount: number;
  itemsCount: number;
  /** Содержимое корешка под перфорацией. */
  stub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`${styles.card} ${styles.ticket}`}>
      <div className={styles.ticketBody}>
        <div className={styles.summaryTop}>
          <Avatar name={run.initiator.firstName} size={40} />
          <div className={styles.summaryMeta}>
            <span className={styles.initiator}>
              {isInitiator ? 'Вы — инициатор' : `Инициатор: ${run.initiator.firstName}`}
            </span>
            <span className={styles.counts}>
              {pluralize(participantsCount, 'участник', 'участника', 'участников')} ·{' '}
              {pluralize(itemsCount, 'позиция', 'позиции', 'позиций')}
            </span>
          </div>
        </div>
        {children}
      </div>

      <div className={styles.perf}>
        <span className={styles.notch} />
      </div>
      <div className={styles.ticketStub}>{stub}</div>
    </section>
  );
}
