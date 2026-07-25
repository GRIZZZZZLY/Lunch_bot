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
    getTokenMock.mockReturnValue('jwt-token');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('connects to the poll stream with token and invalidates poll queries on updates', async () => {
    let streamController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });
    vi.stubGlobal('fetch', fetchMock);

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
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/polls/7/stream'),
      expect.objectContaining({
        headers: {
          Accept: 'text/event-stream',
          Authorization: 'Bearer jwt-token',
        },
      })
    );
    expect(fetchMock.mock.calls[0][0]).not.toContain('token=');

    const event = [
      'event: connected',
      'data: {}',
      '',
      'event: poll_updated',
      'data: {"pollId":7,"timestamp":"2026-07-01T12:00:00.000Z","type":"vote_added","userId":5}',
      '',
      '',
    ].join('\n');
    streamController?.enqueue(new TextEncoder().encode(event));

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
  });
});
