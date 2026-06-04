import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  storeRunService,
  type AddItemInput,
  type CreateStoreRunPayload,
  type SetPricePayload,
  type UpdateItemInput,
} from '@/services/store-run.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useActiveStoreRuns() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: queryKeys.storeRuns.active(),
    queryFn: async () => {
      const res = await storeRunService.getActive();
      return res.data ?? [];
    },
    enabled: authStatus === 'authenticated',
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useStoreRun(id: number | null | undefined) {
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
    refetchInterval: (query) => {
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось создать закупку') }),
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось добавить позицию') }),
  });
}

export function useUpdateStoreItem(runId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: UpdateItemInput }) =>
      storeRunService.updateItem(runId, itemId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) }),
  });
}

export function useDeleteStoreItem(runId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => storeRunService.deleteItem(runId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) }),
  });
}

export function useSetItemPrice(runId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: SetPricePayload }) =>
      storeRunService.setItemPrice(runId, itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(runId) }),
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось закрыть сбор') }),
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось рассчитать закупку') }),
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось отменить закупку') }),
  });
}
