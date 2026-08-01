/* Денежный поток: кадр debt_updated сбрасывает кэш бюджета, посторонние кадры —
   нет. Транспорт подменяем на useEventStream-заглушку: проверяем решение хука,
   а не разбор SSE (он общий и покрыт поведением экрана опроса). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  lastOptions: null as null | { path: string | null; enabled: boolean; onEvent: (e: { event: string; data: string }) => void },
}));

vi.mock('../useEventStream', () => ({
  useEventStream: (options: { path: string | null; enabled: boolean; onEvent: (e: { event: string; data: string }) => void }) => {
    h.lastOptions = options;
    return 'connected';
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: { authStatus: string }) => unknown) => selector({ authStatus: 'authenticated' }),
}));

import { useMoneyStream } from '../useMoneyStream';

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.lastOptions = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useMoneyStream', () => {
  it('подписывается на персональный путь, а не на поток опроса', () => {
    renderHook(() => useMoneyStream(), { wrapper });
    expect(h.lastOptions?.path).toBe('/api/sse/me/stream');
    expect(h.lastOptions?.enabled).toBe(true);
  });

  it('debt_updated сбрасывает кэш бюджета', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useMoneyStream(), { wrapper });

    h.lastOptions?.onEvent({ event: 'debt_updated', data: '{}' });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['budget'] });
  });

  it('heartbeat и прочие кадры кэш не трогают', () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useMoneyStream(), { wrapper });

    h.lastOptions?.onEvent({ event: 'heartbeat', data: '{}' });
    h.lastOptions?.onEvent({ event: 'poll_updated', data: '{}' });

    expect(spy).not.toHaveBeenCalled();
  });
});
