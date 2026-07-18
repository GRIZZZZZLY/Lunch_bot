/* Секция позиций одного участника: заголовок (имя + счётчик) + строки. */
import { StoreItemRow } from './StoreItemRow';
import type { StoreItem } from '@/services/store-run.service';
import styles from '../StoreRunPage.module.css';

export function ParticipantSection({
  title,
  items,
  canManage,
  onEdit,
  onDelete,
}: {
  title: string;
  items: StoreItem[];
  canManage: boolean;
  onEdit?: (item: StoreItem) => void;
  onDelete?: (item: StoreItem) => void;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        {title} <span className={styles.sectionCount}>· {items.length}</span>
      </div>
      <div className={styles.rows}>
        {items.map((item) => (
          <StoreItemRow
            key={item.id}
            item={item}
            canManage={canManage}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}
