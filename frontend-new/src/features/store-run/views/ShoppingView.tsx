/* SHOPPING. Инициатор: чеклист «одной рукой» (Осталось/Куплено/Не нашли),
   inline-цены, прогресс, settle с валидацией. Участник: read-only + личная
   текущая сумма. Серверный status — источник истины; локально в SETTLED не
   переводим (это делает refetch → диспетчер). */
import { useCallback, useMemo, useState } from 'react';
import { useSetItemPrice, useSettleStoreRun } from '@/hooks/useStoreRun';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Avatar } from '@/components/rl/primitives';
import { ConfirmDialog, InlineNotice, Status } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { pluralize } from '@/shared/lib/pluralize';
import type { StoreItem, StoreRunWithRelations } from '@/services/store-run.service';
import {
  boughtWithoutPrice,
  computeProgress,
  formatPrice,
  isInitiator as isInitiatorOf,
  personalDebtTotal,
} from '../lib/selectors';
import { ShoppingProgress } from '../components/ShoppingProgress';
import { liveKey, useLiveChange } from '@/shared/lib/liveChanges';
import { ShoppingItemRow, type MarkItem } from '../components/ShoppingItemRow';
import { ReadOnlyShoppingItemRow } from '../components/ReadOnlyShoppingItemRow';
import styles from '../StoreRunPage.module.css';

const AUTO_CANCEL_NOTE =
  'Завершите расчёт после покупки. Незавершённая закупка может быть отменена автоматически.';

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHead}>
        {title}
        <span className={styles.sectionCount}>· {count}</span>
      </h2>
      <div className={styles.rows}>{children}</div>
    </section>
  );
}

export function ShoppingView({
  run,
  currentUserId,
}: {
  run: StoreRunWithRelations;
  currentUserId: number | null;
}) {
  const liveRun = useLiveChange(liveKey.storeRun(run.id));
  const settle = useSettleStoreRun(run.id);
  const setPrice = useSetItemPrice(run.id);
  const isInitiator = isInitiatorOf(run, currentUserId);
  const items = run.items;
  const progress = useMemo(() => computeProgress(items), [items]);

  // Система C: закупка говорит шафраном (--shop), а не служебным warning.
  const statusAction = useMemo(
    () => (
      <Status tone="shop" icon="cart">
        В магазине
      </Status>
    ),
    [],
  );
  useScreenHeader(run.storeName, statusAction);

  /* Отметка живёт здесь, а не в строке: оптимистичное обновление сразу
     переносит строку в другую секцию и размонтирует её, а вместе с ней —
     колбэки отката. Владелец мутации должен пережить свою строку. */
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmSettle, setConfirmSettle] = useState(false);

  const markItem = useCallback<MarkItem>(
    (itemId, price, status, handlers) => {
      setPendingId(itemId);
      setPrice.mutate(
        { itemId, payload: { price, status } },
        {
          onSuccess: () => handlers?.onSuccess?.(),
          onError: (e) => handlers?.onError?.(e),
          onSettled: () => setPendingId(null),
        },
      );
    },
    [setPrice],
  );

  if (!isInitiator) {
    return <ParticipantShopping run={run} currentUserId={currentUserId} progress={progress} />;
  }

  const requested = items.filter((i) => i.status === 'REQUESTED');
  const bought = items.filter((i) => i.status === 'BOUGHT');
  const notFound = items.filter((i) => i.status === 'NOT_FOUND');

  const noPrice = boughtWithoutPrice(items);
  const settlePending = settle.isPending;
  const settleDisabled = pendingId !== null || settlePending || noPrice.length > 0;

  const scrollToFirstNoPrice = () => {
    const first = noPrice[0];
    if (first) document.getElementById(`sr-item-${first.id}`)?.scrollIntoView({ block: 'center' });
  };

  const doSettle = () => settle.mutate(undefined, { onSuccess: () => setConfirmSettle(false) });

  const onSettleClick = () => {
    if (settleDisabled) return;
    if (progress.requested > 0) setConfirmSettle(true);
    else doSettle();
  };

  const row = (item: StoreItem) => (
    <ShoppingItemRow
      key={item.id}
      item={item}
      disabled={settlePending}
      pending={pendingId === item.id}
      onMark={markItem}
    />
  );

  return (
    <div className={styles.screen}>
      <div className={`${styles.card} ${styles.plainCard}`}>
        <ShoppingProgress progress={progress} live={liveRun} />
      </div>

      {items.length === 0 ? (
        <InlineNotice tone="info">В закупке нет позиций.</InlineNotice>
      ) : (
        <>
          {requested.length > 0 && <Section title="Осталось" count={requested.length}>{requested.map(row)}</Section>}
          {bought.length > 0 && <Section title="Куплено" count={bought.length}>{bought.map(row)}</Section>}
          {notFound.length > 0 && <Section title="Не нашли" count={notFound.length}>{notFound.map(row)}</Section>}
        </>
      )}

      {/* Не ошибка, а оставшийся шаг: цены проставляют по чеку, когда покупки
          уже отмечены. Поэтому warning и role="status", а не alert. */}
      {noPrice.length > 0 && (
        <InlineNotice
          tone="warning"
          title={`Осталось проставить ${pluralize(noPrice.length, 'цену', 'цены', 'цен')}`}
        >
          Без цены позиция не попадёт в расчёт.
          <br />
          <button type="button" className={styles.noticeLink} onClick={scrollToFirstNoPrice}>
            Показать первую
          </button>
        </InlineNotice>
      )}

      <InlineNotice tone="info">{AUTO_CANCEL_NOTE}</InlineNotice>

      <div className={styles.cta}>
        <Button block loading={settlePending} disabled={settleDisabled} onClick={onSettleClick}>
          Рассчитать
        </Button>
      </div>

      {confirmSettle && (
        <ConfirmDialog
          title={pluralize(
            progress.requested,
            'позиция не обработана',
            'позиции не обработано',
            'позиций не обработано',
          )}
          description="Они не попадут в расчёт. Продолжить?"
          confirmLabel="Рассчитать без них"
          pending={settlePending}
          onConfirm={doSettle}
          onCancel={() => setConfirmSettle(false)}
        />
      )}
    </div>
  );
}

function ParticipantShopping({
  run,
  currentUserId,
  progress,
}: {
  run: StoreRunWithRelations;
  currentUserId: number | null;
  progress: ReturnType<typeof computeProgress>;
}) {
  /* Участнику знак нужнее, чем инициатору: цены здесь проставляет не он, и
     число «обработано» меняется целиком чужими руками. */
  const liveRun = useLiveChange(liveKey.storeRun(run.id));
  const items = run.items;
  const mine = items.filter((i) => currentUserId != null && i.userId === currentUserId);
  const others = items.filter((i) => !(currentUserId != null && i.userId === currentUserId));
  const personal = currentUserId != null ? personalDebtTotal(items, currentUserId, run.initiatorId) : 0;

  return (
    <div className={styles.screen}>
      {/* Кто в магазине и сколько обработано — одна карточка: два соседних
          блока об одном и том же состоянии закупки. */}
      <div className={`${styles.card} ${styles.plainCard} ${styles.summary}`}>
        <div className={styles.summaryTop}>
          <Avatar name={run.initiator.firstName} size={40} />
          <div className={styles.summaryMeta}>
            <span className={styles.initiator}>{run.initiator.firstName} в магазине</span>
          </div>
        </div>
        <ShoppingProgress progress={progress} live={liveRun} />
      </div>

      {mine.length > 0 ? (
        <Section title="Ваши позиции" count={mine.length}>
          {mine.map((item) => (
            <ReadOnlyShoppingItemRow key={item.id} item={item} showOwner={false} />
          ))}
        </Section>
      ) : (
        <InlineNotice tone="info">У вас нет позиций в этой закупке.</InlineNotice>
      )}

      {/* Сумма растёт по мере того, как инициатор проставляет цены, — участник
          смотрит именно на неё, и молча она меняться не должна. */}
      {mine.length > 0 && (
        <div className={`${styles.card} ${styles.plainCard}`}>
          <div className={styles.personalSum} role="status">
            Ваша текущая сумма: <strong className="tnum">{formatPrice(personal)}</strong>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <Section title="Остальные позиции" count={others.length}>
          {others.map((item) => (
            <ReadOnlyShoppingItemRow key={item.id} item={item} showOwner />
          ))}
        </Section>
      )}

      <InlineNotice tone="info">Инициатор рассчитает закупку после магазина.</InlineNotice>
    </div>
  );
}
