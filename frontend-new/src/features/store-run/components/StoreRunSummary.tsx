/* Плоская сводка COLLECTING: инициатор + счётчики + слот под countdown. */
import type { ReactNode } from 'react';
import { Avatar } from '@/components/rl/primitives';
import type { StoreRunWithRelations } from '@/services/store-run.service';
import styles from '../StoreRunPage.module.css';

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

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
            {plural(participantsCount, 'участник', 'участника', 'участников')} ·{' '}
            {plural(itemsCount, 'позиция', 'позиции', 'позиций')}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
