/* COLLECTING: сводка + живой countdown + позиции по участникам + действия.
   Роли: владелец правит/удаляет свои (edit — реальный PATCH через
   useUpdateStoreItem, delete — с ConfirmDialog); инициатор закрывает сбор /
   отменяет (ConfirmDialog), чужие позиции read-only. Серверный status —
   источник истины; истёкший countdown лишь рефетчит. */
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAddStoreItems,
  useCancelStoreRun,
  useDeleteStoreItem,
  useStartShopping,
  useUpdateStoreItem,
} from '@/hooks/useStoreRun';
import { queryKeys } from '@/lib/queryClient';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { ConfirmDialog, EmptyState, Status } from '@/shared/ui';
import type { StoreItem, StoreRunWithRelations } from '@/services/store-run.service';
import { groupItemsByParticipant, isInitiator as isInitiatorOf } from '../lib/selectors';
import { StoreRunSummary } from '../components/StoreRunSummary';
import { CollectionCountdown } from '../components/CollectionCountdown';
import { ParticipantSection } from '../components/ParticipantSection';
import { StoreRunActions, StoreRunStub } from '../components/StoreRunActions';
import { AddStoreItemSheet } from '../components/AddStoreItemSheet';
import { EditStoreItemSheet } from '../components/EditStoreItemSheet';
import styles from '../StoreRunPage.module.css';

export function CollectingView({
  run,
  currentUserId,
}: {
  run: StoreRunWithRelations;
  currentUserId: number | null;
}) {
  const qc = useQueryClient();
  const addItems = useAddStoreItems(run.id);
  const updateItem = useUpdateStoreItem(run.id);
  const deleteItem = useDeleteStoreItem(run.id);
  const startShopping = useStartShopping(run.id);
  const cancel = useCancelStoreRun(run.id);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StoreItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreItem | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isInitiator = isInitiatorOf(run, currentUserId);
  const items = run.items;

  // Система C: домен закупки — шафран (--shop), а не служебный warning
  const statusAction = useMemo(
    () => (
      <Status tone="shop" icon="clock">
        Сбор
      </Status>
    ),
    [],
  );
  useScreenHeader(run.storeName, statusAction);

  const groups = useMemo(() => groupItemsByParticipant(items, currentUserId), [items, currentUserId]);
  const mine = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);
  const participantsCount = groups.length;

  const onExpire = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(run.id) });
  }, [qc, run.id]);

  const summary = (
    <StoreRunSummary
      run={run}
      isInitiator={isInitiator}
      participantsCount={participantsCount}
      itemsCount={items.length}
      stub={
        <StoreRunStub
          isInitiator={isInitiator}
          itemCount={items.length}
          onClose={() => setConfirmClose(true)}
          onCancel={() => setConfirmCancel(true)}
        />
      }
    >
      <CollectionCountdown collectUntil={run.collectUntil} startAt={run.createdAt} onExpire={onExpire} />
    </StoreRunSummary>
  );

  /* Инициатор без своих позиций: заметка есть, кнопки нет — «Добавить позицию»
     стоит primary в липкой зоне, вторая такая же только делила бы внимание. */
  const initiatorAddSlot =
    isInitiator && !mine ? (
      <div className={`${styles.card} ${styles.plainCard}`}>
        <p className={styles.mineEmpty}>У вас пока нет позиций</p>
      </div>
    ) : null;

  return (
    <div className={styles.screen}>
      {summary}

      {/* У пустого состояния нет action: то же «Добавить позицию» стоит primary
          в прилипшей CTA-зоне — под большим пальцем. Две одинаковые кнопки на
          одном экране только делят внимание. */}
      {items.length === 0 ? (
        <div className={styles.card}>
          <EmptyState
            icon="cart"
            title="Пока пусто"
            description="Добавьте первую позицию — остальные подтянутся."
          />
        </div>
      ) : (
        <>
          {mine && (
            <ParticipantSection
              title="Мои позиции"
              items={mine.items}
              canManage
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          )}
          {initiatorAddSlot}
          {others.map((g) => (
            <ParticipantSection
              key={g.userId}
              title={g.user?.firstName ?? 'Участник'}
              items={g.items}
              canManage={false}
            />
          ))}
        </>
      )}

      <StoreRunActions onAdd={() => setAddOpen(true)} />

      {addOpen && (
        <AddStoreItemSheet
          busy={addItems.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={(values) =>
            addItems.mutate([values], { onSuccess: () => setAddOpen(false) })
          }
        />
      )}

      {editTarget && (
        <EditStoreItemSheet
          item={editTarget}
          busy={updateItem.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={(values) =>
            updateItem.mutate(
              { itemId: editTarget.id, data: values },
              { onSuccess: () => setEditTarget(null) },
            )
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Удалить позицию?"
          description={deleteTarget.name}
          confirmLabel="Удалить"
          destructive
          pending={deleteItem.isPending}
          onConfirm={() =>
            deleteItem.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
          }
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {confirmClose && (
        <ConfirmDialog
          title="Закрыть сбор досрочно?"
          description="Участники больше не смогут добавлять позиции."
          confirmLabel="Закрыть сбор"
          pending={startShopping.isPending}
          onConfirm={() => startShopping.mutate(undefined, { onSuccess: () => setConfirmClose(false) })}
          onCancel={() => setConfirmClose(false)}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Отменить закупку?"
          description="Закупка будет отменена, собранные позиции не сохранятся."
          confirmLabel="Отменить закупку"
          destructive
          pending={cancel.isPending}
          onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setConfirmCancel(false) })}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  );
}
