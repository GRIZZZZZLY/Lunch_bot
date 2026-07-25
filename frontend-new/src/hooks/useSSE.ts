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
  const isProduction = import.meta.env.MODE === 'production';
  const baseUrl = isProduction
    ? ''
    : (import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001');

  return `${baseUrl}/api/polls/${pollId}/stream`;
}

export function useSSE(options: UseSSEOptions): SSEStatus {
  const { pollId, enabled = true, onPollUpdated } = options;

  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SSEStatus>('idle');

  const cbRef = useRef(onPollUpdated);
  useEffect(() => {
    cbRef.current = onPollUpdated;
  }, [onPollUpdated]);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!pollId || !enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const run = async (): Promise<void> => {
      setStatus('connecting');
      try {
        const token = apiService.getToken();
        if (!token) throw new Error('Authentication token is missing');

        const response = await fetch(buildSSEUrl(pollId), {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed with ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) throw new Error('SSE stream closed');
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';

          for (const block of blocks) {
            const eventName =
              block
                .split('\n')
                .find(line => line.startsWith('event:'))
                ?.slice(6)
                .trim() ?? 'message';
            const data = block
              .split('\n')
              .filter(line => line.startsWith('data:'))
              .map(line => line.slice(5).trimStart())
              .join('\n');

            if (eventName === 'connected') {
              setStatus('connected');
              retryCountRef.current = 0;
            }
            if (eventName === 'poll_updated') {
              const parsed: PollUpdatedEvent = JSON.parse(data);
              void qc.invalidateQueries({
                queryKey: queryKeys.polls.byId(pollId),
              });
              void qc.invalidateQueries({
                queryKey: queryKeys.polls.active,
              });
              void qc.invalidateQueries({
                queryKey: queryKeys.polls.myVotes(pollId),
              });
              void qc.invalidateQueries({
                queryKey: queryKeys.polls.results(pollId),
              });
              cbRef.current?.(parsed);
            }
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        if (retryCountRef.current >= MAX_RETRIES) {
          abortRef.current = null;
          setStatus('disconnected');
          return;
        }
        const delay =
          BACKOFF_DELAYS[
            Math.min(
              retryCountRef.current,
              BACKOFF_DELAYS.length - 1
            )
        ];
        retryCountRef.current++;
        setStatus('error');
        retryTimerRef.current = setTimeout(() => {
          void run();
        }, delay);
      }
    };

    void run();
  }, [pollId, enabled, qc]);

  useEffect(() => {
    if (pollId && enabled) {
      connect();
    } else {
      cleanup();
    }
    return cleanup;
  }, [pollId, enabled, connect, cleanup]);

  return pollId && enabled ? status : 'idle';
}
