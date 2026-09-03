/**
 * Закупки на главной: активные забеги и создание нового.
 *
 * Третий независимый сценарий главной (задача 12). Создание уводит на экран
 * забега сразу после ответа сервера — иначе человек остаётся на главной и не
 * понимает, создалось ли что-нибудь.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useArchiveGroupStore,
  useGroupStores,
  useRenameGroupStore,
} from '@/hooks/useGroupStores';
import { useActiveStoreRuns, useCreateStoreRun } from '@/hooks/useStoreRun';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/store/useAppStore';
import type { GroupStore } from '@/services/group-store.service';

/**
 * Магазин задаётся ЛИБО выбором из справочника, ЛИБО именем — оба поля
 * необязательные, и ровно одно из них приходит из шторки.
 */
export interface CreateStoreRunInput {
  storeId?: number | null;
  storeName?: string;
  collectMinutes: number;
}

export function useHomeStoreRun() {
  const navigate = useNavigate();
  const toast = useToast();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  const runsQuery = useActiveStoreRuns();
  const { data: activeRuns = [] } = runsQuery;
  const createStoreRun = useCreateStoreRun();

  const createRun = useCallback(
    async (input: CreateStoreRunInput): Promise<boolean> => {
      if (!currentGroupId) {
        toast.error('Нет активной группы для закупки');
        return false;
      }

      try {
        const res = await createStoreRun.mutateAsync({
          groupId: Number(currentGroupId),
          ...input,
        });
        const newId = res.data?.id;
        if (newId) navigate(`/store-run/${newId}`);
        return true;
      } catch {
        /* Сообщение показывает сам хук мутации; здесь только «не закрывать
           шторку», чтобы человек мог поправить ввод. */
        return false;
      }
    },
    [currentGroupId, createStoreRun, navigate, toast],
  );

  /* ---- справочник магазинов ----
     Живёт здесь, а не в HomePage: страница уже несёт четыре сценария, и
     пятый набор состояний в ней — прямой путь к очередной правке вслепую. */
  const storesQuery = useGroupStores(currentGroupId ? Number(currentGroupId) : null);
  const renameStore = useRenameGroupStore(currentGroupId ? Number(currentGroupId) : null);
  const archiveStore = useArchiveGroupStore(currentGroupId ? Number(currentGroupId) : null);
  const [managedStore, setManagedStore] = useState<GroupStore | null>(null);

  const renameManagedStore = useCallback(
    (name: string) => {
      if (!managedStore) return;
      renameStore.mutate(
        { storeId: managedStore.id, name },
        { onSuccess: () => setManagedStore(null) },
      );
    },
    [managedStore, renameStore],
  );

  const archiveManagedStore = useCallback(() => {
    if (!managedStore) return;
    archiveStore.mutate(managedStore.id, { onSuccess: () => setManagedStore(null) });
  }, [managedStore, archiveStore]);

  return {
    activeRuns,
    createStoreRun,
    createRun,
    stores: storesQuery.data ?? [],
    managedStore,
    setManagedStore,
    renameManagedStore,
    archiveManagedStore,
    storeBusy: renameStore.isPending || archiveStore.isPending,
    /* `storesQuery` намеренно НЕ в `queries`: барьер первого экрана ждёт то,
       без чего экран показывать нельзя, а подсказки нужны только в шторке. */
    queries: { runsQuery },
  };
}
