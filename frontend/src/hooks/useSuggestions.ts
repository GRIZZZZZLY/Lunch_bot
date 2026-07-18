import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suggestionService, CreateSuggestionData } from '../services/suggestion.service';
import { useAppStore } from '../store/useAppStore';
import { useIsGroupAdmin } from './useIsGroupAdmin';
import { useCurrentGroup } from './useCurrentGroup';

/**
 * Hook для получения списка предложений
 */
export function useSuggestions(params?: {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  limit?: number;
  offset?: number;
  groupId?: number;
}) {
  const { currentGroupId } = useCurrentGroup();
  const requestParams = {
    ...params,
    ...(currentGroupId ? { groupId: currentGroupId } : {}),
  };

  return useQuery({
    queryKey: ['suggestions', requestParams],
    queryFn: async () => {
      const response = await suggestionService.getSuggestions(requestParams);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch suggestions');
      }
      return response.data;
    },
    staleTime: 0, // No caching - always fresh data for real-time updates
    refetchInterval: 10000, // Refetch every 10 seconds as backup
  });
}

/**
 * Hook для получения предложения по ID
 */
export function useSuggestion(id: number) {
  return useQuery({
    queryKey: ['suggestion', id],
    queryFn: async () => {
      const response = await suggestionService.getSuggestionById(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch suggestion');
      }
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Hook для создания предложения
 */
export function useCreateSuggestion() {
  const queryClient = useQueryClient();
  const addNotification = useAppStore((state) => state.addNotification);
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async (data: CreateSuggestionData) => {
      const response = await suggestionService.createSuggestion(
        currentGroupId ? { ...data, groupId: currentGroupId } : data
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create suggestion');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate ALL suggestion queries
      queryClient.invalidateQueries({ queryKey: ['suggestions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['suggestions'], exact: false });
      addNotification({
        type: 'success',
        message: 'Предложение отправлено на рассмотрение',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Ошибка при создании предложения',
      });
    },
  });
}

/**
 * Hook для одобрения предложения (только админ)
 */
export function useApproveSuggestion() {
  const queryClient = useQueryClient();
  const addNotification = useAppStore((state) => state.addNotification);
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await suggestionService.approveSuggestion(id, currentGroupId ?? undefined);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to approve suggestion');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate ALL suggestion queries (admin and user views)
      queryClient.invalidateQueries({ queryKey: ['suggestions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['suggestions'], exact: false });
      addNotification({
        type: 'success',
        message: 'Предложение одобрено и добавлено в меню',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Ошибка при одобрении предложения',
      });
    },
  });
}

/**
 * Hook для отклонения предложения (только админ)
 */
export function useRejectSuggestion() {
  const queryClient = useQueryClient();
  const addNotification = useAppStore((state) => state.addNotification);
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const response = await suggestionService.rejectSuggestion(id, reason, currentGroupId ?? undefined);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to reject suggestion');
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate ALL suggestion queries (admin and user views)
      queryClient.invalidateQueries({ queryKey: ['suggestions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['suggestions'], exact: false });
      addNotification({
        type: 'info',
        message: 'Предложение отклонено',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Ошибка при отклонении предложения',
      });
    },
  });
}

/**
 * Hook для получения статистики предложений (только админ)
 */
export function useSuggestionStats() {
  const { currentGroupId } = useCurrentGroup();

  return useQuery({
    queryKey: ['suggestion-stats', currentGroupId],
    queryFn: async () => {
      const response = await suggestionService.getStats(currentGroupId ?? undefined);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch stats');
      }
      return response.data;
    },
    enabled: !!currentGroupId,
    staleTime: 0, // No caching - always fresh data
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Hook для получения количества ожидающих предложений (только админ)
 */
export function usePendingCount() {
  const isGroupAdmin = useIsGroupAdmin();
  const { currentGroupId } = useCurrentGroup();

  return useQuery({
    queryKey: ['pending-count', currentGroupId],
    queryFn: async () => {
      const response = await suggestionService.getPendingCount(currentGroupId ?? undefined);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch pending count');
      }
      return response.data.count;
    },
    enabled: isGroupAdmin && !!currentGroupId,
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook для удаления предложения (только админ)
 */
export function useDeleteSuggestion() {
  const queryClient = useQueryClient();
  const addNotification = useAppStore((state) => state.addNotification);
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await suggestionService.deleteSuggestion(id, currentGroupId ?? undefined);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete suggestion');
      }
    },
    onSuccess: () => {
      // Invalidate ALL suggestion queries (admin and user views)
      queryClient.invalidateQueries({ queryKey: ['suggestions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['suggestions'], exact: false });
      addNotification({
        type: 'success',
        message: 'Предложение удалено',
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Ошибка при удалении предложения',
      });
    },
  });
}
