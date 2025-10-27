/**
 * React Query hooks для Payment Info API
 * Предотвращает смешивание данных между пользователями
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { userService, type PaymentInfo } from '@/services/user.service';
import { useUI } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook для получения платёжной информации пользователя
 * Использует userId из текущей сессии для предотвращения смешивания данных
 */
export function usePaymentInfo() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.user.paymentInfo(user?.id || 0),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const response = await userService.getPaymentInfo();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch payment info');
      }

      return response.data || {
        paymentCard: null,
        paymentPhone: null,
        paymentDetails: null,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000, // 10 минут
  });
}

/**
 * Hook для обновления платёжной информации
 */
export function useUpdatePaymentInfo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addNotification } = useUI();

  return useMutation({
    mutationFn: async (data: PaymentInfo) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const response = await userService.updatePaymentInfo(data);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update payment info');
      }

      return response.data;
    },

    onSuccess: (data) => {
      // Обновить кэш с данными сервера
      if (user?.id) {
        queryClient.setQueryData(
          queryKeys.user.paymentInfo(user.id),
          data
        );
      }
      // Не показываем уведомление для автосохранения
    },

    onError: (error) => {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ошибка при сохранении',
      });
    },

    retry: 1,
  });
}
