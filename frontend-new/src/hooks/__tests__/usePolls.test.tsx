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
  push: vi.fn(),
  authStatus: 'authenticated' as string,
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
  useAppStore: (selector: (state: { authStatus: string }) => unknown) =>
    selector({ authStatus: h.authStatus }),
}));

vi.mock('@/store/useToastStore', () => ({
  useToastStore: (selector: (state: { push: unknown }) => unknown) =>
    selector({ push: h.push }),
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

/** Ключи, сброшенные мутацией, в виде сравнимых строк. */
function invalidatedKeys(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call: unknown[]) => JSON.stringify(call[0]));
}

beforeEach(() => {
  for (const value of Object.values(h)) {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
  }
  h.authStatus = 'authenticated';
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

  /* Свои голоса читаются без гейта по authStatus — единственный такой хук в
     файле. Закрепляем как есть: экран опроса открывается по deep link, и
     запрос уходит одновременно с восстановлением сессии. */
  it('свои голоса запрашиваются и без аутентификации', async () => {
    h.authStatus = 'unauthenticated';

    renderHook(() => useMyVotes(42), { wrapper });

    await waitFor(() => expect(h.getMyVotes).toHaveBeenCalledWith(42));
  });

  /* Общие опции для предзагрузки: ключ обязан быть тем же, что у хука. */
  it('опции предзагрузки используют ключ активных опросов', async () => {
    const options = activePollsQueryOptions();

    expect(options.queryKey).toEqual(queryKeys.polls.active);
    await expect(options.queryFn()).resolves.toEqual([{ id: 42 }, { id: 41 }]);
  });
});

describe('голос', () => {
  it('сбрасывает активные, сам опрос и свои голоса', async () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useVote(), { wrapper });

    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.vote).toHaveBeenCalledWith(42, 7);
    const keys = invalidatedKeys(invalidate);
    expect(keys).toHaveLength(3);
    expect(keys.some(key => key.includes('active'))).toBe(true);
    expect(keys.filter(key => key.includes('42'))).toHaveLength(2);
  });

  it('успех показывает подтверждение', async () => {
    const { result } = renderHook(() => useVote(), { wrapper });

    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith({
        type: 'success',
        message: 'Голос учтён',
      })
    );
  });

  /* Отказ обязан показать ПРИЧИНУ с сервера, а не общий текст: именно за этим
     заведён `apiErrorMessage` (задача 03 — почти половина кодов ошибок не имела
     текста, и пользователь читал «не удалось»). */
  it('отказ показывает причину сервера, а не общий текст', async () => {
    h.vote.mockRejectedValue({ code: 'POLL_ERROR', error: 'Poll is not active' });

    const { result } = renderHook(() => useVote(), { wrapper });
    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const calls = h.push.mock.calls;
    const toast = calls[calls.length - 1]?.[0] as { type: string; message: string };
    expect(toast.type).toBe('error');
    expect(toast.message).not.toBe('Не удалось проголосовать');
  });

  /**
   * Запасной текст показывается НЕ на всякий отказ.
   *
   * `apiErrorMessage` первой строкой отдаёт `err.message` любого `Error`, то
   * есть при сетевом сбое пользователь читает техническую строку («Network
   * Error», «boom»), а не «Не удалось проголосовать». Поведение зафиксировано
   * как есть: это выбор `lib/apiError.ts`, а не хука, и менять его надо там —
   * вместе с решением, что показывать при обрыве сети.
   */
  it('обычная ошибка показывается своим текстом, а не запасным', async () => {
    h.vote.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useVote(), { wrapper });
    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(h.push).toHaveBeenCalledWith({
      type: 'error',
      message: 'Network Error',
    });
  });

  /* Запасной текст остаётся ровно для случая «нечего сказать»: ни сообщения,
     ни кода, ни статуса. По статусу и по коду `lib/apiError.ts` подбирает свой
     текст — это его работа, и хук в неё не вмешивается. */
  it('отказ без текста, кода и статуса показывает запасной', async () => {
    h.vote.mockRejectedValue({});

    const { result } = renderHook(() => useVote(), { wrapper });
    result.current.mutate({ pollId: 42, menuItemId: 7 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const calls = h.push.mock.calls;
    const toast = calls[calls.length - 1]?.[0] as { message: string };
    expect(toast.message).toBe('Не удалось проголосовать');
  });
});

describe('снятие голоса', () => {
  it('сбрасывает активные и свои голоса, но не итоги', async () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useWithdrawVote(), { wrapper });

    result.current.mutate(42);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidatedKeys(invalidate);
    expect(keys).toHaveLength(2);
    expect(keys.some(key => key.includes('results'))).toBe(false);
    expect(h.push).toHaveBeenCalledWith({ type: 'info', message: 'Голос снят' });
  });
});

describe('администраторские действия', () => {
  /* Закрытие и отмена сбрасывают ОДИН И ТОТ ЖЕ набор: активные, сам опрос и
     «последнее завершённое» — последнее потому, что после закрытия именно этот
     опрос становится последним, и главный экран обязан его увидеть. */
  it.each([
    ['закрытие', () => useCompletePoll(), 42, 'success', 'Голосование закрыто'],
    [
      'отмена',
      () => useCancelPoll(),
      { pollId: 42, reason: 'перенесли' },
      'info',
      'Голосование отменено',
    ],
  ])('%s сбрасывает жизненный цикл опроса', async (_label, hook, vars, type, message) => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(hook as () => ReturnType<typeof useCompletePoll>, {
      wrapper,
    });

    (result.current.mutate as (v: unknown) => void)(vars);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidatedKeys(invalidate);
    expect(keys).toHaveLength(3);
    expect(keys.some(key => key.includes('last-completed'))).toBe(true);
    expect(h.push).toHaveBeenCalledWith({ type, message });
  });

  it('отмена передаёт причину сервису', async () => {
    const { result } = renderHook(() => useCancelPoll(), { wrapper });

    result.current.mutate({ pollId: 42, reason: 'перенесли обед' });

    await waitFor(() => expect(h.cancel).toHaveBeenCalledWith(42, 'перенесли обед'));
  });

  /* Создание не показывает тост: экран создания сам ведёт пользователя дальше,
     и второе сообщение поверх перехода мешало бы. Закрепляем как есть. */
  it('создание сбрасывает активные и последнее завершённое, без тоста', async () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreatePoll(), { wrapper });

    result.current.mutate({ groupId: 1, duration: 30 } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKeys(invalidate)).toHaveLength(2);
    expect(h.push).not.toHaveBeenCalled();
  });
});
