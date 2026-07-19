/**
 * React Query hooks для Polls API
 * P1 Task: Кеширование + Optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import {
  pollsService,
  type Poll,
  type PollWithDetails,
} from "@/services/polls.service";
import { useUI } from "@/store/useAppStore";
import { useSSE } from "./useSSE";
import { useCurrentGroup } from "./useCurrentGroup";

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
  return useQuery<Poll[]>({
    queryKey: queryKeys.polls.active(),
    queryFn: async () => {
      const response = await pollsService.getActivePolls();
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch active polls");
      }
      return response.data || [];
    },
    // Auto-refresh каждые 10 секунд (опционально)
    refetchInterval: (query) => {
      const status = (query.state.error as { status?: number } | null)?.status;
      if (status === 429) return false;
      return options?.refetchInterval;
    },
    retry: (failureCount, error) => {
      const status = (error as { status?: number } | null)?.status;
      if (status === 429) return false;
      return failureCount < 2;
    },
    retryDelay: 2000,
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
  // SSE подписка — real-time обновления через EventSource.
  // При получении события автоматически инвалидирует кеш polls.detail и polls.active.
  // Polling остаётся как fallback на случай обрыва SSE.
  useSSE({
    pollId,
    enabled: !!pollId,
  });

  return useQuery({
    queryKey: queryKeys.polls.detail(pollId!),
    queryFn: async () => {
      const response = await pollsService.getPollById(pollId!);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch poll");
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
  const { addNotification } = useUI();

  return useMutation({
    mutationFn: async ({
      pollId,
      menuItemId,
    }: {
      pollId: number;
      menuItemId: number;
    }) => {
      const response = await pollsService.voteForItem(pollId, menuItemId);
      if (!response.success) {
        throw new Error(response.error || "Failed to vote");
      }
      return response.data;
    },

    // Optimistic update: обновляем UI сразу, до ответа сервера
    onMutate: async ({ pollId, menuItemId }) => {
      // Отменяем pending queries для этого poll
      await queryClient.cancelQueries({
        queryKey: queryKeys.polls.detail(pollId),
      });

      // Сохраняем предыдущее состояние для rollback
      const previousPoll = queryClient.getQueryData<PollWithDetails>(
        queryKeys.polls.detail(pollId),
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
                user: {
                  id: 0,
                  firstName: "Ты",
                },
                menuItem: {
                  id: menuItemId,
                  name: "",
                },
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
          },
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
          context.previousPoll,
        );
      }

      addNotification({
        type: "error",
        message:
          error instanceof Error ? error.message : "Ошибка при голосовании",
      });
    },

    // После успешного голосования - обновляем данные с сервера
    onSuccess: (data, variables) => {
      // Invalidate poll detail для точного обновления
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.detail(variables.pollId),
      });

      // Также обновляем список активных polls
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.active(),
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
  const { addNotification } = useUI();
  const { currentGroupId } = useCurrentGroup();

  return useMutation({
    mutationFn: async (data: {
      menuItemIds: number[];
      duration?: number;
      groupId?: number;
    }) => {
      const resolvedGroupId = data.groupId ?? currentGroupId;
      if (!resolvedGroupId) {
        throw new Error("Группа не выбрана — невозможно создать голосование");
      }
      const response = await pollsService.createPoll({
        groupId: resolvedGroupId,
        duration: data.duration,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to create poll");
      }
      return response.data;
    },
    onSuccess: () => {
      // Обновляем список активных polls
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.active(),
      });

      addNotification({
        type: "success",
        message: "Голосование создано",
      });
    },
    onError: (error) => {
      addNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Ошибка создания голосования",
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
  const { addNotification } = useUI();

  return useMutation({
    mutationFn: async (pollId: number) => {
      const response = await pollsService.closePoll(pollId);
      if (!response.success) {
        throw new Error(response.error || "Failed to close poll");
      }
      return response.data;
    },
    onSuccess: (data, pollId) => {
      // Обновляем poll detail
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.detail(pollId),
      });

      // Обновляем список активных polls
      void queryClient.invalidateQueries({
        queryKey: queryKeys.polls.active(),
      });

      addNotification({
        type: "success",
        message: "Голосование завершено",
      });
    },
    onError: (error) => {
      addNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Ошибка завершения голосования",
      });
    },
  });
}

/**
 * Hook для отмены голосования (admin).
 * Переводит poll в CANCELLED. Используется, чтобы убрать застрявший
 * завершённый результат с главного экрана (виджет результата + ответственного).
 *
 * @example
 * ```tsx
 * const { mutate: cancelPoll } = useCancelPoll();
 * cancelPoll({ pollId: 123 });
 * ```
 */
export function useCancelPoll() {
  const queryClient = useQueryClient();
  const { addNotification } = useUI();

  return useMutation({
    mutationFn: async ({
      pollId,
      reason,
    }: {
      pollId: number;
      reason?: string;
    }) => {
      const response = await pollsService.cancelPoll(pollId, reason);
      if (!response.success) {
        throw new Error(response.error || "Failed to cancel poll");
      }
      return response.data;
    },
    onSuccess: () => {
      // Префикс ['polls'] инвалидирует active / today-completed / detail / history.
      void queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
      // Виджет ответственного/расчёта завязан на завершённый poll → обновляем бюджет.
      void queryClient.invalidateQueries({ queryKey: ["budget"] });

      addNotification({
        type: "success",
        message: "Голосование отменено",
      });
    },
    onError: (error) => {
      addNotification({
        type: "error",
        message:
          error instanceof Error ? error.message : "Ошибка отмены голосования",
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
        throw new Error(response.error || "Failed to fetch poll history");
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
        throw new Error(response.error || "Failed to fetch user stats");
      }
      return response.data;
    },
    enabled: !!userId,
  });
}
