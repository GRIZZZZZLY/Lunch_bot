import { useMemo } from 'react';
import { PROFILE_HISTORY_LIMIT, usePollHistory } from './useUser';
import { useAuth } from './useAuth';
import { computeStreak, type StreakInfo } from '@/lib/streakCalc';

export function useStreak(): { streak: StreakInfo; isLoading: boolean } {
  const { user, isLoading: authLoading } = useAuth();
  const { data: polls = [], isLoading: historyLoading } = usePollHistory({ limit: PROFILE_HISTORY_LIMIT });

  const streak = useMemo(
    () => computeStreak(polls, user?.id ?? null),
    [polls, user?.id],
  );

  return { streak, isLoading: authLoading || historyLoading };
}
