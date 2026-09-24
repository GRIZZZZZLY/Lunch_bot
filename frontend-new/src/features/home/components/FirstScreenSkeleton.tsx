/**
 * Экран до раскрытия барьера: один скелет вместо четырёх проявлений подряд.
 *
 * Высоты реальные (208px под талон, 156 под «Сейчас»), поэтому раскрытие ничего
 * не сдвигает — меняется только содержимое уже занятых мест. Менять их вместе с
 * версткой соответствующих карточек, иначе на переходе появится прыжок.
 */
import { Skeleton } from '@/shared/ui';
import styles from '../HomePage.module.css';

interface FirstScreenSkeletonProps {
  /** Окно молчания прошло — скелет можно показывать. */
  visible: boolean;
}

export function FirstScreenSkeleton({ visible }: FirstScreenSkeletonProps) {
  return (
    <div className={`rl ${styles.screen}`}>
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
