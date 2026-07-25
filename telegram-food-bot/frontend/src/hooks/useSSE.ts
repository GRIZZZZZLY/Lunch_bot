import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { apiService } from '@/services/api.service';

/**
 * SSE события от сервера
 */
interface PollUpdatedEvent {
  pollId: number;
  type: 'vote_added' | 'vote_removed' | 'vote_changed' | 'poll_closed';
  userId?: number;
  timestamp: string;
}

interface CategoryOrderUpdatedEvent {
  categoryOrderId: number;
  pollId: number;
  type: 'created' | 'updated' | 'finalized';
  timestamp: string;
}

interface ResponsibleSelectedEvent {
  categoryOrderId: number;
  pollId: number;
  responsibleUserId: number;
  method: 'volunteer' | 'roulette' | 'auto';
  timestamp: string;
}

type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSSEOptions {
  /** ID poll для подписки */
  pollId: number | undefined;
  /** Включить/выключить SSE */
  enabled?: boolean;
  /** Callback при получении события poll_updated */
  onPollUpdated?: (event: PollUpdatedEvent) => void;
  /** Callback при получении события category_order_updated */
  onCategoryOrderUpdated?: (event: CategoryOrderUpdatedEvent) => void;
  /** Callback при получении события responsible_selected */
  onResponsibleSelected?: (event: ResponsibleSelectedEvent) => void;
}

const MAX_RETRIES = 20;
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 15000];

/**
 * Построить URL потока. Токен передаётся только в Authorization header.
 */
function buildSSEUrl(pollId: number): string {
  const isProduction = import.meta.env.MODE === 'production';
  const baseUrl = isProduction
    ? ''
    : (import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001');

  return `${baseUrl}/api/polls/${pollId}/stream`;
}

/**
 * React хук для подписки на SSE события poll.
 *
 * Автоматически:
 * - Подключается при наличии pollId и enabled=true
 * - Переподключается с exponential backoff при обрыве
 * - Инвалидирует React Query кеш при получении событий
 * - Очищает соединение при unmount
 *
 * @example
 * ```tsx
 * useSSE({
 *   pollId: activePoll?.id,
 *   enabled: !!activePoll,
 * });
 * ```
 */
export function useSSE(options: UseSSEOptions): SSEStatus {
  const {
    pollId,
    enabled = true,
    onPollUpdated,
    onCategoryOrderUpdated,
    onResponsibleSelected,
  } = options;

  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SSEStatus>('disconnected');

  // Используем ref для обработчиков, чтобы не пересоздавать подключение.
  const callbacksRef = useRef({
    onPollUpdated,
    onCategoryOrderUpdated,
    onResponsibleSelected,
  });
  useEffect(() => {
    callbacksRef.current = {
      onPollUpdated,
      onCategoryOrderUpdated,
      onResponsibleSelected,
    };
  }, [onPollUpdated, onCategoryOrderUpdated, onResponsibleSelected]);

  useEffect(() => {
    if (!pollId || !enabled) {
      setStatus('disconnected');
      return;
    }

    let retryCount = 0;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const abortController = new AbortController();
    setStatus('connecting');

    const handleConnected = (): void => {
      setStatus('connected');
      retryCount = 0;
    };

    const handlePollUpdated = (rawData: string): void => {
      try {
        const data: PollUpdatedEvent = JSON.parse(rawData);

        // Инвалидируем React Query кеш
        void queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.polls.active(),
        });

        callbacksRef.current.onPollUpdated?.(data);
      } catch {
        // Ignore malformed stream events.
      }
    };

    const handleCategoryOrderUpdated = (rawData: string): void => {
      try {
        const data: CategoryOrderUpdatedEvent = JSON.parse(rawData);

        // Инвалидируем category orders (все связанные query keys)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        void queryClient.invalidateQueries({
          queryKey: ['categoryOrders', pollId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['categoryOrders', 'my', pollId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['categoryOrder'],
        });

        callbacksRef.current.onCategoryOrderUpdated?.(data);
      } catch {
        // Ignore malformed stream events.
      }
    };

    const handleResponsibleSelected = (rawData: string): void => {
      try {
        const data: ResponsibleSelectedEvent = JSON.parse(rawData);

        void queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        void queryClient.invalidateQueries({
          queryKey: ['categoryOrders', pollId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['categoryOrders', 'my', pollId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['categoryOrder'],
        });

        callbacksRef.current.onResponsibleSelected?.(data);
      } catch {
        // Ignore malformed stream events.
      }
    };

    const dispatchEvent = (block: string): void => {
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      const data = dataLines.join('\n');
      if (eventName === 'connected') handleConnected();
      if (eventName === 'poll_updated') handlePollUpdated(data);
      if (eventName === 'category_order_updated') {
        handleCategoryOrderUpdated(data);
      }
      if (eventName === 'responsible_selected') {
        handleResponsibleSelected(data);
      }
    };

    const connect = async (): Promise<void> => {
      while (!stopped && retryCount < MAX_RETRIES) {
        try {
          const token = apiService.getToken();
          if (!token) throw new Error('Authentication token is missing');

          const response = await fetch(buildSSEUrl(pollId), {
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: abortController.signal,
          });
          if (!response.ok || !response.body) {
            throw new Error(`SSE request failed with ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() ?? '';
            blocks.forEach(dispatchEvent);
          }
          if (!stopped) throw new Error('SSE stream closed');
        } catch {
          if (stopped || abortController.signal.aborted) return;
          setStatus('error');
          const delay =
            RETRY_DELAYS_MS[
              Math.min(retryCount, RETRY_DELAYS_MS.length - 1)
            ];
          retryCount++;
          await new Promise<void>(resolve => {
            retryTimer = setTimeout(resolve, delay);
          });
        }
      }
      if (!stopped) setStatus('disconnected');
    };

    void connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      abortController.abort();
    };
  }, [pollId, enabled, queryClient]);

  return status;
}
