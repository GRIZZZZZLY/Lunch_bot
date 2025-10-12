/**
 * React Query hooks для Polls API
 * P1 Task: Кеширование + Optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { pollsService, type PollWithDetails } from '@/services/polls.service';
// @ts-ignore - useNotification not exported
// import { useNotification } from '@/store/useAppStore';

/**
 * Hook для получения активных polls
 * 
 * @param options - опции query
 * @returns { data, isLoading, error, refetch }
 * 
 * @example
 * ```tsx
 * const { data: polls, isLoading } = useActivePolls();
 * ```
 */
export function useActivePolls(options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.polls.active(),
    queryFn: async () => {
      const response = await pollsService.getActivePolls();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch active polls');
      }
      return response.data;
    },
    // Auto-refresh каждые 10 секунд (опционально)
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook для получения детальной информации о poll
 * 
 * @param pollId - ID poll
 * @param silent - тихая загрузка без loader (для refresh)
 * @returns { data: poll, isLoading, error, refetch }
 * 
 * @example
 * ```tsx
 * const { data: poll } = usePoll(123);
 * ```
 */
export function usePoll(pollId: number | undefined, silent = false) {
  return useQuery({
    queryKey: queryKeys.polls.detail(pollId!),
    queryFn: async () => {
      const response = await pollsService.getPollById(pollId!);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch poll');
      }
      return response.data;
    },
    enabled: !!pollId,
    // Для silent refresh можно изменить staleTime
    staleTime: silent ? 0 : 5 * 60 * 1000,
  });
}

/**
 * Hook для голосования с optimistic update
 * 
 * @returns { mutate, isLoading, error }
 * 
 * @example
 * ```tsx
 * const { mutate: vote, isPending } = useVote();
 * 
 * vote({ pollId: 123, menuItemId: 456 }, {
 *   onSuccess: () => console.log('Voted!'),
 * });
 * ```
 */
export function useVote() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  return useMutation({
    mutationFn: async ({ 
      pollId, 
      menuItemId 
    }: { 
      pollId: number; 
      menuItemId: number;
    }) => {
      const response = await pollsService.voteForItem(pollId, menuItemId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to vote');
      }
      return response.data;
    },
    
    // Optimistic update: обновляем UI сразу, до ответа сервера
    onMutate: async ({ pollId, menuItemId }) => {
      // Отменяем pending queries для этого poll
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.polls.detail(pollId) 
      });

      // Сохраняем предыдущее состояние для rollback
      const previousPoll = queryClient.getQueryData<PollWithDetails>(
        queryKeys.polls.detail(pollId)
      );

      // Optimistically обновляем UI
      if (previousPoll) {
        queryClient.setQueryData<PollWithDetails>(
          queryKeys.polls.detail(pollId),
          (old) => {
            if (!old) return old;
            
            // Добавляем голос пользователя
            const updatedVotes = [
              ...(old.votes || []),
              {
                id: Date.now(), // temporary ID
                menuItemId,
                pollId,
                userId: 0, // will be updated from server
                createdAt: new Date().toISOString(),
                user: {} as any,
              },
            ];

            return {
              ...old,
              votes: updatedVotes,
              _count: {
                ...old._count,
                votes: (old._count?.votes || 0) + 1,
              },
            };
          }
        );
      }

      // Возвращаем context для rollback
      return { previousPoll };
    },

    // Если ошибка - откатываем изменения
    onError: (error, variables, context) => {
      if (context?.previousPoll) {
        queryClient.setQueryData(
          queryKeys.polls.detail(variables.pollId),
          context.previousPoll
        );
      }

      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ошибка при голосовании',
      });
    },

    // После успешного голосования - обновляем данные с сервера
    onSuccess: (data, variables) => {
      // Invalidate poll detail для точного обновления
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.detail(variables.pollId) 
      });
      
      // Также обновляем список активных polls
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.active() 
      });
    },
  });
}

/**
 * Hook для создания нового poll
 * 
 * @example
 * ```tsx
 * const { mutate: createPoll } = useCreatePoll();
 * 
 * createPoll({
 *   menuItemIds: [1, 2, 3],
 *   duration: 30,
 * });
 * ```
 */
export function useCreatePoll() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  return useMutation({
    mutationFn: async (data: { menuItemIds: number[]; duration?: number }) => {
      const response = await pollsService.createPoll(
        data.menuItemIds,
        data.duration
      );
      if (!response.success) {
        throw new Error(response.error || 'Failed to create poll');
      }
      return response.data;
    },
    onSuccess: () => {
      // Обновляем список активных polls
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.active() 
      });
      
      addNotification({
        type: 'success',
        message: 'Голосование создано',
      });
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ошибка создания голосования',
      });
    },
  });
}

/**
 * Hook для закрытия poll
 * 
 * @example
 * ```tsx
 * const { mutate: closePoll } = useClosePoll();
 * closePoll(123);
 * ```
 */
export function useClosePoll() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  return useMutation({
    mutationFn: async (pollId: number) => {
      const response = await pollsService.closePoll(pollId);
      if (!response.success) {
        throw new Error(response.error || 'Failed to close poll');
      }
      return response.data;
    },
    onSuccess: (data, pollId) => {
      // Обновляем poll detail
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.detail(pollId) 
      });
      
      // Обновляем список активных polls
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.polls.active() 
      });
      
      addNotification({
        type: 'success',
        message: 'Голосование завершено',
      });
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ошибка завершения голосования',
      });
    },
  });
}

/**
 * Hook для получения истории polls
 */
export function usePollHistory() {
  return useQuery({
    queryKey: queryKeys.polls.history(),
    queryFn: async () => {
      const response = await pollsService.getPollHistory();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch poll history');
      }
      return response.data;
    },
  });
}

/**
 * Hook для получения статистики пользователя
 */
export function useUserStats(userId?: number) {
  return useQuery({
    queryKey: queryKeys.user.votes(userId!),
    queryFn: async () => {
      const response = await pollsService.getUserParticipationStats();
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user stats');
      }
      return response.data;
    },
    enabled: !!userId,
  });
}
