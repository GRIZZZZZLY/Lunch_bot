/* Sticky CTA-зона COLLECTING. Участник — одна primary «Добавить позицию».
   Инициатор — primary «Закрыть сбор» (disabled при 0) и отмена НИЖЕ рангом:
   на пустом сборе заблокированная primary оставляла уничтожение единственной
   живой кнопкой, поэтому пустому экрану даём созидательное действие, а отмену
   держим узкой текстовой — она не равна закрытию сбора и не должна так
   выглядеть. */
import { Button } from '@/components/rl/primitives';
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
  const empty = itemCount === 0;
  return (
    <div className={styles.cta}>
      {empty ? (
        <Button block onClick={onAdd}>
          Добавить позицию
        </Button>
      ) : (
        <Button block onClick={onClose}>
          Закрыть сбор
        </Button>
      )}
      <div className={styles.ctaMinor}>
        <button type="button" className={styles.cancelText} onClick={onCancel}>
          Отменить закупку
        </button>
      </div>
    </div>
  );
}
