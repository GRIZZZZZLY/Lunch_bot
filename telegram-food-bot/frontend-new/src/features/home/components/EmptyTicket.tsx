/* «Сегодня ещё не решали» — пустое состояние голосования. Primary CTA
   только у тех, кто может создавать (одна primary на экран). */
import { Button } from '@/shared/ui';
import { Icon } from '@/components/rl/Icon';
import styles from '../HomePage.module.css';

export function EmptyTicket({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <section className={styles.group} aria-label="Голосование не запущено">
      <div className={styles.groupHead}>
        <span className={styles.kicker}>Обеденный талон</span>
      </div>
      <div className={styles.emptyBody}>
        <div className={styles.rowIcon + ' ' + styles.win} aria-hidden>
          <Icon name="flame" size={18} />
        </div>
        <div className={styles.emptyTitle}>Сегодня ещё не решали</div>
        <p className={styles.emptyText}>
          {canCreate
            ? 'Запустите голосование — команда выберет обед за пару минут.'
            : 'Дождитесь, пока админ запустит голосование, — придёт уведомление.'}
        </p>
      </div>
      <div className={styles.perf}>
        <span className={styles.notch} />
      </div>
      {canCreate ? (
        <div className={styles.ctaWrap}>
          <Button block onClick={onCreate}>
            Запустить голосование
          </Button>
        </div>
      ) : (
        <div style={{ height: 8 }} />
      )}
    </section>
  );
}
