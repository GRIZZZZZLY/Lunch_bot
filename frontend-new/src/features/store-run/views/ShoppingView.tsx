/* SHOPPING. Инициатор: чеклист «одной рукой» (Осталось/Куплено/Не нашли),
   inline-цены, прогресс, settle с валидацией. Участник: read-only + личная
   текущая сумма. Серверный status — источник истины; локально в SETTLED не
   переводим (это делает refetch → диспетчер). */
import { useCallback, useMemo, useState } from 'react';
import { useSettleStoreRun } from '@/hooks/useStoreRun';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { Avatar } from '@/components/rl/primitives';
import { ConfirmDialog, InlineNotice, Status } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import type { StoreItem, StoreRunWithRelations } from '@/services/store-run.service';
import {
  boughtWithoutPrice,
  computeProgress,
  formatPrice,
  isInitiator as isInitiatorOf,
  personalDebtTotal,
} from '../lib/selectors';
import { ShoppingProgress } from '../components/ShoppingProgress';
import { ShoppingItemRow } from '../components/ShoppingItemRow';
import { ReadOnlyShoppingItemRow } from '../components/ReadOnlyShoppingItemRow';
import styles from '../StoreRunPage.module.css';

const AUTO_CANCEL_NOTE =
  'Завершите расчёт после покупки. Незавершённая закупка может быть отменена автоматически.';

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        {title} <span className={styles.sectionCount}>· {count}</span>
      </div>
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
  const settle = useSettleStoreRun(run.id);
  const isInitiator = isInitiatorOf(run, currentUserId);
  const items = run.items;
  const progress = useMemo(() => computeProgress(items), [items]);

  const statusAction = useMemo(
    () => (
      <Status tone="warning" icon="cart">
        В магазине
      </Status>
    ),
    [],
  );
  useScreenHeader(run.storeName, statusAction);

  const [activeIds, setActiveIds] = useState<ReadonlySet<number>>(new Set());
  const [confirmSettle, setConfirmSettle] = useState(false);

  const onPendingChange = useCallback((itemId: number, pending: boolean) => {
    setActiveIds((prev) => {
      if (pending === prev.has(itemId)) return prev;
      const next = new Set(prev);
      if (pending) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  if (!isInitiator) {
    return <ParticipantShopping run={run} currentUserId={currentUserId} progress={progress} />;
  }

  const requested = items.filter((i) => i.status === 'REQUESTED');
  const bought = items.filter((i) => i.status === 'BOUGHT');
  const notFound = items.filter((i) => i.status === 'NOT_FOUND');

  const noPrice = boughtWithoutPrice(items);
  const anyItemMutating = activeIds.size > 0;
  const settlePending = settle.isPending;
  const settleDisabled = anyItemMutating || settlePending || noPrice.length > 0;

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
      runId={run.id}
      disabled={settlePending}
      onPendingChange={onPendingChange}
    />
  );

  return (
    <div className={styles.screen}>
      <ShoppingProgress progress={progress} />

      {items.length === 0 ? (
        <InlineNotice tone="info">В закупке нет позиций.</InlineNotice>
      ) : (
        <>
          {requested.length > 0 && <Section title="Осталось" count={requested.length}>{requested.map(row)}</Section>}
          {bought.length > 0 && <Section title="Куплено" count={bought.length}>{bought.map(row)}</Section>}
          {notFound.length > 0 && <Section title="Не нашли" count={notFound.length}>{notFound.map(row)}</Section>}
        </>
      )}

      {noPrice.length > 0 && (
        <InlineNotice tone="critical" title={`У ${plural(noPrice.length, 'купленной позиции', 'купленных позиций', 'купленных позиций')} не указана цена`}>
          Укажите цену, иначе позиция не попадёт в расчёт.
          <br />
          <button type="button" className={styles.noticeLink} onClick={scrollToFirstNoPrice}>
            Показать
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
          title={`${plural(progress.requested, 'позиция не обработана', 'позиции не обработано', 'позиций не обработано')}`}
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
  const items = run.items;
  const mine = items.filter((i) => currentUserId != null && i.userId === currentUserId);
  const others = items.filter((i) => !(currentUserId != null && i.userId === currentUserId));
  const personal = currentUserId != null ? personalDebtTotal(items, currentUserId, run.initiatorId) : 0;

  return (
    <div className={styles.screen}>
      <div className={styles.summaryTop}>
        <Avatar name={run.initiator.firstName} size={40} />
        <div className={styles.summaryMeta}>
          <span className={styles.initiator}>{run.initiator.firstName} в магазине</span>
        </div>
      </div>

      <ShoppingProgress progress={progress} />

      {mine.length > 0 ? (
        <Section title="Ваши позиции" count={mine.length}>
          {mine.map((item) => (
            <ReadOnlyShoppingItemRow key={item.id} item={item} showOwner={false} />
          ))}
        </Section>
      ) : (
        <InlineNotice tone="info">У вас нет позиций в этой закупке.</InlineNotice>
      )}

      {mine.length > 0 && (
        <div className={styles.personalSum}>
          Ваша текущая сумма: <strong className="tnum">{formatPrice(personal)}</strong>
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
