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

beforeEach(() => {
  h.lastOptions = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  it('enabled передаётся транспорту как есть', () => {
    renderHook(() => useSSE({ pollId: 42, enabled: false }), { wrapper });

    expect(h.lastOptions?.enabled).toBe(false);
  });

  it('смена опроса переключает поток', () => {
    const { rerender } = renderHook(
      ({ pollId }: { pollId: number }) => useSSE({ pollId }),
      { wrapper, initialProps: { pollId: 42 } }
    );

    rerender({ pollId: 43 });

    expect(h.lastOptions?.path).toBe('/api/polls/43/stream');
  });

  it('статус транспорта возвращается наружу без изменений', () => {
    const { result } = renderHook(() => useSSE({ pollId: 42 }), { wrapper });

    expect(result.current).toBe('connected');
  });
});

describe('реакция на кадр poll_updated', () => {
  /**
   * ПОРЯДОК: сначала сбрасываются ключи кэша, потом дёргается колбэк.
   *
   * Это и есть то, ради чего тест нужен задаче 12: колбэк на экране опроса может
   * читать кэш (например, чтобы показать анимацию по свежим данным), и если
   * порядок перевернётся, он прочитает старое значение. Утверждение здесь —
   * не «оба вызваны», а «инвалидация была ДО колбэка».
   */
  it('сначала сбрасывает кэш, потом вызывает колбэк', () => {
    const order: string[] = [];
    const invalidate = vi
      .spyOn(qc, 'invalidateQueries')
      .mockImplementation((() => {
        order.push('invalidate');
        return Promise.resolve();
      }) as never);
    const onPollUpdated = vi.fn(() => {
      order.push('callback');
    });

    renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });
    emit('poll_updated');

    expect(invalidate).toHaveBeenCalledTimes(4);
    expect(order[order.length - 1]).toBe('callback');
    expect(order.slice(0, 4)).toEqual([
      'invalidate',
      'invalidate',
      'invalidate',
      'invalidate',
    ]);
  });

  /* Четыре ключа — это четыре экрана, которые обязаны обновиться от одного
     голоса: сам опрос, список активных, свои голоса и итоги. Потеря любого
     означает «проголосовал, а на экране по-прежнему старое». */
  it('сбрасывает опрос, активные, свои голоса и итоги', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useSSE({ pollId: 42 }), { wrapper });
    emit('poll_updated');

    const keys = invalidate.mock.calls.map(call => JSON.stringify(call[0]));
    expect(keys).toHaveLength(4);
    expect(keys.filter(key => key.includes('42'))).toHaveLength(3);
    expect(keys.some(key => key.includes('active'))).toBe(true);
  });

  it('колбэк получает разобранный кадр, а не строку', () => {
    const onPollUpdated = vi.fn();

    renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });
    emit('poll_updated');

    expect(onPollUpdated).toHaveBeenCalledWith(FRAME);
  });

  it('без колбэка кадр всё равно обновляет кэш', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useSSE({ pollId: 42 }), { wrapper });

    expect(() => emit('poll_updated')).not.toThrow();
    expect(invalidate).toHaveBeenCalledTimes(4);
  });
});

describe('кадры, которые трогать не надо', () => {
  it.each(['heartbeat', 'debt_updated', 'store_run_updated'])(
    'кадр %s кэш не сбрасывает',
    event => {
      const invalidate = vi.spyOn(qc, 'invalidateQueries');
      const onPollUpdated = vi.fn();

      renderHook(() => useSSE({ pollId: 42, onPollUpdated }), { wrapper });
      emit(event, '{}');

      expect(invalidate).not.toHaveBeenCalled();
      expect(onPollUpdated).not.toHaveBeenCalled();
    }
  );

  /* Кадр может прийти после того, как экран опроса закрыли: соединение и
     обработчик живут до размонтирования, а `pollId` к этому моменту уже null. */
  it('кадр без опроса игнорируется', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useSSE({ pollId: null }), { wrapper });
    emit('poll_updated');

    expect(invalidate).not.toHaveBeenCalled();
  });

  /**
   * ПОВЕДЕНИЕ ЗАФИКСИРОВАНО КАК ЕСТЬ, и оно расходится с потоком закупки.
   *
   * `useStoreRunStream` на битом кадре сбрасывает список и продолжает работать
   * (`JSON.parse` там обёрнут), а здесь разбор идёт первой строкой и исключение
   * уходит в транспорт. То есть один испорченный кадр от сервера ведёт себя
   * по-разному на двух экранах. Разбирать это — работа задачи 12, которая
   * трогает именно эту область; здесь фиксируется факт, чтобы починка была
   * видна как изменение теста, а не как случайность.
   */
  it('битый кадр бросает — в отличие от потока закупки', () => {
    renderHook(() => useSSE({ pollId: 42 }), { wrapper });

    expect(() => emit('poll_updated', 'не json')).toThrow();
  });
});
