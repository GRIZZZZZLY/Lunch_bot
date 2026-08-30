/* Действия COLLECTING разведены по смыслу, а не по рангу.

   Корешок тикета (StoreRunStub) — действия над самой закупкой: «Закрыть сбор» и
   «Отменить закупку». Они случаются один раз за жизнь закупки и принадлежат
   карточке, которая её описывает.

   Липкая зона (StoreRunActions) — «Добавить позицию»: частое действие списка,
   его место под большим пальцем.

   Прежде обе роли жили в липкой зоне, и на одном месте по очереди стояли
   «Добавить позицию» и «Закрыть сбор» — кнопка меняла смысл, не двигаясь.
   На пустом сборе primary по-прежнему остаётся созидательной: закрывать нечего,
   и на корешке вместо кнопки стоит подпись. */
import { Button } from '@/components/rl/primitives';
import styles from '../StoreRunPage.module.css';

export function StoreRunStub({
  isInitiator,
  itemCount,
  onClose,
  onCancel,
}: {
  isInitiator: boolean;
  itemCount: number;
  onClose: () => void;
  onCancel: () => void;
}) {
  if (!isInitiator) {
    return <p className={styles.stubNote}>Позиции можно менять, пока идёт сбор</p>;
  }
  return (
    <>
      {/* Пустой сбор нечего закрывать, но отменить его можно — иначе инициатор
          заперт в закупке, которую сам только что создал по ошибке. */}
      {itemCount === 0 ? (
        <p className={styles.stubNote}>Сбор можно закрыть, когда появится первая позиция</p>
      ) : (
        <Button variant="secondary" block onClick={onClose}>
          Закрыть сбор
        </Button>
      )}
      <div className={styles.ctaMinor}>
        <button type="button" className={styles.cancelText} onClick={onCancel}>
          Отменить закупку
        </button>
      </div>
    </>
  );
}

export function StoreRunActions({ onAdd }: { onAdd: () => void }) {
  return (
    <div className={styles.cta}>
      <Button block onClick={onAdd}>
        Добавить позицию
      </Button>
    </div>
  );
}
