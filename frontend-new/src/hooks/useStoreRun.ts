import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  storeRunService,
  type AddItemInput,
  type CreateStoreRunPayload,
  type SetPricePayload,
  type StoreRunWithRelations,
  type UpdateItemInput,
} from '@/services/store-run.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { apiErrorMessage } from '@/lib/apiError';

/* Опции отдельно от хука: их берёт предзагрузка первого экрана
   (lib/prefetch.ts). */
export function activeStoreRunsQueryOptions() {
  return {
    queryKey: queryKeys.storeRuns.active(),
    queryFn: async () => {
      const res = await storeRunService.getActive();
      return res.data ?? [];
    },
    staleTime: 15_000,
  };
}

export function useActiveStoreRuns() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    ...activeStoreRunsQueryOptions(),
    enabled: authStatus === 'authenticated',
    refetchInterval: 30_000,
  });
}

export function useStoreRun(id: number | null | undefined, live = false) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: queryKeys.storeRuns.detail(id ?? 0),
    queryFn: async () => {
      if (!id) return null;
      const res = await storeRunService.getRun(id);
      return res.data ?? null;
    },
    enabled: !!id && authStatus === 'authenticated',
    staleTime: 10_000,
    /* Пока живёт поток событий, опрос не нужен. Он остаётся страховкой на
       случай, когда поток в вебвью Telegram не поднялся: молчащий экран
       закупки хуже лишнего запроса. */
    refetchInterval: (query) => {
      if (live) return false;
      const data = query.state.data;
      if (!data) return 30_000;
      return data.status === 'SETTLED' || data.status === 'CANCELLED' ? false : 15_000;
    },
  });
}

export function useCreateStoreRun() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (payload: CreateStoreRunPayload) => storeRunService.createRun(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
      push({ type: 'success', message: 'Закупка создана' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось создать закупку') }),
  });
}

export function useAddStoreItems(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (items: AddItemInput[]) => storeRunService.addItems(runId, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось добавить позицию') }),
  });
}

/* Правка и удаление позиции применяются оптимистично: это правки на месте,
   откат к снимку возвращает список целиком. Переходы статуса забега
   (start-shopping / settle / cancel) оптимистики НЕ получают сознательно — они
   меняют весь экран, и показать не тот экран, а потом отобрать, хуже честного
   спиннера на подтверждённом действии.
   Владелец мутаций — CollectingView, который живёт дольше своих строк. */
export function useUpdateStoreItem(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const key = queryKeys.storeRuns.detail(runId);
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdateItemInput }) =>
      storeRunService.updateItem(runId, itemId, data),
    onMutate: async ({ itemId, data }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StoreRunWithRelations | null>(key);
      qc.setQueryData<StoreRunWithRelations | null>(key, (old) =>
        old ? { ...old, items: old.items.map((i) => (i.id === itemId ? { ...i, ...data } : i)) } : old,
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.previous);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось изменить позицию') });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteStoreItem(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const key = queryKeys.storeRuns.detail(runId);
  return useMutation({
    mutationFn: (itemId: number) => storeRunService.deleteItem(runId, itemId),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StoreRunWithRelations | null>(key);
      qc.setQueryData<StoreRunWithRelations | null>(key, (old) =>
        old ? { ...old, items: old.items.filter((i) => i.id !== itemId) } : old,
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.previous);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось удалить позицию') });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/* Отметка позиции применяется оптимистично: в магазине связь слабая, а ждать
   round-trip на каждой покупке — половина сценария. Отказ откатывает список к
   снимку и говорит вслух: без тоста строка просто вернулась бы в прежний
   статус, и инициатор считал бы позицию отмеченной.
   ВАЖНО: наблюдатель этой мутации должен жить дольше строки — оптимистичное
   обновление сразу переносит строку в другую секцию, она размонтируется, и
   привязанные к ней колбэки отката уже не сработают. Поэтому хук вызывается
   на уровне ShoppingView, а не внутри ShoppingItemRow. */
export function useSetItemPrice(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const key = queryKeys.storeRuns.detail(runId);
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: SetPricePayload }) =>
      storeRunService.setItemPrice(runId, itemId, payload),
    onMutate: async ({ itemId, payload }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StoreRunWithRelations | null>(key);
      qc.setQueryData<StoreRunWithRelations | null>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((i) =>
                i.id === itemId ? { ...i, status: payload.status, price: payload.price } : i,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.previous);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось сохранить отметку') });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useStartShopping(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: () => storeRunService.startShopping(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
      push({ type: 'info', message: 'Сбор закрыт — идём в магазин' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось закрыть сбор') }),
  });
}

export function useSettleStoreRun(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: () => storeRunService.settle(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
      qc.invalidateQueries({ queryKey: ['budget'] });
      push({ type: 'success', message: 'Закупка рассчитана' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось рассчитать закупку') }),
  });
}

export function useCancelStoreRun(runId: number) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: () => storeRunService.cancel(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
      push({ type: 'info', message: 'Закупка отменена' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отменить закупку') }),
  });
}
