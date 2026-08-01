/* Поток событий опроса. Транспорт (fetch + Bearer + разбор кадров + backoff)
   живёт в useEventStream — здесь только то, что специфично для опроса:
   какие ключи кэша сбрасывать и какой колбэк дёрнуть. */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useEventStream, type SSEStatus, type StreamEvent } from './useEventStream';

export interface PollUpdatedEvent {
  pollId: number;
  type: 'vote_added' | 'vote_removed' | 'vote_changed' | 'poll_closed';
  userId?: number;
  timestamp: string;
}

export type { SSEStatus };

interface UseSSEOptions {
  pollId: number | null | undefined;
  enabled?: boolean;
  onPollUpdated?: (event: PollUpdatedEvent) => void;
}

export function useSSE(options: UseSSEOptions): SSEStatus {
  const { pollId, enabled = true, onPollUpdated } = options;
  const qc = useQueryClient();

  const handle = useCallback(
    ({ event, data }: StreamEvent) => {
      if (event !== 'poll_updated' || !pollId) return;
      const parsed: PollUpdatedEvent = JSON.parse(data);
      void qc.invalidateQueries({ queryKey: queryKeys.polls.byId(pollId) });
      void qc.invalidateQueries({ queryKey: queryKeys.polls.active });
      void qc.invalidateQueries({ queryKey: queryKeys.polls.myVotes(pollId) });
      void qc.invalidateQueries({ queryKey: queryKeys.polls.results(pollId) });
      onPollUpdated?.(parsed);
    },
    [pollId, qc, onPollUpdated],
  );

  return useEventStream({
    path: pollId ? `/api/polls/${pollId}/stream` : null,
    enabled,
    onEvent: handle,
  });
}
