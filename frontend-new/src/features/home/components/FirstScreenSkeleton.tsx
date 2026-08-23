/**
 * Экран до раскрытия барьера: один скелет вместо четырёх проявлений подряд.
 *
 * Высоты реальные (208px под талон, 140 под «Сейчас»), поэтому раскрытие ничего
 * не сдвигает — меняется только содержимое уже занятых мест. Менять их вместе с
 * версткой соответствующих карточек, иначе на переходе появится прыжок.
 */
import { Skeleton } from '@/shared/ui';
import { Greeting } from './Greeting';
import styles from '../HomePage.module.css';

interface FirstScreenSkeletonProps {
  name?: string;
  /** Окно молчания прошло — скелет можно показывать. */
  visible: boolean;
}

export function FirstScreenSkeleton({ name, visible }: FirstScreenSkeletonProps) {
  return (
    <div className={`rl ${styles.screen}`}>
      <Greeting name={name} loading />

      <div className={styles.ticketSlot}>
        {visible && (
          <div className={`${styles.group} ${styles.ticketPad}`}>
            <Skeleton variant="text" width="40%" height={10} />
            <div className={styles.skeletonGap} />
            <Skeleton variant="block" height={154} />
          </div>
        )}
      </div>

      <div className={styles.nowSlot}>
        {visible && (
          <div className={`${styles.group} ${styles.ticketPad}`}>
            <Skeleton variant="text" width="30%" height={10} />
            <div className={styles.skeletonGap} />
            <Skeleton variant="block" height={56} />
          </div>
        )}
      </div>
    </div>
  );
}
