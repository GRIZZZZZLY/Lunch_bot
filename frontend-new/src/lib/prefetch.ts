/* Запросы первого экрана стартуют до React.

   Раньше они начинались в эффектах хуков, то есть после монтирования: запись с
   телефона показала четыре ответа, растянутых на 280ms, и экран собирался
   четырьмя толчками. Барьер Главной складывает их в одно событие, но барьер
   ждёт самого медленного — поэтому ждать надо начинать раньше, а не дольше.

   Ключи и queryFn берём из тех же фабрик, что и хуки страницы. Разойдутся —
   предзагрузка будет греть соседнюю ячейку кэша, барьер этого не заметит и
   всё равно уйдёт в сеть. */
import { queryClient } from './queryClient';
import { isSameLocalDay } from './date';
import { useAppStore } from '@/store/useAppStore';
import {
  activePollsQueryOptions,
  lastCompletedPollQueryOptions,
  pollResultsQueryOptions,
} from '@/hooks/usePolls';
import { menuItemsQueryOptions } from '@/hooks/useMenu';
import { creditsQueryOptions, debtsQueryOptions } from '@/hooks/useBudget';
import { activeStoreRunsQueryOptions } from '@/hooks/useStoreRun';

export function prefetchFirstScreen(): void {
  const state = useAppStore.getState();
  if (state.authStatus !== 'authenticated') return;

  /* Команда уже разрешена в bootstrapAuth ДО перевода статуса в
     authenticated, поэтому здесь она известна. Тот же аргумент уходит в
     фабрики, что и в хуках, — иначе предзагрелась бы соседняя ячейка кэша.
     Без команды греть нечего: командные запросы с null не выполняются. */
  const groupId = state.currentGroupId;
  if (groupId === null) return;

  /* Предзагрузка спекулятивна: отказ гасим молча, настоящий запрос повторит
     хук и покажет ошибку сам. */
  const swallow = () => undefined;
  const warm = (options: Parameters<typeof queryClient.prefetchQuery>[0]) =>
    queryClient.prefetchQuery(options).catch(swallow);

  /* Меню Главная просит без группы — тем же вызовом, что и здесь. Передать сюда
     currentGroupId значило бы греть другой ключ. */
  warm(menuItemsQueryOptions());
  warm(activePollsQueryOptions(groupId));
  warm(debtsQueryOptions(groupId));
  warm(creditsQueryOptions(groupId));
  warm(activeStoreRunsQueryOptions(groupId));

  /* Единственная цепочка: итог прошлого голосования известен только после
     самого голосования. Она и давала последний, четвёртый толчок — строку
     «Победил» внутри уже показанной карточки. Свежесть проверяем так же, как
     Главная: за результатом вчерашнего опроса идти незачем. */
  queryClient
    .fetchQuery(lastCompletedPollQueryOptions(groupId))
    .then((poll) => {
      const fresh = isSameLocalDay(poll?.endedAt ?? poll?.closedAt ?? poll?.createdAt);
      if (poll?.id && fresh) warm(pollResultsQueryOptions(poll.id));
    })
    .catch(swallow);
}
