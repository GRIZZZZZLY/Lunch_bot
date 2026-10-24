/* Денежный поток: кадр debt_updated сбрасывает кэш бюджета. Транспорт
   подменяем на useEventStream-заглушку: проверяем решение хука, а не разбор
   SSE (он общий и покрыт поведением экрана опроса). */
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
import { queryKeys } from '@/lib/queryClient';

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const DEBTS = queryKeys.budget.debts('1');
const isStale = () => qc.getQueryState(DEBTS)?.isInvalidated;

beforeEach(() => {
  h.lastOptions = null;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(DEBTS, []);
});

describe('useMoneyStream', () => {
  it('debt_updated сбрасывает кэш бюджета', () => {
    renderHook(() => useMoneyStream(), { wrapper });

    h.lastOptions?.onEvent({ event: 'debt_updated', data: '{}' });

    expect(isStale()).toBe(true);
  });
});

