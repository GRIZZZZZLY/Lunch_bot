import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  storeRunService,
  type AddItemInput,
  type CreateStoreRunPayload,
  type SetPricePayload,
  type UpdateItemInput,
} from '../../services/store-run.service';
import { queryKeys } from '../../lib/react-query';

/**
 * Активные магазинные забеги для текущего пользователя.
 * Используется на HomePage в секции ActiveStoreRunsSection.
 */
export const useActiveStoreRuns = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.storeRuns.active(),
    queryFn: async () => {
      const response = await storeRunService.getActive();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch active store runs');
      }
      return response.data ?? [];
    },
    enabled: options?.enabled ?? true,
    // Забеги короткие (3-30 мин) — чаще обновляем
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
};

/**
 * Один магазинный забег по id (с участниками и позициями).
 */
export const useStoreRun = (id: number | null | undefined, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.storeRuns.detail(id ?? 0),
    queryFn: async () => {
      if (!id) return null;
      const response = await storeRunService.getRun(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch store run');
      }
      return response.data ?? null;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 10 * 1000,
    refetchInterval: (query) => {
      // Опросы останавливаем, когда забег завершён
      const data = query.state.data;
      if (!data) return 30 * 1000;
      return data.status === 'SETTLED' || data.status === 'CANCELLED'
        ? false
        : 15 * 1000;
    },
  });
};

/**
 * Создать новый забег.
 */
export const useCreateStoreRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStoreRunPayload) => storeRunService.createRun(payload),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
    },
  });
};

/**
 * Добавить пакет позиций.
 */
export const useAddStoreItems = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: AddItemInput[]) => storeRunService.addItems(runId, items),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
    },
  });
};

/**
 * Изменить свою позицию (name/quantity/notes).
 */
export const useUpdateStoreItem = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdateItemInput }) =>
      storeRunService.updateItem(runId, itemId, data),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
    },
  });
};

/**
 * Удалить свою позицию.
 */
export const useDeleteStoreItem = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => storeRunService.deleteItem(runId, itemId),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
    },
  });
};

/**
 * Инициатор: проставить цену и статус позиции.
 */
export const useSetItemPrice = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: SetPricePayload }) =>
      storeRunService.setItemPrice(runId, itemId, payload),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
    },
  });
};

/**
 * Инициатор: ранний переход COLLECTING -> SHOPPING.
 */
export const useStartShopping = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => storeRunService.startShopping(runId),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
    },
  });
};

/**
 * Инициатор: финализировать забег, создать транзакции.
 */
export const useSettleStoreRun = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => storeRunService.settle(runId),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
      // После SETTLED обновляем BudgetWidget — появляются новые долги
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
};

/**
 * Инициатор: отменить забег (только в COLLECTING).
 */
export const useCancelStoreRun = (runId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => storeRunService.cancel(runId),
    onSuccess: (response) => {
      if (!response.success) return;
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) });
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
    },
  });
};
