/* Компактная строка победителя последнего голосования (вместо большого
   CompletedPollWidget). Тап — к итогам с рулеткой/деталями. */
import { Icon } from '@/components/rl/Icon';
import styles from '../HomePage.module.css';

export function WinnerRow({
  winnerName,
  winnerVotes,
  totalVotes,
  responsibleName,
  onOpen,
}: {
  winnerName: string;
  winnerVotes: number;
  totalVotes: number;
  responsibleName?: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={`${styles.row} ${styles.tappable}`} onClick={onOpen}>
      <span className={`${styles.rowIcon} ${styles.win}`} aria-hidden>
        <Icon name="crown" size={18} />
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>Победил: {winnerName}</span>
        <span className={styles.rowSub}>
          <span className="tnum">
            {winnerVotes} из {totalVotes}
          </span>
          {responsibleName ? ` · ответственный: ${responsibleName}` : ''}
        </span>
      </span>
      <span className={styles.rowSub} aria-hidden>
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  );
}
