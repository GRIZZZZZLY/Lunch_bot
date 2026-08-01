/* Мутирующая строка чеклиста (инициатор). «Куплено» отмечается ОДНИМ касанием
   и без цены: в магазине занята одна рука, а цены чаще проставляют по чеку на
   кассе. Цена — отдельный необязательный шаг; закупку без неё не рассчитать
   (guard в ShoppingView и в сервисе).
   Мутацию строка не держит: оптимистичное обновление сразу переносит её в
   другую секцию и размонтирует, поэтому владелец мутации — ShoppingView, а
   строка лишь сообщает намерение через onMark. Возврата в REQUESTED нет (API). */
import { useLayoutEffect, useRef, useState } from 'react';
import { ConfirmDialog, Status, TextField } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import type { StoreItem } from '@/services/store-run.service';
import { formatPrice, parsePriceInput, priceNum } from '../lib/selectors';
import styles from '../StoreRunPage.module.css';

type PendingAction = 'bought' | 'notFound' | 'price';

export interface MarkHandlers {
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
}

export type MarkItem = (
  itemId: number,
  price: number | null,
  status: 'BOUGHT' | 'NOT_FOUND',
  handlers?: MarkHandlers,
) => void;

function priceLabel(quantity: number): string {
  return quantity > 1 ? `Цена за всё (×${quantity}), ₽` : 'Цена за всё, ₽';
}

export function ShoppingItemRow({
  item,
  disabled,
  pending,
  onMark,
}: {
  item: StoreItem;
  /** Экран занят другой операцией (settle). */
  disabled: boolean;
  /** В полёте отметка именно этой позиции. */
  pending: boolean;
  onMark: MarkItem;
}) {
  const [pricing, setPricing] = useState(false);
  const [confirmingNotFound, setConfirmingNotFound] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | undefined>();
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rowDisabled = disabled || pending;
  const busy = (which: PendingAction) => pending && action === which;

  useLayoutEffect(() => {
    if (pricing) {
      inputRef.current?.focus();
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [pricing]);

  const pn = priceNum(item.price);

  const openPricing = () => {
    setRaw(pn != null ? String(pn) : '');
    setError(undefined);
    setPricing(true);
  };

  const cancelPricing = () => {
    setPricing(false);
    setError(undefined);
  };

  const mark = (
    which: PendingAction,
    price: number | null,
    status: 'BOUGHT' | 'NOT_FOUND',
    handlers?: MarkHandlers,
  ) => {
    setAction(which);
    onMark(item.id, price, status, {
      onSuccess: () => {
        setPricing(false);
        setConfirmingNotFound(false);
        handlers?.onSuccess?.();
      },
      onError: handlers?.onError,
    });
  };

  /** Отметка покупки без цены — основной путь в магазине. */
  const markBought = () => {
    if (rowDisabled) return;
    mark('bought', null, 'BOUGHT');
  };

  const savePrice = () => {
    if (pending) return;
    const n = parsePriceInput(raw);
    if (n === null) {
      setError('Введите цену от 0 до 100 000');
      return;
    }
    /* Отказ показываем у самого поля: клавиатура поднята, ввод не потерян, и
       переносить причину в тост наверху экрана здесь неуместно. */
    mark('price', n, 'BOUGHT', {
      onError: (e) => setError(e instanceof Error ? e.message : 'Не удалось сохранить цену'),
    });
  };

  const markNotFound = () => mark('notFound', null, 'NOT_FOUND');

  /* Подтверждаем, только если есть что стереть: у купленной позиции без цены
     терять нечего, и лишний диалог в магазине — это лишнее касание. */
  const requestNotFound = () => {
    if (rowDisabled) return;
    if (item.status === 'BOUGHT' && pn != null) {
      setConfirmingNotFound(true);
      return;
    }
    markNotFound();
  };

  const noPrice = item.status === 'BOUGHT' && pn == null;

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
          {pn != null ? (
            <span className={`tnum ${styles.rowPrice}`}>{formatPrice(pn)}</span>
          ) : (
            <span className={styles.rowPriceMissing}>цена не указана</span>
          )}
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
                savePrice();
              } else if (e.key === 'Escape') {
                cancelPricing();
              }
            }}
          />
          <div className={styles.priceButtons}>
            <Button variant="secondary" block disabled={pending} onClick={cancelPricing}>
              Отмена
            </Button>
            <Button block loading={busy('price')} onClick={savePrice}>
              Сохранить
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.itemActions}>
          {item.status === 'REQUESTED' && (
            <>
              <Button
                variant="secondary"
                disabled={rowDisabled}
                loading={busy('bought')}
                aria-label={`Куплено: ${item.name}`}
                onClick={markBought}
              >
                Куплено
              </Button>
              {/* Не близнец «Куплено»: соседние противоположные действия в одно
                  касание — риск промаха, поэтому вес разный. */}
              <Button
                variant="ghost"
                disabled={rowDisabled}
                loading={busy('notFound')}
                aria-label={`Не нашли: ${item.name}`}
                onClick={requestNotFound}
              >
                Не нашли
              </Button>
            </>
          )}
          {item.status === 'BOUGHT' && (
            <>
              {/* Пока цены нет, она блокирует расчёт — это и есть главное
                  действие строки, поэтому primary, а не вторичная. */}
              <Button
                variant={noPrice ? 'primary' : 'secondary'}
                disabled={rowDisabled}
                aria-label={`${noPrice ? 'Указать цену' : 'Изменить цену'}: ${item.name}`}
                onClick={openPricing}
              >
                {noPrice ? 'Указать цену' : 'Изменить цену'}
              </Button>
              <Button
                variant="ghost"
                disabled={rowDisabled}
                loading={busy('notFound')}
                aria-label={`Не нашли: ${item.name}`}
                onClick={requestNotFound}
              >
                Не нашли
              </Button>
            </>
          )}
          {item.status === 'NOT_FOUND' && (
            <Button
              variant="secondary"
              disabled={rowDisabled}
              loading={busy('bought')}
              aria-label={`Всё-таки куплено: ${item.name}`}
              onClick={markBought}
            >
              Всё-таки куплено
            </Button>
          )}
        </div>
      )}

      {confirmingNotFound && (
        <ConfirmDialog
          title={`Отметить «${item.name}» как ненайденную?`}
          description={`Цена ${formatPrice(pn ?? 0)} будет удалена, позиция не войдёт в расчёт.`}
          confirmLabel="Убрать цену"
          destructive
          pending={busy('notFound')}
          onConfirm={markNotFound}
          onCancel={() => setConfirmingNotFound(false)}
        />
      )}
    </div>
  );
}
