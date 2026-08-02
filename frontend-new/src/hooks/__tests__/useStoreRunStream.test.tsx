/* Поток закупки: кадр store_run_updated сбрасывает кэш забега, посторонние
   кадры — нет. Транспорт подменяем заглушкой: проверяем решение хука, а не
   разбор SSE (он общий и покрыт поведением экрана опроса). */
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

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: { authStatus: string }) => unknown) =>
    selector({ authStatus: 'authenticated' }),
}));

import { useStoreRunStream } from '../useStoreRunStream';

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.lastOptions = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useStoreRunStream', () => {
  it('подписывается на персональный путь и только при открытом забеге', () => {
    const { rerender } = renderHook(({ id }: { id: number | null }) => useStoreRunStream(id), {
      wrapper,
      initialProps: { id: null as number | null },
    });
    expect(h.lastOptions?.path).toBe('/api/sse/me/stream');
    expect(h.lastOptions?.enabled).toBe(false);

    rerender({ id: 601 });
    expect(h.lastOptions?.enabled).toBe(true);
  });

  /* data приходит сырым JSON-текстом (см. StreamEvent): разбор — на стороне
     хука. Без него detail-запрос не сбрасывался бы никогда. */
  it('store_run_updated сбрасывает и список, и конкретный забег', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useStoreRunStream(601), { wrapper });

    h.lastOptions?.onEvent({
      event: 'store_run_updated',
      data: JSON.stringify({ storeRunId: 601, status: 'SHOPPING', audience: [1], timestamp: 'x' }),
    });

    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes('601'))).toBe(true);
    expect(spy.mock.calls.length).toBe(2);
  });

  it('битый кадр не роняет экран и всё же обновляет список', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useStoreRunStream(601), { wrapper });

    expect(() =>
      h.lastOptions?.onEvent({ event: 'store_run_updated', data: 'не json' }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('heartbeat и чужие кадры кэш не трогают', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useStoreRunStream(601), { wrapper });

    h.lastOptions?.onEvent({ event: 'heartbeat', data: '{}' });
    h.lastOptions?.onEvent({ event: 'debt_updated', data: '{}' });

    expect(spy).not.toHaveBeenCalled();
  });
});
