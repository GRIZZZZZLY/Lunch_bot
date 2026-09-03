/**
 * Подсказки магазинов для формы новой закупки.
 *
 * Отдельный хук, а не поле в useStoreRun: список живёт дольше отдельной закупки
 * и нужен экрану, на котором закупки ещё нет.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { groupStoreService, type GroupStore } from '@/services/group-store.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { apiErrorMessage } from '@/lib/apiError';

export function useGroupStores(groupId: number | null | undefined) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: queryKeys.groupStores.list(groupId ?? 0),
    queryFn: async (): Promise<GroupStore[]> => {
      if (!groupId) return [];
      const res = await groupStoreService.list(groupId);
      return res.data ?? [];
    },
    enabled: !!groupId && authStatus === 'authenticated',
    /* Справочник меняется редко и только руками: минута свежести избавляет от
       запроса на каждое открытие шторки. */
    staleTime: 60_000,
  });
}

export function useRenameGroupStore(groupId: number | null | undefined) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ storeId, name }: { storeId: number; name: string }) =>
      groupStoreService.rename(groupId ?? 0, storeId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.groupStores.list(groupId ?? 0) });
      /* Переименование подтягивает активные закупки: их заголовок меняется
         вместе с магазином. */
      qc.invalidateQueries({ queryKey: queryKeys.storeRuns.all });
    },
    onError: (err) =>
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось переименовать магазин') }),
  });
}

export function useArchiveGroupStore(groupId: number | null | undefined) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (storeId: number) => groupStoreService.archive(groupId ?? 0, storeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.groupStores.list(groupId ?? 0) });
    },
    onError: (err) =>
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось скрыть магазин') }),
  });
}
