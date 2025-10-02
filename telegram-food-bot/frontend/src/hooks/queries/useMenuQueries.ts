import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuService, MenuItem, CreateMenuItemData } from '../../services/menu.service';
import { queryKeys } from '../../lib/react-query';
import { useToast } from '../../components/common/ToastManager';

/**
 * Хук для получения всех блюд меню
 */
export const useMenuItems = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.menu.lists(),
    queryFn: async () => {
      const response = await menuService.getAllItems();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch menu items');
      }
      return response.data || [];
    },
    ...options,
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
 * Хук для получения категорий
 */
export const useMenuCategories = () => {
  return useQuery({
    queryKey: queryKeys.menu.categories(),
    queryFn: async () => {
      const response = await menuService.getCategories();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch categories');
      }
      return response.data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 минут - категории меняются редко
  });
};

/**
 * Хук для получения количества блюд по категориям
 */
export const useCategoryCounts = () => {
  const { data: menuItems } = useMenuItems();
  
  return useQuery({
    queryKey: queryKeys.menu.categoryCounts(),
    queryFn: async () => {
      // Вычисляем counts из menuItems
      if (!menuItems) return {};
      
      const counts: Record<string, number> = {};
      menuItems.forEach(item => {
        if (item.category) {
          counts[item.category] = (counts[item.category] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!menuItems,
  });
};

/**
 * Хук для создания блюда
 */
export const useCreateMenuItem = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (data: CreateMenuItemData) => {
      const response = await menuService.createItem(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create menu item');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Инвалидация кэша меню
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.categoryCounts() });
      
      toast.success('Блюдо успешно добавлено!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при создании блюда: ${error.message}`);
    },
  });
};

/**
 * Хук для обновления блюда
 */
export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateMenuItemData> }) => {
      const response = await menuService.updateItem(id, data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update menu item');
      }
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Обновляем конкретное блюдо в кэше
      queryClient.setQueryData(queryKeys.menu.detail(variables.id), data);
      
      // Инвалидация списка
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
      
      toast.success('Блюдо успешно обновлено!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при обновлении блюда: ${error.message}`);
    },
  });
};

/**
 * Хук для удаления блюда
 */
export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await menuService.deleteItem(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete menu item');
      }
      return id;
    },
    onSuccess: (id) => {
      // Удаляем из кэша
      queryClient.removeQueries({ queryKey: queryKeys.menu.detail(id) });
      
      // Инвалидация списка
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.categoryCounts() });
      
      toast.success('Блюдо успешно удалено!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при удалении блюда: ${error.message}`);
    },
  });
};

/**
 * Хук для переключения статуса блюда (активно/неактивно)
 */
export const useToggleMenuItemStatus = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await menuService.toggleItemStatus(id);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
      
      toast.success(`Блюдо ${data?.isActive ? 'активировано' : 'деактивировано'}!`);
    },
    onError: (error: Error, id, context) => {
      // Откат optimistic update
      if (context?.previousItem) {
        queryClient.setQueryData(queryKeys.menu.detail(id), context.previousItem);
      }
      
      toast.error(`Ошибка при изменении статуса: ${error.message}`);
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
