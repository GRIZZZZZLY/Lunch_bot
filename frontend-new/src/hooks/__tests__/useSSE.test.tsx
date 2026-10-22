/**
 * Клиентская сторона живых обновлений опроса.
 *
 * Задача 11 ставит этот файл в приоритет не по размеру (46 строк), а потому что
 * без него нельзя выполнить задачу 12 по её же TDD-порядку: её главный риск —
 * «порядок инвалидации кэша относительно слушателя SSE», и зафиксировать
 * порядок было нечем.
 *
 * Транспорт (`useEventStream`: fetch, Bearer, разбор кадров, backoff) подменён
 * заглушкой намеренно: здесь проверяется РЕШЕНИЕ хука — на какой путь он
 * подписывается, какие ключи сбрасывает и в каком порядке дёргает колбэк, — а не
 * разбор SSE, который общий для всех потоков.
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
const OTHER_POLL = queryKeys.polls.results(43);

const isStale = (key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated;

beforeEach(() => {
  h.lastOptions = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of [...POLL_KEYS, OTHER_POLL]) qc.setQueryData(key, {});
});

describe('подписка', () => {
  it('слушает поток конкретного опроса', () => {
    renderHook(() => useSSE({ pollId: 42 }), { wrapper });

    expect(h.lastOptions?.path).toBe('/api/polls/42/stream');
    expect(h.lastOptions?.enabled).toBe(true);
  });

  /* Без опроса подписываться некуда: `path: null` — это сигнал транспорту не
     открывать соединение вовсе, иначе каждый экран без опроса держал бы
     висящий запрос. */
  it('без опроса путь пустой', () => {
    renderHook(() => useSSE({ pollId: null }), { wrapper });

    expect(h.lastOptions?.path).toBeNull();
  });

  it('смена опроса переключает поток', () => {
    const { rerender } = renderHook(
      ({ pollId }: { pollId: number }) => useSSE({ pollId }),
      { wrapper, initialProps: { pollId: 42 } }
    );

    rerender({ pollId: 43 });

    expect(h.lastOptions?.path).toBe('/api/polls/43/stream');
  });
});

describe('реакция на кадр poll_updated', () => {
  /* Потеря любого ключа означает «проголосовал, а на экране по-прежнему
     старое». Соседний опрос при этом не трогается. */
  it('сбрасывает опрос, активные, свои голоса и итоги', () => {
    renderHook(() => useSSE({ pollId: 42 }), { wrapper });
    emit('poll_updated');

    expect(POLL_KEYS.map(isStale)).toEqual([true, true, true, true]);
    expect(isStale(OTHER_POLL)).toBe(false);
  });

  /**
   * ПОРЯДОК: колбэк на экране опроса может читать кэш (например, чтобы показать
   * анимацию по свежим данным). Если сначала дёрнуть колбэк, он прочитает
   * старое значение — поэтому к его вызову кэш уже должен быть сброшен.
   */
  it('к вызову колбэка кэш уже сброшен', () => {
    let seen: unknown[] = [];
    const onPollUpdated = vi.fn(() => {
      seen = POLL_KEYS.map(isStale);
    });

    renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });
    emit('poll_updated');

    expect(onPollUpdated).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([true, true, true, true]);
  });

  it('колбэк получает разобранный кадр, а не строку', () => {
    const onPollUpdated = vi.fn();

    renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });
    emit('poll_updated');

    expect(onPollUpdated).toHaveBeenCalledWith(FRAME);
  });
});

describe('кадры, которые трогать не надо', () => {
  it.each(['heartbeat', 'debt_updated', 'store_run_updated'])(
    'кадр %s кэш не сбрасывает',
    event => {
      const onPollUpdated = vi.fn();

      renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });
      emit(event, '{}');

      expect(POLL_KEYS.map(isStale)).toEqual([false, false, false, false]);
      expect(onPollUpdated).not.toHaveBeenCalled();
    }
  );

  /* Кадр может прийти после того, как экран опроса закрыли: соединение и
     обработчик живут до размонтирования, а `pollId` к этому моменту уже null. */
  it('кадр без опроса игнорируется', () => {
    renderHook(() => useSSE({ pollId: null }), { wrapper });
    emit('poll_updated');

    expect(POLL_KEYS.map(isStale)).toEqual([false, false, false, false]);
  });

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
