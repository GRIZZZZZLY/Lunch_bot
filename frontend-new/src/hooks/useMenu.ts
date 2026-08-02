import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService, type UpsertMenuItemInput } from '@/services/menu.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { MenuItem } from '@/types/models';
import { apiErrorMessage } from '@/lib/apiError';

/* Опции запроса отдельно от хука: их же берёт предзагрузка на простое
   (App.tsx). Дублировать ключ и queryFn нельзя — разойдутся, и предзагрузка
   станет тихо греть чужую ячейку кэша. */
export function menuItemsQueryOptions(options?: { activeOnly?: boolean; groupId?: string | null }) {
  const activeOnly = options?.activeOnly ?? false;
  const groupId = options?.groupId ?? null;
  const baseKey = activeOnly ? queryKeys.menu.active : queryKeys.menu.all;
  return {
    // groupId в ключе: меню per-group, явная группа не должна делить кэш с текущей
    queryKey: groupId ? [...baseKey, groupId] : baseKey,
    queryFn: async () => {
      const res = activeOnly
        ? await menuService.getActive(groupId ?? undefined)
        : await menuService.getAll(groupId ?? undefined);
      return (res.data ?? []) as MenuItem[];
    },
    staleTime: 30_000,
  };
}

export function useMenuItems(options?: { activeOnly?: boolean; groupId?: string | null }) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    ...menuItemsQueryOptions(options),
    enabled: authStatus === 'authenticated',
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ data, groupId }: { data: UpsertMenuItemInput; groupId?: string }) =>
      menuService.create(data, groupId),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.all });
      push({ type: 'success', message: `Блюдо «${vars.data.name}» добавлено` });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось добавить блюдо') }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, data, groupId }: { id: number; data: Partial<UpsertMenuItemInput>; groupId?: string }) =>
      menuService.update(id, data, groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.all });
      push({ type: 'success', message: 'Блюдо обновлено' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось обновить блюдо') }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, groupId }: { id: number; groupId?: string }) => menuService.remove(id, groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.all });
      push({ type: 'info', message: 'Блюдо удалено' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось удалить блюдо') }),
  });
}

export function useToggleMenuItem() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, groupId }: { id: number; groupId?: string }) => menuService.toggle(id, groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.all });
      qc.invalidateQueries({ queryKey: queryKeys.menu.active });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось переключить блюдо') }),
  });
}
