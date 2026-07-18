/* Sticky CTA-зона COLLECTING. Участник — одна primary «Добавить позицию».
   Инициатор — одна primary «Закрыть сбор» (disabled при 0) + вторичная
   destructive «Отменить закупку». Двух конкурирующих primary нет. */
import { Button } from '@/shared/ui';
import styles from '../StoreRunPage.module.css';

export function StoreRunActions({
  isInitiator,
  itemCount,
  onAdd,
  onClose,
  onCancel,
}: {
  isInitiator: boolean;
  itemCount: number;
  onAdd: () => void;
  onClose: () => void;
  onCancel: () => void;
}) {
  if (!isInitiator) {
    return (
      <div className={styles.cta}>
        <Button block onClick={onAdd}>
          Добавить позицию
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.cta}>
      <Button block disabled={itemCount === 0} onClick={onClose}>
        Закрыть сбор
      </Button>
      <Button variant="ghost" block className={styles.cancelText} onClick={onCancel}>
        Отменить закупку
      </Button>
    </div>
  );
}
