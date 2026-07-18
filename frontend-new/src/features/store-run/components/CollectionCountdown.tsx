/* Живой таймер до collectUntil. Статус сам не меняет; при первом переходе в
   isExpired один раз дёргает onExpire (для refetch на странице). После истечения
   показывает InlineNotice «Сбор закрывается…». */
import { useEffect, useRef } from 'react';
import { useCountdown } from '@/shared/lib/useCountdown';
import { InlineNotice } from '@/shared/ui';
import styles from '../StoreRunPage.module.css';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function CollectionCountdown({
  collectUntil,
  startAt,
  onExpire,
}: {
  collectUntil: string;
  startAt: string;
  onExpire?: () => void;
}) {
  const cd = useCountdown(collectUntil);
  const firedRef = useRef(false);

  useEffect(() => {
    if (cd.isExpired && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [cd.isExpired, onExpire]);

  if (cd.isExpired) {
    return <InlineNotice tone="warning" title="Сбор закрывается…">Обновляем статус закупки…</InlineNotice>;
  }

  const windowMs = new Date(collectUntil).getTime() - new Date(startAt).getTime();
  const fraction = windowMs > 0 ? Math.max(0, Math.min(1, cd.remainingMs / windowMs)) : 0;
  const label =
    cd.hours > 0
      ? `${cd.hours}:${pad(cd.minutes)}:${pad(cd.seconds)}`
      : `${pad(cd.minutes)}:${pad(cd.seconds)}`;
  const low = cd.totalSeconds <= 60;
  const endTime = new Date(collectUntil).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={styles.countdown}>
      <div className={styles.countdownRow}>
        <span className={`tnum ${styles.countdownTime}${low ? ` ${styles.low}` : ''}`}>{label}</span>
        <span className={styles.countdownEnd}>до {endTime}</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
