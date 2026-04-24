import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { apiService } from '@/services/api.service';

export interface PollUpdatedEvent {
  pollId: number;
  type: 'vote_added' | 'vote_removed' | 'vote_changed' | 'poll_closed';
  userId?: number;
  timestamp: string;
}

export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSSEOptions {
  pollId: number | null | undefined;
  enabled?: boolean;
  onPollUpdated?: (event: PollUpdatedEvent) => void;
}

const BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 15000];
const MAX_RETRIES = 20;

function buildSSEUrl(pollId: number): string {
  const token = apiService.getToken();
  const isProduction = import.meta.env.MODE === 'production';
  const baseUrl = isProduction
    ? ''
    : (import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001');

  const url = `${baseUrl}/api/polls/${pollId}/stream`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export function useSSE(options: UseSSEOptions): SSEStatus {
  const { pollId, enabled = true, onPollUpdated } = options;

  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SSEStatus>('idle');

  const cbRef = useRef(onPollUpdated);
  cbRef.current = onPollUpdated;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!pollId || !enabled) return;

    cleanup();
    setStatus('connecting');

    const es = new EventSource(buildSSEUrl(pollId));
    esRef.current = es;

    es.addEventListener('connected', () => {
      setStatus('connected');
      retryCountRef.current = 0;
    });

    es.addEventListener('poll_updated', (event: MessageEvent) => {
      try {
        const data: PollUpdatedEvent = JSON.parse(event.data);
        qc.invalidateQueries({ queryKey: queryKeys.polls.byId(pollId) });
        qc.invalidateQueries({ queryKey: queryKeys.polls.active });
        qc.invalidateQueries({ queryKey: queryKeys.polls.myVotes(pollId) });
        qc.invalidateQueries({ queryKey: queryKeys.polls.results(pollId) });
        cbRef.current?.(data);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[SSE] parse poll_updated', err);
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (retryCountRef.current >= MAX_RETRIES) {
        setStatus('disconnected');
        return;
      }

      const delay = BACKOFF_DELAYS[Math.min(retryCountRef.current, BACKOFF_DELAYS.length - 1)];
      retryCountRef.current++;
      setStatus('error');
      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, [pollId, enabled, cleanup, qc]);

  useEffect(() => {
    if (pollId && enabled) {
      connect();
    } else {
      cleanup();
      setStatus('idle');
    }
    return cleanup;
  }, [pollId, enabled, connect, cleanup]);

  return status;
}
