/* Строка позиции в COLLECTING. Владелец (canManage) видит edit/delete (44×44);
   остальные — read-only. Владелец подписан на уровне секции, в строке не дублируется. */
import { IconButton } from '@/shared/ui';
import type { StoreItem } from '@/services/store-run.service';
import styles from '../StoreRunPage.module.css';

export function StoreItemRow({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: StoreItem;
  canManage: boolean;
  onEdit?: (item: StoreItem) => void;
  onDelete?: (item: StoreItem) => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowName}>
          {item.name}
          {item.quantity > 1 && <span className={`tnum ${styles.rowQty}`}> ×{item.quantity}</span>}
        </div>
        {item.notes && <div className={styles.rowNotes}>{item.notes}</div>}
      </div>
      {canManage && (
        <div className={styles.rowActions}>
          <IconButton name="edit" aria-label={`Изменить «${item.name}»`} onClick={() => onEdit?.(item)} />
          <IconButton name="trash" aria-label={`Удалить «${item.name}»`} onClick={() => onDelete?.(item)} />
        </div>
      )}
    </div>
  );
}
