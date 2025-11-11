import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suggestionService, CreateSuggestionData, MenuSuggestion } from '../services/suggestion.service';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook для получения списка предложений
 */
export function useSuggestions(params?: {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['suggestions', params],
    queryFn: async () => {
      const response = await suggestionService.getSuggestions(params);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch suggestions');
      }
      return response.data;
    },
    staleTime: 30000, // 30 seconds
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

  return useMutation({
    mutationFn: async (data: CreateSuggestionData) => {
      const response = await suggestionService.createSuggestion(data);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create suggestion');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
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

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await suggestionService.approveSuggestion(id);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to approve suggestion');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
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

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const response = await suggestionService.rejectSuggestion(id, reason);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to reject suggestion');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
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
  return useQuery({
    queryKey: ['suggestion-stats'],
    queryFn: async () => {
      const response = await suggestionService.getStats();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch stats');
      }
      return response.data;
    },
  });
}

/**
 * Hook для получения количества ожидающих предложений (только админ)
 */
export function usePendingCount() {
  const user = useAppStore((state) => state.user);
  
  return useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      const response = await suggestionService.getPendingCount();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch pending count');
      }
      return response.data.count;
    },
    enabled: !!user?.isAdmin, // Only run for admins
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook для удаления предложения (только админ)
 */
export function useDeleteSuggestion() {
  const queryClient = useQueryClient();
  const addNotification = useAppStore((state) => state.addNotification);

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await suggestionService.deleteSuggestion(id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete suggestion');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['suggestion-stats'] });
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
