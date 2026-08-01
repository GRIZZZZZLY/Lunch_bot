/* Плоская сводка COLLECTING: инициатор + счётчики + слот под countdown. */
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
  children,
}: {
  run: StoreRunWithRelations;
  isInitiator: boolean;
  participantsCount: number;
  itemsCount: number;
  children?: ReactNode;
}) {
  return (
    <div className={styles.summary}>
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
  );
}
