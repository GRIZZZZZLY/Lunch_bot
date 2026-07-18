/* Разбивка по участникам для SETTLED. Данные — computeBreakdown (все статусы
   в группе; денежный subtotal — только BOUGHT с ценой, без quantity).
   Группа инициатора помечается «Инициатор», её сумма — «свои покупки», не долг. */
import { Status } from '@/shared/ui';
import type { BreakdownEntry } from '../lib/selectors';
import { formatPrice, priceNum } from '../lib/selectors';
import styles from '../StoreRunPage.module.css';

export function ParticipantBreakdown({
  entries,
  currentUserId,
}: {
  entries: BreakdownEntry[];
  currentUserId: number | null;
}) {
  return (
    <ul className={styles.breakdownList}>
      {entries.map((entry) => {
        const isMe = currentUserId != null && entry.userId === currentUserId;
        const name = isMe ? 'Вы' : entry.user?.firstName ?? 'Участник';
        return (
          <li key={entry.userId} className={styles.breakdownGroup}>
            <div className={styles.breakdownHead}>
              <span>
                {name}
                {entry.isInitiator && <span className={styles.breakdownRole}> · Инициатор</span>}
              </span>
              <span className={`tnum ${styles.breakdownSum}`}>
                {formatPrice(entry.total)}
                {entry.isInitiator && <span className={styles.breakdownSumNote}> · свои покупки</span>}
              </span>
            </div>
            <ul className={styles.breakdownRows}>
              {entry.items.map((item) => {
                const pn = priceNum(item.price);
                return (
                  <li key={item.id} className={styles.shopRow}>
                    <div className={styles.shopRowInfo}>
                      <div className={styles.rowMain}>
                        <div className={styles.rowName}>
                          {item.name}
                          {item.quantity > 1 && <span className={`tnum ${styles.rowQty}`}> ×{item.quantity}</span>}
                        </div>
                        {item.notes && <div className={styles.rowNotes}>{item.notes}</div>}
                      </div>
                    </div>
                    <div className={styles.rowStatusLine}>
                      {item.status === 'BOUGHT' && (
                        <>
                          <Status tone="success" icon="check">Куплено</Status>
                          {pn != null && <span className={`tnum ${styles.rowPrice}`}>{formatPrice(pn)}</span>}
                        </>
                      )}
                      {item.status === 'NOT_FOUND' && <Status tone="danger">Не нашли</Status>}
                      {item.status === 'REQUESTED' && (
                        <>
                          <Status tone="neutral">Не обработано</Status>
                          <span className={styles.requestedNote}>Не вошло в расчёт</span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
