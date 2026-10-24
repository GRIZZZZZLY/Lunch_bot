/**
 * Клиентская сторона живых обновлений опроса.
 *
 * Транспорт (`useEventStream`: fetch, Bearer, разбор кадров, backoff) подменён
 * заглушкой намеренно: здесь проверяется решение хука по кадру, а не разбор
 * SSE, который общий для всех потоков.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  lastOptions: null as null | {
    path: string | null;
    enabled: boolean;
    onEvent: (e: { event: string; data: string }) => void;
  },
}));

vi.mock('../useEventStream', () => ({
  useEventStream: (options: {
    path: string | null;
    enabled: boolean;
    onEvent: (e: { event: string; data: string }) => void;
  }) => {
    h.lastOptions = options;
    return 'connected';
  },
}));

import { useSSE, type PollUpdatedEvent } from '../useSSE';
import { queryKeys } from '@/lib/queryClient';

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const FRAME: PollUpdatedEvent = {
  pollId: 42,
  type: 'vote_added',
  userId: 7,
  timestamp: '2026-08-23T12:00:00.000Z',
};

function emit(event: string, data: unknown = FRAME): void {
  h.lastOptions?.onEvent({
    event,
    data: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

/* Четыре экрана, которые обязаны обновиться от одного голоса: сам опрос,
   активные (ячейка команды под префиксом), свои голоса и итоги. */
const POLL_KEYS = [
  queryKeys.polls.byId(42),
  queryKeys.polls.activeForGroup('1'),
  queryKeys.polls.myVotes(42),
  queryKeys.polls.results(42),
];

const isStale = (key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated;

beforeEach(() => {
  h.lastOptions = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of POLL_KEYS) qc.setQueryData(key, {});
});

describe('кадр poll_updated', () => {
  /* Один испорченный кадр от сервера не должен ронять поток: исключение ушло
     бы в транспорт. Следующий нормальный кадр обязан обновить экран. */
  it('битый кадр пропускается, следующий всё равно обновляет кэш', () => {
    const onPollUpdated = vi.fn();
    renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });

    expect(() => emit('poll_updated', 'не json')).not.toThrow();
    expect(onPollUpdated).not.toHaveBeenCalled();

    emit('poll_updated');

    expect(POLL_KEYS.map(isStale)).toEqual([true, true, true, true]);
    expect(onPollUpdated).toHaveBeenCalledWith(FRAME);
  });
});
