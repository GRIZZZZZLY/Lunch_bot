import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService, MenuItem, CreateMenuItemData } from '../../services/menu.service';
import { queryKeys } from '../../lib/react-query';
import { useCurrentGroup } from '../useCurrentGroup';

/**
 * Хук для получения всех блюд меню (per-group cache)
 */
export const useMenuItems = (options?: { enabled?: boolean }) => {
  const { currentGroupId } = useCurrentGroup();
  return useQuery({
    queryKey: queryKeys.menu.lists(currentGroupId ?? 0),
    queryFn: async () => {
      const response = await menuService.getAllItems(currentGroupId!);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch menu items');
      }
      return response.data || [];
    },
    enabled: !!currentGroupId && (options?.enabled ?? true),
  });
};

/**
 * Хук для получения одного блюда
 */
export const useMenuItem = (id: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.menu.detail(id),
    queryFn: async () => {
      const response = await menuService.getItemById(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch menu item');
      }
      return response.data;
    },
    enabled: !!id && (options?.enabled ?? true),
  });
};

/**
 * Хук для создания блюда
 */
export const useCreateMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { data: CreateMenuItemData; groupIds: number[] }) => {
      const response = await menuService.createItem(vars.data, vars.groupIds);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create menu item');
      }
      return response.data;
    },
    onSuccess: () => {
      // Блюдо могло быть создано в нескольких группах — инвалидируем все списки меню
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.all });
    },
    onError: (error: Error) => {
      console.error('[useCreateMenuItem] Error:', error.message);
    },
  });
};

/**
 * Хук для обновления блюда
 */
export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateMenuItemData> }) => {
      const response = await menuService.updateItem(id, data, currentGroupId!);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update menu item');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Обновляем конкретное блюдо в кэше
      queryClient.setQueryData(queryKeys.menu.detail(variables.id), data);

      // Инвалидация списка для текущей группы
      if (currentGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists(currentGroupId) });
      }

      console.log('[useUpdateMenuItem] Success:', data);
    },
    onError: (error: Error) => {
      console.error('[useUpdateMenuItem] Error:', error.message);
    },
  });
};

/**
 * Хук для удаления блюда
 */
export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient();
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await menuService.deleteItem(id, currentGroupId!);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete menu item');
      }
      return id;
    },
    onSuccess: (id) => {
      // Удаляем из кэша
      queryClient.removeQueries({ queryKey: queryKeys.menu.detail(id) });

      // Инвалидация списка для текущей группы
      if (currentGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists(currentGroupId) });
      }

      console.log('[useDeleteMenuItem] Success: item deleted', id);
    },
    onError: (error: Error) => {
      console.error('[useDeleteMenuItem] Error:', error.message);
    },
  });
};

/**
 * Хук для переключения статуса блюда (активно/неактивно)
 */
export const useToggleMenuItemStatus = () => {
  const queryClient = useQueryClient();
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await menuService.toggleItemStatus(id, currentGroupId!);
      if (!response.success) {
        throw new Error(response.error || 'Failed to toggle status');
      }
      return response.data;
    },
    onMutate: async (id) => {
      // Отменяем исходящие запросы
      await queryClient.cancelQueries({ queryKey: queryKeys.menu.detail(id) });

      // Получаем предыдущее значение
      const previousItem = queryClient.getQueryData<MenuItem>(queryKeys.menu.detail(id));

      // Optimistic update
      if (previousItem) {
        queryClient.setQueryData(queryKeys.menu.detail(id), {
          ...previousItem,
          isActive: !previousItem.isActive,
        });
      }

      return { previousItem };
    },
    onSuccess: (data, id) => {
      // Обновляем данные
      queryClient.setQueryData(queryKeys.menu.detail(id), data);
      if (currentGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists(currentGroupId) });
      }

      console.log(`[useToggleMenuItemStatus] Success: ${data?.isActive ? 'activated' : 'deactivated'}`, id);
    },
    onError: (error: Error, id, context) => {
      // Откат optimistic update
      if (context?.previousItem) {
        queryClient.setQueryData(queryKeys.menu.detail(id), context.previousItem);
      }

      console.error('[useToggleMenuItemStatus] Error:', error.message);
    },
  });
};

/**
 * Хук для префетча блюда (предзагрузка)
 */
export const usePrefetchMenuItem = () => {
  const queryClient = useQueryClient();

  return (id: number) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.menu.detail(id),
      queryFn: async () => {
        const response = await menuService.getItemById(id);
        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch menu item');
        }
        return response.data;
      },
    });
  };
};
