/**
 * Сценарий голосования на главной: какой опрос показываем и что с ним можно
 * сделать.
 *
 * Собран из восьми хуков, которые в теле `HomePage` шли вперемешку с бюджетом,
 * закупками и расписанием (задача 12). Вынесены вместе, потому что связаны
 * одним значением — `activePoll`: от него зависят и подписка на живые
 * обновления, и свои голоса, и все четыре мутации.
 *
 * Возвращаются ОБЪЕКТЫ запросов (`deepLinkQuery`, `activeQuery`, ...), а не
 * только данные: барьер первого экрана спрашивает у них «ответ получен?», и
 * распаковка потеряла бы различие между «ответ есть» и «данные есть».
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { getDeepLinkPollId } from '@/lib/telegram';
import { queryKeys } from '@/lib/queryClient';
import { isSameLocalDay } from '@/lib/date';
import {
  useActivePoll,
  useCancelPoll,
  useCompletePoll,
  useLastCompletedPoll,
  useMyVotes,
  usePollById,
  usePollResults,
  useVote,
  useWithdrawVote,
} from '@/hooks/usePolls';
import { useSSE } from '@/hooks/useSSE';

export function useHomePoll() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  /* Deep link читается один раз за жизнь экрана: он приходит из параметров
     запуска Mini App и по ходу работы не меняется. */
  const deepLinkPollId = useMemo(() => getDeepLinkPollId(), []);
  const deepLinkQuery = usePollById(deepLinkPollId);
  const { data: deepLinkPoll, isLoading: deepLinkLoading } = deepLinkQuery;
  const activeQuery = useActivePoll();
  const { data: fallbackActivePoll, isLoading: activeLoading, error } = activeQuery;

  /* Опрос из ссылки ВЫТЕСНЯЕТ активный, и `?? null` здесь принципиален: ссылка
     на удалённый или чужой опрос не должна молча подмениться активным — иначе
     голос уйдёт не в то голосование, которое человек открыл. */
  const activePoll = deepLinkPollId ? deepLinkPoll ?? null : fallbackActivePoll;
  const pollLoading = deepLinkPollId ? deepLinkLoading : activeLoading;

  useEffect(() => {
    if (deepLinkPollId && deepLinkPoll && deepLinkPoll.status !== 'ACTIVE') {
      navigate(`/poll/${deepLinkPollId}/results`, { replace: true });
    }
  }, [deepLinkPollId, deepLinkPoll, navigate]);

  const { data: myVotesData } = useMyVotes(activePoll?.id ?? null);
  const voteMutation = useVote();
  const withdrawMutation = useWithdrawVote();
  const completePoll = useCompletePoll();
  const cancelPoll = useCancelPoll();

  /* Подписка идёт в том же рендере, что и сам опрос: если id появится позже,
     живые обновления «иногда не приходят» — жалоба, которая не
     воспроизводится. */
  useSSE({ pollId: activePoll?.id ?? null, enabled: !!activePoll });

  const lastCompletedQuery = useLastCompletedPoll();
  const lastCompletedPoll = lastCompletedQuery.data;
  /* Итог показываем только за текущие сутки: вчерашний победитель на главной
     уже неинформативен. Сам запрос оставляем — он нужен для повтора опроса. */
  const winnerIsFresh = isSameLocalDay(
    lastCompletedPoll?.endedAt ?? lastCompletedPoll?.closedAt ?? lastCompletedPoll?.createdAt,
  );
  const resultsQuery = usePollResults(winnerIsFresh ? lastCompletedPoll?.id ?? null : null);

  const onPollExpire = useCallback(() => {
    // серверный статус — истина: по нулю таймера только рефетчим
    qc.invalidateQueries({ queryKey: queryKeys.polls.active });
  }, [qc]);

  const retryActivePoll = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.polls.active });
  }, [qc]);

  return {
    deepLinkPollId,
    activePoll,
    pollLoading,
    error,
    myChoiceId: myVotesData?.menuItemIds?.[0] ?? null,
    lastCompletedPoll,
    lastPollResult: resultsQuery.data,
    winnerIsFresh,
    voteMutation,
    withdrawMutation,
    completePoll,
    cancelPoll,
    onPollExpire,
    retryActivePoll,
    /* Для барьера — целые запросы. */
    queries: { deepLinkQuery, activeQuery, lastCompletedQuery, resultsQuery },
  };
}
