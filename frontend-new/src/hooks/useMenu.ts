import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService, type UpsertMenuItemInput } from '@/services/menu.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { MenuItem } from '@/types/models';

function errMsg(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string; code?: string } }; message?: string };
  const code = e?.response?.data?.code;
  if (code === 'ACCESS_DENIED') return 'Доступ запрещён: нужны права администратора';
  if (code === 'NOT_AUTHENTICATED') return 'Не авторизованы — перезапустите Mini App';
  return e?.response?.data?.error || e?.message || fallback;
}

export function useMenuItems(options?: { activeOnly?: boolean; groupId?: string | null }) {
  const authStatus = useAppStore((s) => s.authStatus);
  const activeOnly = options?.activeOnly ?? false;
  const groupId = options?.groupId ?? null;
  const baseKey = activeOnly ? queryKeys.menu.active : queryKeys.menu.all;
  return useQuery({
    // groupId в ключе: меню per-group, явная группа не должна делить кэш с текущей
    queryKey: groupId ? [...baseKey, groupId] : baseKey,
    queryFn: async () => {
      const res = activeOnly
        ? await menuService.getActive(groupId ?? undefined)
        : await menuService.getAll(groupId ?? undefined);
      return (res.data ?? []) as MenuItem[];
    },
    enabled: authStatus === 'authenticated',
    staleTime: 30_000,
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось добавить блюдо') }),
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось обновить блюдо') }),
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
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось удалить блюдо') }),
  });
}

export function useToggleMenuItem() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (id: number) => menuService.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.all });
      qc.invalidateQueries({ queryKey: queryKeys.menu.active });
    },
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось переключить блюдо') }),
  });
}
