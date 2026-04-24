import { useMemo } from 'react';
import { usePollHistory } from './useUser';
import { useAuth } from './useAuth';
import { buildInsights, buildOverview } from '@/lib/statsMappers';
import type { StatsData } from '@/components/stats/types';

export function useStats(): { data: StatsData; isLoading: boolean } {
  const { user, isLoading: authLoading } = useAuth();
  const { data: polls = [], isLoading: historyLoading } = usePollHistory({ limit: 60 });

  const data = useMemo<StatsData>(() => {
    if (authLoading || historyLoading) return { isLoading: true };
    if (polls.length === 0) return { isEmpty: true };
    const overview = buildOverview(polls, { userId: user?.id ?? null });
    const insights = buildInsights(polls);
    return {
      overview: overview ?? undefined,
      insights: insights ?? undefined,
    };
  }, [polls, user?.id, authLoading, historyLoading]);

  return { data, isLoading: authLoading || historyLoading };
}
