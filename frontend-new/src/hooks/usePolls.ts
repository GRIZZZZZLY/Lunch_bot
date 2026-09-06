import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsService, type CreatePollFromWebappInput } from '@/services/polls.service';
import { queryKeys, type GroupKey } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { Poll } from '@/types/models';
import { apiErrorMessage } from '@/lib/apiError';

/* Опции отдельно от хуков: их же берёт предзагрузка первого экрана
   (lib/prefetch.ts). Ключ и queryFn должны быть общими, иначе предзагрузка
   греет соседнюю ячейку кэша и барьер всё равно ждёт сеть.

   `groupId` — аргумент, а не чтение стора внутри: фабрику вызывают и хук
   (подписанный на currentGroupId), и предзагрузка (до React). Общий аргумент
   гарантирует, что оба попадут в одну ячейку кэша. */
export function activePollsQueryOptions(groupId: GroupKey) {
  return {
    queryKey: queryKeys.polls.activeForGroup(groupId),
    queryFn: async () => {
      const res = await pollsService.getActive(groupId ?? undefined);
      return (res.data ?? []) as Poll[];
    },
    staleTime: 0,
  };
}

export function useActivePolls() {
  const authStatus = useAppStore((s) => s.authStatus);
  const groupId = useAppStore((s) => s.currentGroupId);
  return useQuery({
    ...activePollsQueryOptions(groupId),
    /* Без команды запрос не идёт: раньше он уходил без `groupId` и получал
       активные голосования всех команд человека, а Главная брала первое из
       списка — то есть могла показать голосование не той команды. */
    enabled: authStatus === 'authenticated' && !!groupId,
    refetchInterval: 30_000,
  });
}

/**
 * Активное голосование выбранной команды.
 *
 * `[0]` осмысленно именно из-за области: в одной команде активное голосование
 * не больше одного (`getActivePollInGroup` на сервере). До сужения по команде
 * это был «первый из всех команд», то есть произвольная команда.
 */
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

/* Группа сюда уходила НЕЯВНО — её подмешивал `buildUrl` из стора, — а ключ её
   не содержал. После переключения команды экран показывал вчерашний итог
   прежней команды как свой. */
export function lastCompletedPollQueryOptions(groupId: GroupKey) {
  return {
    queryKey: queryKeys.polls.lastCompletedForGroup(groupId),
    queryFn: async () => {
      const res = await pollsService.getLastCompleted(groupId ?? undefined);
      return (res.data ?? null) as Poll | null;
    },
    staleTime: 10_000,
  };
}

export function useLastCompletedPoll() {
  const authStatus = useAppStore((s) => s.authStatus);
  const groupId = useAppStore((s) => s.currentGroupId);
  return useQuery({
    ...lastCompletedPollQueryOptions(groupId),
    enabled: authStatus === 'authenticated' && !!groupId,
    refetchInterval: 15_000,
  });
}

export function pollResultsQueryOptions(pollId: number) {
  return {
    queryKey: queryKeys.polls.results(pollId),
    queryFn: async () => {
      const res = await pollsService.getResults(pollId);
      return res.data ?? null;
    },
  };
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
      pushToast({ type: 'error', message: apiErrorMessage(err, 'Не удалось проголосовать') });
    },
  });
}

export function useCreatePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePollFromWebappInput) => pollsService.createFromWebapp(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      qc.invalidateQueries({ queryKey: queryKeys.polls.lastCompleted });
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
      pushToast({ type: 'error', message: apiErrorMessage(err, 'Не удалось снять голос') });
    },
  });
}

function invalidatePollLifecycle(qc: ReturnType<typeof useQueryClient>, pollId: number) {
  qc.invalidateQueries({ queryKey: queryKeys.polls.active });
  qc.invalidateQueries({ queryKey: queryKeys.polls.byId(pollId) });
  qc.invalidateQueries({ queryKey: queryKeys.polls.lastCompleted });
}

/** Admin: close the poll now (runs roulette / picks winner). */
export function useCompletePoll() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (pollId: number) => pollsService.complete(pollId),
    onSuccess: (_res, pollId) => {
      invalidatePollLifecycle(qc, pollId);
      pushToast({ type: 'success', message: 'Голосование закрыто' });
    },
    onError: (err) => {
      pushToast({ type: 'error', message: apiErrorMessage(err, 'Не удалось закрыть голосование') });
    },
  });
}

/** Admin: cancel the poll (no winner). */
export function useCancelPoll() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ pollId, reason }: { pollId: number; reason?: string }) =>
      pollsService.cancel(pollId, reason),
    onSuccess: (_res, vars) => {
      invalidatePollLifecycle(qc, vars.pollId);
      pushToast({ type: 'info', message: 'Голосование отменено' });
    },
    onError: (err) => {
      pushToast({ type: 'error', message: apiErrorMessage(err, 'Не удалось отменить голосование') });
    },
  });
}
