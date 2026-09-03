/**
 * Личный список товаров на экране добавления позиции.
 *
 * Закрепление и удаление применяются оптимистично: обе правки видны в одной
 * строке, и ожидание сервера на каждый тап по звёздочке ощущается как залипание.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { itemPresetService, type ItemPreset } from '@/services/item-preset.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { apiErrorMessage } from '@/lib/apiError';

export function useItemPresets(storeId: number | null | undefined, enabled = true) {
  const authStatus = useAppStore((s) => s.authStatus);
  const key = storeId ?? null;
  return useQuery({
    queryKey: queryKeys.itemPresets.list(key),
    queryFn: async (): Promise<ItemPreset[]> => {
      const res = await itemPresetService.list(key);
      return res.data ?? [];
    },
    enabled: enabled && authStatus === 'authenticated',
    staleTime: 30_000,
  });
}

export function useUpdateItemPreset(storeId: number | null | undefined) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const key = queryKeys.itemPresets.list(storeId ?? null);

  return useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      itemPresetService.update(id, { pinned }),
    onMutate: async ({ id, pinned }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ItemPreset[]>(key);
      qc.setQueryData<ItemPreset[]>(key, (list) =>
        list?.map((preset) => (preset.id === id ? { ...preset, pinned } : preset)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось изменить товар') });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.itemPresets.all }),
  });
}

export function useRemoveItemPreset(storeId: number | null | undefined) {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const key = queryKeys.itemPresets.list(storeId ?? null);

  return useMutation({
    mutationFn: (id: number) => itemPresetService.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ItemPreset[]>(key);
      qc.setQueryData<ItemPreset[]>(key, (list) => list?.filter((preset) => preset.id !== id));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось удалить товар') });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.itemPresets.all }),
  });
}
