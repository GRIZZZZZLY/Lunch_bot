/* Мутирующая строка чеклиста (инициатор). useSetItemPrice вызывается здесь —
   pending скоупится по строке; о своём pending строка сообщает родителю
   (onPendingChange) для блокировки settle. Возврата в REQUESTED нет (API). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSetItemPrice } from '@/hooks/useStoreRun';
import { Button, Status, TextField } from '@/shared/ui';
import type { StoreItem } from '@/services/store-run.service';
import { formatPrice, parsePriceInput, priceNum } from '../lib/selectors';
import styles from '../StoreRunPage.module.css';

function priceLabel(quantity: number): string {
  return quantity > 1 ? `Цена за всё (×${quantity}), ₽` : 'Цена за всё, ₽';
}

export function ShoppingItemRow({
  item,
  runId,
  disabled,
  onPendingChange,
}: {
  item: StoreItem;
  runId: number;
  disabled: boolean;
  onPendingChange: (itemId: number, pending: boolean) => void;
}) {
  const setPrice = useSetItemPrice(runId);
  const [pricing, setPricing] = useState(false);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | undefined>();
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = setPrice.isPending;
  const rowDisabled = disabled || pending;

  useEffect(() => {
    onPendingChange(item.id, pending);
  }, [pending, item.id, onPendingChange]);

  useLayoutEffect(() => {
    if (pricing) {
      inputRef.current?.focus();
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [pricing]);

  const openPricing = (initial: string) => {
    setRaw(initial);
    setError(undefined);
    setPricing(true);
  };

  const cancelPricing = () => {
    setPricing(false);
    setError(undefined);
  };

  const save = () => {
    if (pending) return;
    const n = parsePriceInput(raw);
    if (n === null) {
      setError('Введите цену (0 и больше)');
      return;
    }
    setPrice.mutate(
      { itemId: item.id, payload: { price: n, status: 'BOUGHT' } },
      {
        onSuccess: () => setPricing(false),
        onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось сохранить цену'),
      },
    );
  };

  const markNotFound = () => {
    if (rowDisabled) return;
    setPrice.mutate({ itemId: item.id, payload: { price: null, status: 'NOT_FOUND' } });
  };

  const pn = priceNum(item.price);

  return (
    <div className={styles.shopRow} id={`sr-item-${item.id}`} ref={rowRef}>
      <div className={styles.shopRowInfo}>
        <div className={styles.rowMain}>
          <div className={styles.rowName}>
            {item.name}
            {item.quantity > 1 && <span className={`tnum ${styles.rowQty}`}> ×{item.quantity}</span>}
          </div>
          {item.notes && <div className={styles.rowNotes}>{item.notes}</div>}
        </div>
        <span className={styles.ownerLabel}>{item.user?.firstName ?? 'Участник'}</span>
      </div>

      {item.status === 'BOUGHT' && !pricing && (
        <div className={styles.rowStatusLine}>
          <Status tone="success" icon="check">Куплено</Status>
          <span className={`tnum ${styles.rowPrice}`}>
            {pn != null ? formatPrice(pn) : 'цена не указана'}
          </span>
        </div>
      )}
      {item.status === 'NOT_FOUND' && !pricing && (
        <div className={styles.rowStatusLine}>
          <Status tone="danger">Не нашли</Status>
        </div>
      )}

      {pricing ? (
        <div className={styles.priceEditor}>
          <TextField
            ref={inputRef}
            label={priceLabel(item.quantity)}
            inputMode="decimal"
            value={raw}
            disabled={pending}
            error={error}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                cancelPricing();
              }
            }}
          />
          <div className={styles.priceButtons}>
            <Button variant="secondary" block disabled={pending} onClick={cancelPricing}>
              Отмена
            </Button>
            <Button block loading={pending} onClick={save}>
              Сохранить
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.itemActions}>
          {item.status === 'REQUESTED' && (
            <>
              <Button variant="secondary" disabled={rowDisabled} onClick={() => openPricing('')}>
                Куплено
              </Button>
              <Button variant="secondary" disabled={rowDisabled} loading={pending} onClick={markNotFound}>
                Не нашли
              </Button>
            </>
          )}
          {item.status === 'BOUGHT' && (
            <>
              <Button variant="secondary" disabled={rowDisabled} onClick={() => openPricing(pn != null ? String(pn) : '')}>
                Изменить цену
              </Button>
              <Button variant="ghost" disabled={rowDisabled} onClick={markNotFound}>
                Не нашли
              </Button>
            </>
          )}
          {item.status === 'NOT_FOUND' && (
            <Button variant="secondary" disabled={rowDisabled} onClick={() => openPricing('')}>
              Всё-таки куплено
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
