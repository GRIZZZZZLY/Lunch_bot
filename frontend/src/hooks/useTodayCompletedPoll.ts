import { useQuery } from '@tanstack/react-query';
import { pollsService } from '../services/polls.service';
import { queryKeys } from '../lib/queryClient';

/**
 * Хук для получения завершённого голосования сегодня
 */
export const useTodayCompletedPoll = (groupId: number | undefined, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.polls.todayCompleted(groupId || 0),
    queryFn: async () => {
      if (!groupId) return null;
      
      const response = await pollsService.getTodayCompletedPoll(groupId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch today completed poll');
      }
      
      return response.data;
    },
    enabled: enabled && !!groupId,
    staleTime: 30 * 1000, // 30 секунд
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchOnWindowFocus: true,
  });
};
