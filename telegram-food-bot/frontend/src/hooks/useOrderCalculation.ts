import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  categoryOrderService,
  OrderItem,
  SaveOrderItemData,
  UpdateCostsData,
} from '@/services/category-order.service';
import { useToast } from '@/components/common/toast-context';

interface UseOrderCalculationOptions {
  categoryOrderId: number;
  autoSaveDelay?: number; // milliseconds
}

/**
 * Hook for managing order calculation with autosave
 */
export function useOrderCalculation({
  categoryOrderId,
  autoSaveDelay = 500,
}: UseOrderCalculationOptions) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const autoSaveTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const inFlightSavesRef = useRef<Map<number, number>>(new Map());
  const [pendingSaves, setPendingSaves] = useState<Set<number>>(new Set());
  const pendingSavesRef = useRef<Set<number>>(new Set());

  const clearPendingIfIdle = (userId: number) => {
    const hasScheduledSave = autoSaveTimeoutsRef.current.has(userId);
    const hasInFlightSave = inFlightSavesRef.current.has(userId);
    if (!hasScheduledSave && !hasInFlightSave) {
      pendingSavesRef.current.delete(userId);
      setPendingSaves((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const waitForPendingSaves = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        const hasScheduled = autoSaveTimeoutsRef.current.size > 0;
        const hasInFlight = inFlightSavesRef.current.size > 0;
        if (!hasScheduled && !hasInFlight) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }, []);

  // Fetch progress (not used for UI validation anymore, only for backend verification)
  const {
    data: progress,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: ['calculationProgress', categoryOrderId],
    queryFn: async () => {
      const response = await categoryOrderService.getProgress(categoryOrderId);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch progress');
      }

      return response.data;
    },
    staleTime: 30000, // 30 seconds - not critical anymore
    // Removed refetchInterval - we use client-side validation now
  });

  // Fetch order items
  const {
    data: orderItems,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['orderItems', categoryOrderId],
    queryFn: async () => {
      const response = await categoryOrderService.getOrderItems(categoryOrderId);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch order items');
      }

      return response.data;
    },
    staleTime: 5000,
  });

  // Save order item mutation
  const saveOrderItemMutation = useMutation({
    mutationFn: async (data: SaveOrderItemData) => {
      const response = await categoryOrderService.saveOrderItem(
        categoryOrderId,
        data
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to save order item');
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<OrderItem[]>(
        ['orderItems', categoryOrderId],
        (current) => {
          if (!current || current.length === 0) {
            return data ? [data] : current;
          }

          const index = current.findIndex((item) => item.userId === data?.userId);
          if (index === -1) {
            return data ? [...current, data] : current;
          }

          const next = [...current];
          if (data) {
            next[index] = data;
          }

          return next;
        }
      );

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ['calculationProgress', categoryOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['categoryOrder', categoryOrderId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить заказ'
      );
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;

      const current = inFlightSavesRef.current.get(variables.userId) ?? 0;
      if (current <= 1) {
        inFlightSavesRef.current.delete(variables.userId);
      } else {
        inFlightSavesRef.current.set(variables.userId, current - 1);
      }

      clearPendingIfIdle(variables.userId);
    },
  });
  const saveOrderItem = saveOrderItemMutation.mutate;

  // Autosave function with debounce
  const autoSave = useCallback(
    (data: SaveOrderItemData) => {
      // Add to pending saves
      pendingSavesRef.current.add(data.userId);
      setPendingSaves((prev) => new Set(prev).add(data.userId));

      const timeouts = autoSaveTimeoutsRef.current;
      const existingTimeout = timeouts.get(data.userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        timeouts.delete(data.userId);
        const current = inFlightSavesRef.current.get(data.userId) ?? 0;
        inFlightSavesRef.current.set(data.userId, current + 1);
        saveOrderItem(data);
      }, autoSaveDelay);

      timeouts.set(data.userId, timeout);
    },
    [autoSaveDelay, saveOrderItem]
  );

  // Delete order item mutation
  const deleteOrderItemMutation = useMutation({
    mutationFn: async (orderItemId: number) => {
      const response = await categoryOrderService.deleteOrderItem(orderItemId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete order item');
      }
    },
    onSuccess: (_data, orderItemId) => {
      queryClient.setQueryData<OrderItem[]>(
        ['orderItems', categoryOrderId],
        (current) =>
          current ? current.filter((item) => item.id !== orderItemId) : current
      );

      queryClient.invalidateQueries({
        queryKey: ['calculationProgress', categoryOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['categoryOrder', categoryOrderId],
      });

      toast.success('Заказ удален');
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось удалить заказ'
      );
    },
  });

  // Update costs mutation
  const updateCostsMutation = useMutation({
    mutationFn: async (costs: UpdateCostsData) => {
      const response = await categoryOrderService.updateCosts(
        categoryOrderId,
        costs
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update costs');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['categoryOrder', categoryOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['calculationProgress', categoryOrderId],
      });

      // Убрали toast - это silent autosave, не нужно уведомлять каждый раз
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось обновить расходы'
      );
    },
  });

  // Finalize calculation mutation
  const finalizeCalculationMutation = useMutation({
    mutationFn: async () => {
      // Wait for all pending autosaves to complete before finalizing
      await waitForPendingSaves();

      const response = await categoryOrderService.finalizeCalculation(categoryOrderId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to finalize calculation');
      }

      return response.data || {
        transactionsCreated: 0,
        participantCount: 0,
        orderItemsCount: 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['categoryOrder', categoryOrderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['budget'],
      });

      if (data?.transactionsCreated === 0) {
        if (
          data?.participantCount &&
          data?.orderItemsCount !== undefined &&
          data.participantCount > 1
        ) {
          toast.warning(
            `Расчет завершен, но транзакций нет: ${data.orderItemsCount}/${data.participantCount} заказов`
          );
        } else {
          toast.info('Расчет завершен. Участников для оплаты нет');
        }
      } else {
        toast.success('Расчет завершен, суммы отправлены участникам');
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось завершить расчет'
      );
    },
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      autoSaveTimeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      autoSaveTimeoutsRef.current.clear();
    };
  }, []);

  return {
    // Data
    progress,
    orderItems,
    pendingSaves,
    
    // Loading states
    isLoading: progressLoading || itemsLoading,
    isSaving: saveOrderItemMutation.isPending,
    isDeleting: deleteOrderItemMutation.isPending,
    isUpdatingCosts: updateCostsMutation.isPending,
    isFinalizing: finalizeCalculationMutation.isPending,
    
    // Actions
    autoSave,
    saveOrderItem: saveOrderItemMutation.mutate,
    deleteOrderItem: deleteOrderItemMutation.mutate,
    updateCosts: updateCostsMutation.mutate,
    finalizeCalculation: finalizeCalculationMutation.mutate,
    waitForPendingSaves,
    
    // Refetch functions
    refetchProgress,
    refetchItems,
  };
}
