/**
 * Голосование — основной сценарий продукта, и до задачи 11 у его хуков не было
 * ни одного теста.
 *
 * Проверяется то, что ломается молча и заметно пользователю:
 *
 * 1. Запросы не уходят до аутентификации. Хуки включены по `authStatus`; без
 *    этого первый рендер отправляет запросы без токена, получает 401 и уводит
 *    экран в переавторизацию на ровном месте.
 * 2. После голоса сбрасываются ИМЕННО те ключи, от которых зависит экран.
 *    Потеря любого — «проголосовал, а на экране старое».
 * 3. Опции запроса общие с предзагрузкой (`lib/prefetch.ts`): ключ и `queryFn`
 *    обязаны совпадать, иначе предзагрузка греет соседнюю ячейку кэша и барьер
 *    всё равно ждёт сеть.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useToastStore } from '@/store/useToastStore';

const h = vi.hoisted(() => ({
  getActive: vi.fn(),
  getById: vi.fn(),
  getLastCompleted: vi.fn(),
  getResults: vi.fn(),
  getMyVotes: vi.fn(),
  vote: vi.fn(),
  withdrawVote: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  createFromWebapp: vi.fn(),
  authStatus: 'authenticated' as string,
  /* Команда обязательна: командные запросы без неё не выполняются вовсе —
     иначе они уходили бы без groupId и получали данные всех команд. */
  currentGroupId: '100' as string | null,
}));

vi.mock('@/services/polls.service', () => ({
  pollsService: {
    getActive: h.getActive,
    getById: h.getById,
    getLastCompleted: h.getLastCompleted,
    getResults: h.getResults,
    getMyVotes: h.getMyVotes,
    vote: h.vote,
    withdrawVote: h.withdrawVote,
    complete: h.complete,
    cancel: h.cancel,
    createFromWebapp: h.createFromWebapp,
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (
    selector: (state: { authStatus: string; currentGroupId: string | null }) => unknown,
  ) => selector({ authStatus: h.authStatus, currentGroupId: h.currentGroupId }),
}));

import {
  activePollsQueryOptions,
  useActivePoll,
  useActivePolls,
  useCancelPoll,
  useCompletePoll,
  useCreatePoll,
  useLastCompletedPoll,
  useMyVotes,
  usePollById,
  usePollResults,
  useVote,
  useWithdrawVote,
} from '../usePolls';

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/* Ячейки кэша, от которых зависят экраны опроса. Активные лежат по командам
   под общим префиксом, плашка всех команд — тоже под ним. */
const KEY = {
  active: queryKeys.polls.activeForGroup('100'),
  activeAllTeams: queryKeys.polls.activeAllTeams,
  poll: queryKeys.polls.byId(42),
  myVotes: queryKeys.polls.myVotes(42),
  results: queryKeys.polls.results(42),
  lastCompleted: queryKeys.polls.lastCompletedForGroup('100'),
};
type CacheName = keyof typeof KEY;

function seedCache(): void {
  for (const key of Object.values(KEY)) qc.setQueryData(key, {});
}

/** Какие из засеянных ячеек мутация сбросила. */
function staleCells(): CacheName[] {
  return (Object.keys(KEY) as CacheName[]).filter(
    (name) => qc.getQueryState(KEY[name])?.isInvalidated,
  );
}

const lastToast = () => {
  const toasts = useToastStore.getState().toasts;
  return toasts[toasts.length - 1];
};

beforeEach(() => {
  for (const value of Object.values(h)) {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
  }
  h.authStatus = 'authenticated';
  h.currentGroupId = '100';
  h.getActive.mockResolvedValue({ data: [{ id: 42 }, { id: 41 }] });
  h.getById.mockResolvedValue({ data: { id: 42 } });
  h.getLastCompleted.mockResolvedValue({ data: { id: 40 } });
  h.getResults.mockResolvedValue({ data: { pollId: 42 } });
  h.getMyVotes.mockResolvedValue({ data: { menuItemIds: [7] } });
  h.vote.mockResolvedValue({ success: true });
  h.withdrawVote.mockResolvedValue({ success: true });
  h.complete.mockResolvedValue({ success: true });
  h.cancel.mockResolvedValue({ success: true });
  h.createFromWebapp.mockResolvedValue({ success: true });
  useToastStore.setState({ toasts: [] });

  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('чтение до аутентификации', () => {
  it.each([
    ['активные', () => useActivePolls(), () => h.getActive],
    ['последнее завершённое', () => useLastCompletedPoll(), () => h.getLastCompleted],
    ['по id', () => usePollById(42), () => h.getById],
    ['итоги', () => usePollResults(42), () => h.getResults],
  ])('%s не запрашивается, пока нет аутентификации', async (_label, hook, service) => {
    h.authStatus = 'unauthenticated';

    renderHook(hook as () => unknown, { wrapper });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(service()).not.toHaveBeenCalled();
  });

  it('после аутентификации активные запрашиваются', async () => {
    const { result } = renderHook(() => useActivePolls(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(h.getActive).toHaveBeenCalledTimes(1);
  });

  /* `pollId: null` — обычное состояние экрана: опрос ещё не выбран. Запрос при
     этом уходить не должен, но хук обязан отдать null, а не висеть в загрузке. */
  it('без id запрос не уходит', async () => {
    renderHook(() => usePollById(null), { wrapper });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(h.getById).not.toHaveBeenCalled();
  });
});

describe('форма ответа', () => {
  /* Сервер отдаёт `{ data }`, и пустой ответ обязан превратиться в пустой
     массив, а не в undefined: экраны делают `.map` сразу. */
  it('пустой ответ активных даёт пустой массив', async () => {
    h.getActive.mockResolvedValue({});

    const { result } = renderHook(() => useActivePolls(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('useActivePoll отдаёт первый из списка', async () => {
    const { result } = renderHook(() => useActivePoll(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ id: 42 }));
  });

  it('useActivePoll отдаёт null, когда активных нет', async () => {
    h.getActive.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useActivePoll(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('свои голоса без ответа — пустой список, а не undefined', async () => {
    h.getMyVotes.mockResolvedValue({});

    const { result } = renderHook(() => useMyVotes(42), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ menuItemIds: [] });
  });

  /* Общие опции для предзагрузки: прогретая ячейка обязана быть той же, что
     читает хук, иначе экран всё равно ждёт сеть. */
  it('предзагрузка греет ту же ячейку, что читает хук', async () => {
    await qc.prefetchQuery(activePollsQueryOptions('100'));

    const { result } = renderHook(() => useActivePolls(), { wrapper });

    // Первый же рендер отдаёт прогретые данные — без похода в сеть и скелета.
    expect(result.current.data).toEqual([{ id: 42 }, { id: 41 }]);
  });
});

describe('голос', () => {
  /* Голос в своей команде сбрасывает активные (ячейку команды и плашку всех
     команд — группа стоит в конце ключа, префикс задевает все), сам опрос с
     итогами и свои голоса. Потеря любого — «проголосовал, а на экране старое». */
  it('сбрасывает активные, сам опрос, свои голоса и итоги', async () => {
    seedCache();
    const { result } = renderHook(() => useVote(), { wrapper });

    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.vote).toHaveBeenCalledWith(42, 7);
    expect(staleCells()).toEqual(
      expect.arrayContaining(['active', 'activeAllTeams', 'poll', 'myVotes', 'results']),
    );
  });

  it('успех показывает подтверждение', async () => {
    const { result } = renderHook(() => useVote(), { wrapper });

    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(lastToast()?.type).toBe('success'));
  });

  /* Отказ обязан показать ПРИЧИНУ с сервера, а не общий текст: именно за этим
     заведён `apiErrorMessage` (задача 03 — почти половина кодов ошибок не имела
     текста, и пользователь читал «не удалось»). */
  it('отказ показывает причину сервера, а не общий текст', async () => {
    h.vote.mockRejectedValue({ code: 'POLL_ERROR', error: 'Poll is not active' });

    const { result } = renderHook(() => useVote(), { wrapper });
    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(lastToast()?.type).toBe('error');
    expect(lastToast()?.message).not.toBe('Не удалось проголосовать');
  });
});

describe('снятие голоса', () => {
  it('сбрасывает активные и свои голоса, но не итоги', async () => {
    seedCache();
    const { result } = renderHook(() => useWithdrawVote(), { wrapper });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staleCells()).toEqual(expect.arrayContaining(['active', 'myVotes']));
    expect(staleCells()).not.toContain('results');
    expect(lastToast()).toBeDefined();
  });
});

describe('администраторские действия', () => {
  /* Закрытие и отмена сбрасывают ОДИН И ТОТ ЖЕ набор: активные, сам опрос и
     «последнее завершённое» — последнее потому, что после закрытия именно этот
     опрос становится последним, и главный экран обязан его увидеть. */
  it.each([
    ['закрытие', () => useCompletePoll(), 42, 'success'],
    ['отмена', () => useCancelPoll(), { pollId: 42, reason: 'перенесли' }, 'info'],
  ])('%s сбрасывает жизненный цикл опроса', async (_label, hook, vars, type) => {
    seedCache();
    const { result } = renderHook(hook as () => ReturnType<typeof useCompletePoll>, {
      wrapper,
    });

    (result.current.mutate as (v: unknown) => void)(vars);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staleCells()).toEqual(expect.arrayContaining(['active', 'poll', 'results', 'lastCompleted']));
    expect(lastToast()?.type).toBe(type);
  });

  it('отмена передаёт причину сервису', async () => {
    const { result } = renderHook(() => useCancelPoll(), { wrapper });

    result.current.mutate({ pollId: 42, reason: 'перенесли обед' });

    await waitFor(() => expect(h.cancel).toHaveBeenCalledWith(42, 'перенесли обед'));
  });

  /* Создание не показывает тост: экран создания сам ведёт пользователя дальше,
     и второе сообщение поверх перехода мешало бы. */
  it('создание сбрасывает активные и последнее завершённое, без тоста', async () => {
    seedCache();
    const { result } = renderHook(() => useCreatePoll(), { wrapper });

    result.current.mutate({ groupId: 1, duration: 30 } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(staleCells()).toEqual(expect.arrayContaining(['active', 'lastCompleted']));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

/**
 * Изоляция команд.
 *
 * Ключ кэша активных голосований был `['polls','active']` — без команды. После
 * переключения react-query отдавал из кэша голосование ПРЕЖНЕЙ команды как
 * актуальное, потому что для него это был тот же самый запрос. Сам запрос при
 * этом уходил без `groupId` и получал активные голосования всех команд
 * человека, а `useActivePoll` брал из списка первый элемент — то есть
 * произвольную команду.
 */
describe('изоляция команд', () => {
  it('без команды запрос не уходит', async () => {
    h.currentGroupId = null;

    renderHook(() => useActivePolls(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(h.getActive).not.toHaveBeenCalled();
  });

  it('команда уходит в запрос явно', async () => {
    const { result } = renderHook(() => useActivePolls(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(h.getActive).toHaveBeenCalledWith('100');
  });

  /* Данные, уже лежащие в кэше одной команды, не должны отдаваться другой.
     Именно это и происходило: ключ был общим. */
  it('данные одной команды не отдаются другой', async () => {
    qc.setQueryData(queryKeys.polls.activeForGroup('100'), [{ id: 42 }]);
    h.currentGroupId = '200';
    h.getActive.mockResolvedValue({ data: [{ id: 77 }] });

    const { result } = renderHook(() => useActivePoll(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ id: 77 }));
    expect(h.getActive).toHaveBeenCalledWith('200');
  });

  it('последнее завершённое тоже изолировано по команде', async () => {
    qc.setQueryData(queryKeys.polls.lastCompletedForGroup('100'), { id: 40 });
    h.currentGroupId = '200';
    h.getLastCompleted.mockResolvedValue({ data: { id: 55 } });

    const { result } = renderHook(() => useLastCompletedPoll(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ id: 55 }));
    expect(h.getLastCompleted).toHaveBeenCalledWith('200');
  });
});
