import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../../services/user.service';
import { queryKeys } from '../../lib/react-query';
import { useToast } from '../../components/common/ToastManager';

/**
 * Хук для получения текущего пользователя
 */
export const useCurrentUser = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.user.me(),
    queryFn: async () => {
      const response = await userService.getCurrentUser();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user');
      }
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 минут - данные пользователя меняются редко
    ...options,
  });
};

/**
 * Хук для получения платёжной информации пользователя
 */
export const usePaymentInfo = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.user.paymentInfo(),
    queryFn: async () => {
      const response = await userService.getPaymentInfo();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch payment info');
      }
      return response.data;
    },
    ...options,
  });
};

/**
 * Хук для получения групп пользователя
 */
export const useUserGroups = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.user.groups(),
    queryFn: async () => {
      const response = await userService.getUserGroups();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user groups');
      }
      return response.data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 минут
    ...options,
  });
};

/**
 * Хук для обновления платёжной информации
 */
export const useUpdatePaymentInfo = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (data: {
      paymentCard?: string;
      paymentPhone?: string;
      paymentDetails?: string;
    }) => {
      const response = await userService.updatePaymentInfo(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update payment info');
      }
      return response.data;
    },
    onMutate: async (_newData) => {
      // Отменяем исходящие запросы
      await queryClient.cancelQueries({ queryKey: queryKeys.user.paymentInfo() });
      
      // Получаем предыдущее значение
      const previousPaymentInfo = queryClient.getQueryData(queryKeys.user.paymentInfo());
      
      // Optimistic update
      queryClient.setQueryData(queryKeys.user.paymentInfo(), _newData);
      
      return { previousPaymentInfo };
    },
    onSuccess: (data) => {
      // Обновляем кэш
      queryClient.setQueryData(queryKeys.user.paymentInfo(), data);
      
      // Инвалидация данных пользователя
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
      
      toast.success('Платёжная информация обновлена!');
    },
    onError: (error: Error, newData, context) => {
      // Откат optimistic update
      if (context?.previousPaymentInfo) {
        queryClient.setQueryData(
          queryKeys.user.paymentInfo(),
          context.previousPaymentInfo
        );
      }
      
      toast.error(`Ошибка при обновлении: ${error.message}`);
    },
  });
};

/**
 * Хук для префетча данных пользователя
 */
export const usePrefetchUser = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.user.me(),
      queryFn: async () => {
        const response = await userService.getCurrentUser();
        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch user');
        }
        return response.data;
      },
    });
  };
};
