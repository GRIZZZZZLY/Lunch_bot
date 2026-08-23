/**
 * Что именно держит первый экран главной.
 *
 * Общее правило барьера («приехало» = `isSuccess || isError`, потолок ожидания,
 * каскад только если экран действительно ждал) живёт в
 * `useFirstScreenBarrier` — там же его история. Здесь СОСТАВ: девять запросов
 * четырёх сценариев, которые обязаны ответить, прежде чем экран покажут целиком.
 *
 * Состав отделён от правила намеренно: добавление запроса на главную — это
 * правка одной строки здесь, а не поход в общий механизм.
 */
import { useDelayedLoading } from '@/shared/lib/useDelayedLoading';
import { arrived, useFirstScreenBarrier, type BarrierQuery } from './useFirstScreenBarrier';

interface HomeQueries {
  authLoading: boolean;
  /** Опрос: по deep link или активный — ждём тот, который показываем. */
  deepLinkPollId: number | null;
  deepLinkQuery: BarrierQuery;
  activeQuery: BarrierQuery;
  lastCompletedQuery: BarrierQuery;
  resultsQuery: BarrierQuery;
  /** Ожидается ли итог: у отключённого запроса ответа не будет никогда. */
  winnerExpected: boolean;
  menuQuery: BarrierQuery;
  groupsQuery: BarrierQuery;
  debtsQuery: BarrierQuery;
  creditsQuery: BarrierQuery;
  runsQuery: BarrierQuery;
}

export function useHomeFirstScreen(queries: HomeQueries) {
  const pollArrived = queries.deepLinkPollId
    ? arrived(queries.deepLinkQuery)
    : arrived(queries.activeQuery);

  const ready =
    !queries.authLoading &&
    pollArrived &&
    arrived(queries.lastCompletedQuery) &&
    (!queries.winnerExpected || arrived(queries.resultsQuery)) &&
    arrived(queries.menuQuery) &&
    arrived(queries.groupsQuery) &&
    arrived(queries.debtsQuery) &&
    arrived(queries.creditsQuery) &&
    arrived(queries.runsQuery);

  const { revealed, waitedForData } = useFirstScreenBarrier(ready);

  /* Окно молчания короче общего: 100ms вместо 180. Причина из записи: ответ
     приходит ~330ms после монтирования, и при 180ms скелет не успевал
     появиться — на месте контента была пустота, а потом он вставал рывком.
     Ожидание длиннее трёх кадров надо объяснять, а не прятать. Мелькнуть
     скелет не может — минимальное время жизни у него своё. */
  const showSkeleton = useDelayedLoading(!revealed, 100);

  return { revealed, waitedForData, showSkeleton };
}
