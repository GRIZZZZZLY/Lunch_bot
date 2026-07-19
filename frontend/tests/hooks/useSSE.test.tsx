import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSSE } from '../../src/hooks/useSSE';

const { getTokenMock } = vi.hoisted(() => ({
  getTokenMock: vi.fn(),
}));

vi.mock('@/services/api.service', () => ({
  apiService: {
    getToken: getTokenMock,
  },
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  listeners = new Map<string, (event: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (this.listeners.get(type) === listener) {
      this.listeners.delete(type);
    }
  }

  dispatch(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'SSETestWrapper';
  return Wrapper;
};

describe('useSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeEventSource.instances = [];
    getTokenMock.mockReturnValue('jwt-token');
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('connects to the poll stream with token and invalidates poll queries on updates', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onPollUpdated = vi.fn();

    renderHook(
      () =>
        useSSE({
          pollId: 7,
          onPollUpdated,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(FakeEventSource.instances).toHaveLength(1);
    });

    expect(FakeEventSource.instances[0].url).toContain(
      '/api/polls/7/stream?token=jwt-token'
    );

    FakeEventSource.instances[0].dispatch('poll_updated', {
      pollId: 7,
      timestamp: '2026-07-01T12:00:00.000Z',
      type: 'vote_added',
      userId: 5,
    });

    await waitFor(() => {
      expect(onPollUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ pollId: 7, type: 'vote_added' })
      );
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['polls', 'detail', 7],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['polls', 'active'],
    });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
