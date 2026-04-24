import { useMemo } from 'react';
import { usePollHistory } from './useUser';
import { useAuth } from './useAuth';
import { computeStreak, type StreakInfo } from '@/lib/streakCalc';

export function useStreak(): { streak: StreakInfo; isLoading: boolean } {
  const { user, isLoading: authLoading } = useAuth();
  const { data: polls = [], isLoading: historyLoading } = usePollHistory({ limit: 90 });

  const streak = useMemo(
    () => computeStreak(polls, user?.id ?? null),
    [polls, user?.id],
  );

  return { streak, isLoading: authLoading || historyLoading };
}
