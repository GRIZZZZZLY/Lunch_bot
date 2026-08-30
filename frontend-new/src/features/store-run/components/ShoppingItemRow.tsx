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
  onPricingChange,
  pricingRequested = false,
}: {
  item: StoreItem;
  /** Экран занят другой операцией (settle). */
  disabled: boolean;
  /** В полёте отметка именно этой позиции. */
  pending: boolean;
  onMark: MarkItem;
  /** Открыт ли редактор цены: пока он открыт, экран не даёт рассчитать. */
  onPricingChange?: (open: boolean) => void;
  /** Редактор открыт снаружи — из нотиса о непроставленных ценах. */
  pricingRequested?: boolean;
}) {
  const [pricingLocal, setPricingLocal] = useState(false);
  const [confirmingNotFound, setConfirmingNotFound] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | undefined>();
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rowDisabled = disabled || pending;
  const busy = (which: PendingAction) => pending && action === which;

  /* Редактор открывается двумя путями: своей кнопкой строки и нотисом
     «осталось проставить цену». Внешний путь — обычный проп, а не эффект,
     синхронизирующий локальное состояние: эффект пришлось бы дёргать setState в
     теле, что правила репозитория запрещают. Поле стартует пустым, и это верно:
     снаружи открывают ровно те позиции, у которых цены нет. */
  const pricing = pricingLocal || pricingRequested;

  useLayoutEffect(() => {
    if (pricing) {
      inputRef.current?.focus();
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [pricing]);

  const pn = priceNum(item.price);

  /* О состоянии редактора сообщаем в самих обработчиках, а не эффектом на
     `pricing`: правила репозитория запрещают setState в теле эффекта, а именно
     им обернулось бы уведомление родителя. */
  const openPricing = () => {
    setRaw(pn != null ? String(pn) : '');
    setError(undefined);
    setPricingLocal(true);
    onPricingChange?.(true);
  };

  const cancelPricing = () => {
    setPricingLocal(false);
    setError(undefined);
    onPricingChange?.(false);
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
        setPricingLocal(false);
        onPricingChange?.(false);
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
          {/* Тональная пара: исход покупки называет цвет — щавель у «Куплено»,
              терракота у «Не нашли», тем же цветом, что и Status этой позиции
              после отметки. Раньше здесь стояли secondary и ghost: на карточке
              первая брала заливку подложки, вторая была просто текстом.
              Близнецами они не стали — цвет и смысл разные, а вес одинаковый:
              оба исхода равновероятны, и делать отказ тише значит подталкивать
              к «Куплено» там, где решает полка магазина. */}
          {item.status === 'REQUESTED' && (
            <>
              <Button
                variant="success-soft"
                disabled={rowDisabled}
                loading={busy('bought')}
                aria-label={`Куплено: ${item.name}`}
                onClick={markBought}
              >
                Куплено
              </Button>
              <Button
                variant="danger-soft"
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
              {/* Не primary, даже когда цена блокирует расчёт: графитовая CTA
                  на экране одна («Рассчитать»), а при пяти позициях без цены
                  вышло бы пять чёрных плит.

                  Но и не одна кнопка на два случая. «Указать цену» — незакрытый
                  шаг, который держит расчёт, и он носит шафран нотиса, который
                  об этом шаге и говорит. «Изменить цену» ничего не держит:
                  необязательная правка уже введённого числа, ей хватает
                  вторичного веса. */}
              <Button
                variant={noPrice ? 'warning-soft' : 'secondary'}
                disabled={rowDisabled}
                aria-label={`${noPrice ? 'Указать цену' : 'Изменить цену'}: ${item.name}`}
                onClick={openPricing}
              >
                {noPrice ? 'Указать цену' : 'Изменить цену'}
              </Button>
              {/* Здесь «Не нашли» — откат уже отмеченной покупки, а не половина
                  равной пары: цвет тот же, вес ниже. */}
              <Button
                variant="ghost"
                className={styles.ghostDanger}
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
              variant="success-soft"
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
