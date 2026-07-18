/* Read-only строка для участника: статус + цена, без контролов. */
import { Status } from '@/shared/ui';
import type { StoreItem } from '@/services/store-run.service';
import { formatPrice, priceNum } from '../lib/selectors';
import styles from '../StoreRunPage.module.css';

export function ReadOnlyShoppingItemRow({
  item,
  showOwner,
  requestedLabel = 'Осталось',
}: {
  item: StoreItem;
  showOwner: boolean;
  /** Лейбл REQUESTED зависит от контекста: «Осталось» (SHOPPING) / «Запрошено» (история). */
  requestedLabel?: string;
}) {
  const pn = priceNum(item.price);
  return (
    <div className={styles.shopRow}>
      <div className={styles.shopRowInfo}>
        <div className={styles.rowMain}>
          <div className={styles.rowName}>
            {item.name}
            {item.quantity > 1 && <span className={`tnum ${styles.rowQty}`}> ×{item.quantity}</span>}
          </div>
          {item.notes && <div className={styles.rowNotes}>{item.notes}</div>}
        </div>
        {showOwner && <span className={styles.ownerLabel}>{item.user?.firstName ?? 'Участник'}</span>}
      </div>
      <div className={styles.rowStatusLine}>
        {item.status === 'REQUESTED' && <Status tone="neutral">{requestedLabel}</Status>}
        {item.status === 'BOUGHT' && (
          <>
            <Status tone="success" icon="check">Куплено</Status>
            {pn != null && <span className={`tnum ${styles.rowPrice}`}>{formatPrice(pn)}</span>}
          </>
        )}
        {item.status === 'NOT_FOUND' && <Status tone="danger">Не нашли</Status>}
      </div>
    </div>
  );
}
