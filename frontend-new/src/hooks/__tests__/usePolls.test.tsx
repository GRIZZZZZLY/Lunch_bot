/**
 * Изоляция команд в кэше голосований.
 *
 * Ключ кэша активных голосований был `['polls','active']` — без команды. После
 * переключения react-query отдавал из кэша голосование ПРЕЖНЕЙ команды как
 * актуальное, потому что для него это был тот же самый запрос. Сам запрос при
 * этом уходил без `groupId` и получал активные голосования всех команд
 * человека, а `useActivePoll` брал из списка первый элемент — то есть
 * произвольную команду.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

const h = vi.hoisted(() => ({
  getActive: vi.fn(),
  currentGroupId: '100' as string | null,
}));

vi.mock('@/services/polls.service', () => ({
  pollsService: { getActive: h.getActive },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (
    selector: (state: { authStatus: string; currentGroupId: string | null }) => unknown,
  ) => selector({ authStatus: 'authenticated', currentGroupId: h.currentGroupId }),
}));

import { useActivePoll } from '../usePolls';

let qc: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.getActive.mockReset();
  h.currentGroupId = '100';
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('изоляция команд', () => {
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
});
