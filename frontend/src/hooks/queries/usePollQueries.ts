import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { pollsService } from '../../services/polls.service';
import { queryKeys } from '../../lib/react-query';
import { useToast } from '../../components/common/toast-context';

/**
 * Хук для получения активного голосования в группе
 */
export const useActivePoll = (groupId?: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.polls.active(groupId),
    queryFn: async () => {
      if (!groupId) return null;
      const response = await pollsService.getActivePollInGroup(groupId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch active poll');
      }
      return response.data;
    },
    enabled: !!groupId && (options?.enabled ?? true),
    staleTime: 1000 * 30, // 30 секунд - активное голосование обновляется часто
  });
};

/**
 * Хук для получения конкретного голосования
 */
export const usePoll = (pollId: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.polls.detail(pollId),
    queryFn: async () => {
      const response = await pollsService.getPollById(pollId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch poll');
      }
      return response.data;
    },
    enabled: !!pollId && (options?.enabled ?? true),
  });
};

/**
 * Хук для получения результатов голосования
 */
export const usePollResults = (pollId: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.polls.results(pollId),
    queryFn: async () => {
      const response = await pollsService.getPollResults(pollId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch poll results');
      }
      return response.data;
    },
    enabled: !!pollId && (options?.enabled ?? true),
  });
};

/**
 * Хук для получения истории голосований с пагинацией
 */
export const usePollHistory = (params?: { limit?: number }) => {
  return useInfiniteQuery({
    queryKey: queryKeys.polls.history(params),
    queryFn: async ({ pageParam = 0 }) => {
      const response = await pollsService.getPollHistory({
        limit: params?.limit || 20,
        offset: pageParam,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch poll history');
      }
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasNext) return undefined;
      return allPages.length * (params?.limit || 20);
    },
  });
};

/**
 * Хук для создания голосования
 */
export const useCreatePoll = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (data: {
      groupId: number;
      selectedMenuItems: number[];
      duration: number;
      title?: string;
      description?: string;
    }) => {
      const response = await pollsService.createPollFromWebApp(data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create poll');
      }
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Инвалидация активных голосований
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.active(variables.groupId) 
      });
      
      // Инвалидация истории
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.history() 
      });
      
      toast.success('Голосование успешно создано!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при создании голосования: ${error.message}`);
    },
  });
};

/**
 * Хук для голосования
 */
export const useVote = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ pollId, menuItemId }: { pollId: number; menuItemId: number }) => {
      const response = await pollsService.voteForItem(pollId, menuItemId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to vote');
      }
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Обновляем данные голосования
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.detail(variables.pollId) 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.results(variables.pollId) 
      });
      
      toast.success('Твой голос учтён!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при голосовании: ${error.message}`);
    },
  });
};

/**
 * Хук для отмены голоса
 */
export const useRemoveVote = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (pollId: number) => {
      const response = await pollsService.removeVote(pollId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to remove vote');
      }
      return response.data;
    },
    onSuccess: (_data, pollId) => {
      // Обновляем данные голосования
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.detail(pollId) 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.results(pollId) 
      });
      
      toast.success('Голос отменён!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при отмене голоса: ${error.message}`);
    },
  });
};

/**
 * Хук для завершения голосования
 */
export const useCompletePoll = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (pollId: number) => {
      const response = await pollsService.completePoll(pollId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to complete poll');
      }
      return response.data;
    },
    onSuccess: (_data, pollId) => {
      // Обновляем данные голосования
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.detail(pollId) 
      });
      
      // Обновляем активное голосование
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.active() 
      });
      
      // Обновляем историю
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.history() 
      });
      
      toast.success('Голосование завершено!');
    },
    onError: (error: Error) => {
      toast.error(`Ошибка при завершении голосования: ${error.message}`);
    },
  });
};

/**
 * Хук для префетча голосования
 */
export const usePrefetchPoll = () => {
  const queryClient = useQueryClient();

  return (pollId: number) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.polls.detail(pollId),
      queryFn: async () => {
        const response = await pollsService.getPollById(pollId);
        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch poll');
        }
        return response.data;
      },
    });
  };
};
