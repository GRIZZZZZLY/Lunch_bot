/* Прогресс обработки закупки. processed = BOUGHT + NOT_FOUND; REQUESTED — нет.
   Пустой список: 0/0 без деления на ноль. */
import type { Progress } from '../lib/selectors';
import styles from '../StoreRunPage.module.css';

export function ShoppingProgress({ progress, live = false }: { progress: Progress; live?: boolean }) {
  const { processed, total, requested } = progress;
  const pct = total > 0 ? (processed / total) * 100 : 0;
  return (
    /* Пометка о живом изменении: цену проставил кто-то другой, и без знака
       новое число неотличимо от прежнего. role='status' ниже говорит то же
       диктору. */
    <div className={`${styles.progress} live-flash live-shop${live ? ' is-live' : ''}`}>
      {/* role="status" — счётчик меняется после каждой отметки, и без живой
          области экран остаётся молчаливым: строка уехала в другую секцию,
          сколько осталось — неизвестно. */}
      <div className={styles.progressRow} role="status">
        <span className={`tnum ${styles.progressLabel}`}>
          Обработано {processed} из {total}
        </span>
        {requested > 0 && <span className={`tnum ${styles.progressLeft}`}>осталось {requested}</span>}
      </div>
      <div className={styles.bar} aria-hidden="true">
        <div className={styles.barFill} style={{ transform: `translateX(${pct - 100}%)` }} />
      </div>
    </div>
  );
}
