import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { buildTeamActivity, type ActivityByTeam } from '@/lib/teamActivity';
import { pollsService } from '@/services/polls.service';
import { storeRunService } from '@/services/store-run.service';
import { useAppStore } from '@/store/useAppStore';
import type { Poll } from '@/types/models';

/**
 * Что идёт во всех командах человека: по одному запросу голосований и
 * закупок без `groupId` — сервер тогда отвечает по всем его командам.
 *
 * `null` — ответа ещё нет или запрос упал: плашка тогда молчит, а не
 * выдумывает «тихо».
 */
export function useTeamActivity(enabled: boolean): ActivityByTeam | null {
  const authed = useAppStore((s) => s.authStatus) === 'authenticated';
  const on = enabled && authed;
  const polls = useQuery({
    queryKey: queryKeys.polls.activeAllTeams,
    queryFn: async () => ((await pollsService.getActiveAllTeams()).data ?? []) as Poll[],
    enabled: on,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const runs = useQuery({
    queryKey: queryKeys.storeRuns.activeAllTeams(),
    queryFn: async () => (await storeRunService.getActiveAllTeams()).data ?? [],
    enabled: on,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const failed = polls.isError || runs.isError;
  return useMemo(
    () => (!failed && polls.data && runs.data ? buildTeamActivity(polls.data, runs.data) : null),
    [failed, polls.data, runs.data],
  );
}
