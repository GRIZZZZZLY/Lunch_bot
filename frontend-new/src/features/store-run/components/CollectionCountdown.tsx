/* Живой таймер до collectUntil. Статус сам не меняет; при первом переходе в
   isExpired один раз дёргает onExpire (для refetch на странице). После истечения
   показывает InlineNotice «Сбор закрывается…». */
import { useEffect, useRef } from 'react';
import { useCountdown } from '@/shared/lib/useCountdown';
import { spokenDuration } from '@/shared/lib/spokenTime';
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
        <span
          className={`tnum ${styles.countdownTime}${low ? ` ${styles.low}` : ''}`}
          role="timer"
          aria-label={`До конца сбора ${spokenDuration(cd.hours, cd.minutes, cd.seconds)}`}
        >
          <span aria-hidden="true">{label}</span>
        </span>
        {/* Последняя минута не должна опознаваться одним лишь красным: справа
            вместо времени закрытия встаёт слово. */}
        <span className={styles.countdownEnd}>{low ? 'меньше минуты' : `до ${endTime}`}</span>
      </div>
      {/* Полоса дублирует таймер: озвучивать её значит читать одно дважды. */}
      <div className={styles.bar} aria-hidden="true">
        <div className={styles.barFill} style={{ transform: `translateX(${fraction * 100 - 100}%)` }} />
      </div>
    </div>
  );
}
