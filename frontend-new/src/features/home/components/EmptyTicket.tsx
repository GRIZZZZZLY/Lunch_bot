/* «Сегодня ещё не решали» — пустое состояние голосования. Primary CTA
   только у тех, кто может создавать (одна primary на экран). */
import { Button } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import styles from '../HomePage.module.css';

export function EmptyTicket({
  canCreate,
  hasGroup = true,
  onCreate,
  scheduleHint,
}: {
  canCreate: boolean;
  /** Есть ли вообще группа: без неё ждать админа бессмысленно. */
  hasGroup?: boolean;
  onCreate: () => void;
  /** Подпись расписания автоголосования, например «Автозапуск в 11:30, по будням». */
  scheduleHint?: string | null;
}) {
  const title = hasGroup ? 'Сегодня ещё не решали' : 'Группы пока нет';
  const text = canCreate
    ? 'Запустите голосование — команда выберет обед за пару минут.'
    : hasGroup
      ? 'Дождитесь, пока админ запустит голосование, — придёт уведомление.'
      : 'Добавьте бота в групповой чат — обед выбирают всей командой, а не по одному.';
  return (
    <section className={styles.group} aria-labelledby="ticket-heading">
      <div className={styles.groupHead}>
        <h2 id="ticket-heading" className={styles.kicker}>
          Обеденный талон
        </h2>
      </div>
      <div className={styles.emptyBody}>
        <div className={`${styles.rowIcon} ${hasGroup ? styles.win : styles.shop}`} aria-hidden>
          <Icon name={hasGroup ? 'flame' : 'users'} size={18} />
        </div>
        <div className={styles.emptyTitle}>{title}</div>
        <p className={styles.emptyText}>{text}</p>
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
        <div className={styles.stubSpacer} />
      )}
      {scheduleHint ? (
        <p className={styles.ctaNote}>
          <Icon name="clock" size={12} /> {scheduleHint}
        </p>
      ) : null}
    </section>
  );
}
