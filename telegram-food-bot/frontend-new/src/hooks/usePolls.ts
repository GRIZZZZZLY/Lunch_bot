import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsService, type CreatePollFromWebappInput } from '@/services/polls.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { Poll } from '@/types/models';

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useActivePolls() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: queryKeys.polls.active,
    queryFn: async () => {
      const res = await pollsService.getActive();
      return (res.data ?? []) as Poll[];
    },
    enabled: authStatus === 'authenticated',
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

export function useActivePoll() {
  const q = useActivePolls();
  return { ...q, data: q.data?.[0] ?? null };
}

export function usePollById(pollId: number | null) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: pollId ? queryKeys.polls.byId(pollId) : ['polls', 'byId', 'noop'],
    queryFn: async () => {
      if (!pollId) return null;
      const res = await pollsService.getById(pollId);
      return (res.data ?? null) as Poll | null;
    },
    enabled: !!pollId && authStatus === 'authenticated',
  });
}

export function useLastCompletedPoll() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: ['polls', 'last-completed'],
    queryFn: async () => {
      const res = await pollsService.getLastCompleted();
      return (res.data ?? null) as Poll | null;
    },
    enabled: authStatus === 'authenticated',
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function usePollResults(pollId: number | null) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: pollId ? queryKeys.polls.results(pollId) : ['polls', 'results', 'noop'],
    queryFn: async () => {
      if (!pollId) return null;
      const res = await pollsService.getResults(pollId);
      return res.data ?? null;
    },
    enabled: !!pollId && authStatus === 'authenticated',
  });
}

export function useMyVotes(pollId: number | null) {
  return useQuery({
    queryKey: pollId ? queryKeys.polls.myVotes(pollId) : ['polls', 'my-votes', 'noop'],
    queryFn: async () => {
      if (!pollId) return { menuItemIds: [] as number[] };
      const res = await pollsService.getMyVotes(pollId);
      return res.data ?? { menuItemIds: [] };
    },
    enabled: !!pollId,
  });
}

export function useVote() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ pollId, menuItemId }: { pollId: number; menuItemId: number }) =>
      pollsService.vote(pollId, menuItemId),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      qc.invalidateQueries({ queryKey: queryKeys.polls.byId(vars.pollId) });
      qc.invalidateQueries({ queryKey: queryKeys.polls.myVotes(vars.pollId) });
      pushToast({ type: 'success', message: 'Голос учтён' });
    },
    onError: (err) => {
      pushToast({ type: 'error', message: errMsg(err, 'Не удалось проголосовать') });
    },
  });
}

export function useCreatePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePollFromWebappInput) => pollsService.createFromWebapp(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      qc.invalidateQueries({ queryKey: ['polls', 'last-completed'] });
    },
  });
}

export function useWithdrawVote() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (pollId: number) => pollsService.withdrawVote(pollId),
    onSuccess: (_res, pollId) => {
      qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      qc.invalidateQueries({ queryKey: queryKeys.polls.myVotes(pollId) });
      pushToast({ type: 'info', message: 'Голос снят' });
    },
    onError: (err) => {
      pushToast({ type: 'error', message: errMsg(err, 'Не удалось снять голос') });
    },
  });
}
