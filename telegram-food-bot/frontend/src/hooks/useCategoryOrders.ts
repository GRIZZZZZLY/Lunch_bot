import { useQuery } from '@tanstack/react-query';
import { categoryOrderService } from '@/services/category-order.service';
import { useAuth } from '@/hooks/useAuth';
import type { CategoryOrder } from '@/services/category-order.service';

/**
 * Polling интервалы (fallback при обрыве SSE).
 * SSE — основной канал real-time обновлений (useSSE в usePoll).
 * Polling остаётся как страховка с увеличенными интервалами.
 */
const FAST_STATUS_REFETCH_MS = 10_000;
const NORMAL_STATUS_REFETCH_MS = 30_000;
const BURST_STATUS_REFETCH_MS = 2_000;
const BURST_WINDOW_MS = 2 * 60 * 1000;

const isResolvedSelection = (selectionStatus: CategoryOrder['selectionStatus']) =>
  selectionStatus === 'SELECTED_AUTO' ||
  selectionStatus === 'SELECTED_VOLUNTEER' ||
  selectionStatus === 'SELECTED_ROULETTE';

const hasActiveCategoryFlow = (orders: CategoryOrder[] | undefined): boolean => {
  if (!orders) {
    return true;
  }

  return orders.some(
    order =>
      order.calculationStatus !== 'COMPLETED' ||
      order.selectionStatus === 'PENDING' ||
      order.selectionStatus === 'VOLUNTEER_OPEN'
  );
};

const isRecentIsoDate = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= BURST_WINDOW_MS;
};

const hasRecentCategoryActivity = (orders: CategoryOrder[] | undefined): boolean => {
  return (orders || []).some(
    order => isRecentIsoDate(order.updatedAt) || isRecentIsoDate(order.createdAt)
  );
};

/**
 * Hook to fetch CategoryOrders for a poll
 */
export function useCategoryOrders(
  pollId: number | null | undefined,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  const enabled = options?.enabled ?? !!pollId;
  const refetchInterval = options?.refetchInterval;

  return useQuery<CategoryOrder[]>({
    queryKey: ['categoryOrders', pollId],
    queryFn: async () => {
      if (!pollId) {
        throw new Error('Poll ID is required');
      }

      const response = await categoryOrderService.getCategoryOrdersForPoll(pollId);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch category orders');
      }

      return response.data || [];
    },
    enabled,
    staleTime: 10000, // 10 seconds
    refetchInterval: (query) => {
      const status = (query.state.error as { status?: number } | null)?.status;
      if (status === 429) return false;
      if (typeof refetchInterval === 'number') {
        return refetchInterval;
      }

      if (hasRecentCategoryActivity(query.state.data)) {
        return BURST_STATUS_REFETCH_MS;
      }

      return hasActiveCategoryFlow(query.state.data)
        ? FAST_STATUS_REFETCH_MS
        : NORMAL_STATUS_REFETCH_MS;
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const status = (error as { status?: number } | null)?.status;
      if (status === 429) return false;
      return failureCount < 2;
    },
    retryDelay: 2000,
  });
}

/**
 * Hook to fetch a single CategoryOrder by ID
 */
export function useCategoryOrder(categoryOrderId: number | null | undefined) {
  return useQuery<CategoryOrder>({
    queryKey: ['categoryOrder', categoryOrderId],
    queryFn: async () => {
      if (!categoryOrderId) {
        throw new Error('Category Order ID is required');
      }

      const response = await categoryOrderService.getCategoryOrder(categoryOrderId);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch category order');
      }

      if (!response.data) {
        throw new Error('Category order is empty');
      }
      return response.data;
    },
    enabled: !!categoryOrderId,
    staleTime: 5000, // 5 seconds
    refetchInterval: (query) => {
      const status = (query.state.error as { status?: number } | null)?.status;
      if (status === 429) return false;
      if (query.state.data?.calculationStatus !== 'COMPLETED') {
        if (isRecentIsoDate(query.state.data?.updatedAt) || isRecentIsoDate(query.state.data?.createdAt)) {
          return BURST_STATUS_REFETCH_MS;
        }

        return FAST_STATUS_REFETCH_MS;
      }

      return NORMAL_STATUS_REFETCH_MS;
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const status = (error as { status?: number } | null)?.status;
      if (status === 429) return false;
      return failureCount < 2;
    },
    retryDelay: 2000,
  });
}

/**
 * Hook to get the user's CategoryOrder for a poll (if they are responsible)
 */
export function useUserCategoryOrder(pollId: number | null | undefined) {
  const { user } = useAuth();

  const categoryOrdersQuery = useCategoryOrders(pollId, {
    enabled: !!pollId && !!user?.id,
  });

  return {
    ...categoryOrdersQuery,
    data:
      user?.id && categoryOrdersQuery.data
        ?
            categoryOrdersQuery.data.find(
              co =>
                co.responsibleUserId === user.id &&
                isResolvedSelection(co.selectionStatus)
            ) || null
        : null,
  };
}

/**
 * Hook to get CategoryOrder(s) where user is a participant
 */
export function useParticipantCategoryOrders(pollId: number | null | undefined) {
  const { user } = useAuth();

  return useQuery<CategoryOrder[]>({
    queryKey: ['categoryOrders', 'my', pollId, user?.id],
    queryFn: async () => {
      if (!pollId) {
        throw new Error('Poll ID is required');
      }

      const response = await categoryOrderService.getMyCategoryOrdersForPoll(pollId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch participant category orders');
      }

      return response.data;
    },
    enabled: !!pollId && !!user?.id,
    staleTime: 10000,
    refetchInterval: (query) => {
      const status = (query.state.error as { status?: number } | null)?.status;
      if (status === 429) return false;

      if (hasRecentCategoryActivity(query.state.data)) {
        return BURST_STATUS_REFETCH_MS;
      }

      return hasActiveCategoryFlow(query.state.data)
        ? FAST_STATUS_REFETCH_MS
        : NORMAL_STATUS_REFETCH_MS;
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const status = (error as { status?: number } | null)?.status;
      if (status === 429) return false;
      return failureCount < 2;
    },
    retryDelay: 2000,
  });
}

/**
 * Hook to check if user is responsible for any category in a poll
 */
export function useIsResponsibleForAnyCategory(pollId: number | null | undefined) {
  const userCategoryOrder = useUserCategoryOrder(pollId);
  
  return {
    isResponsible: !!userCategoryOrder.data,
    categoryOrder: userCategoryOrder.data,
    isLoading: userCategoryOrder.isLoading,
    error: userCategoryOrder.error,
  };
}
