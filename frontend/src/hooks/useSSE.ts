import { useEffect, useRef, useCallback } from 'react';
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

/** Backoff: 1s -> 2s -> 5s -> 10s -> 15s (cap) */
const BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 15000];
const MAX_RETRIES = 20;

/**
 * Построить SSE URL с токеном в query string.
 *
 * EventSource не поддерживает кастомные заголовки,
 * поэтому передаём JWT через query parameter.
 */
function buildSSEUrl(pollId: number): string {
  const token = apiService.getToken();
  const isProduction = import.meta.env.MODE === 'production';
  const baseUrl = isProduction
    ? ''
    : (import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001');

  const url = `${baseUrl}/api/polls/${pollId}/stream`;

  if (token) {
    return `${url}?token=${encodeURIComponent(token)}`;
  }
  return url;
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<SSEStatus>('disconnected');

  // Используем ref для callbacks чтобы не пересоздавать EventSource
  const callbacksRef = useRef({
    onPollUpdated,
    onCategoryOrderUpdated,
    onResponsibleSelected,
  });
  callbacksRef.current = {
    onPollUpdated,
    onCategoryOrderUpdated,
    onResponsibleSelected,
  };

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    statusRef.current = 'disconnected';
  }, []);

  const connect = useCallback(() => {
    if (!pollId || !enabled) return;

    cleanup();
    statusRef.current = 'connecting';

    const url = buildSSEUrl(pollId);

    if (import.meta.env.DEV) {
      console.log(`[SSE] Connecting to poll ${pollId}...`);
    }

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      statusRef.current = 'connected';
      retryCountRef.current = 0;

      if (import.meta.env.DEV) {
        console.log(`[SSE] Connected to poll ${pollId}`);
      }
    });

    es.addEventListener('heartbeat', () => {
      // Heartbeat — просто подтверждение что соединение живо
      if (import.meta.env.DEV) {
        console.log('[SSE] Heartbeat received');
      }
    });

    es.addEventListener('poll_updated', (event: MessageEvent) => {
      try {
        const data: PollUpdatedEvent = JSON.parse(event.data);

        if (import.meta.env.DEV) {
          console.log('[SSE] poll_updated:', data);
        }

        // Инвалидируем React Query кеш
        queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.polls.active(),
        });

        callbacksRef.current.onPollUpdated?.(data);
      } catch (error) {
        console.error('[SSE] Failed to parse poll_updated:', error);
      }
    });

    es.addEventListener('category_order_updated', (event: MessageEvent) => {
      try {
        const data: CategoryOrderUpdatedEvent = JSON.parse(event.data);

        if (import.meta.env.DEV) {
          console.log('[SSE] category_order_updated:', data);
        }

        // Инвалидируем category orders (все связанные query keys)
        queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        queryClient.invalidateQueries({
          queryKey: ['categoryOrders', pollId],
        });
        queryClient.invalidateQueries({
          queryKey: ['categoryOrders', 'my', pollId],
        });
        queryClient.invalidateQueries({
          queryKey: ['categoryOrder'],
        });

        callbacksRef.current.onCategoryOrderUpdated?.(data);
      } catch (error) {
        console.error('[SSE] Failed to parse category_order_updated:', error);
      }
    });

    es.addEventListener('responsible_selected', (event: MessageEvent) => {
      try {
        const data: ResponsibleSelectedEvent = JSON.parse(event.data);

        if (import.meta.env.DEV) {
          console.log('[SSE] responsible_selected:', data);
        }

        queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        queryClient.invalidateQueries({
          queryKey: ['categoryOrders', pollId],
        });
        queryClient.invalidateQueries({
          queryKey: ['categoryOrders', 'my', pollId],
        });
        queryClient.invalidateQueries({
          queryKey: ['categoryOrder'],
        });

        callbacksRef.current.onResponsibleSelected?.(data);
      } catch (error) {
        console.error('[SSE] Failed to parse responsible_selected:', error);
      }
    });

    es.onerror = () => {
      statusRef.current = 'error';
      es.close();
      eventSourceRef.current = null;

      if (retryCountRef.current >= MAX_RETRIES) {
        if (import.meta.env.DEV) {
          console.warn(`[SSE] Max retries (${MAX_RETRIES}) reached, giving up`);
        }
        statusRef.current = 'disconnected';
        return;
      }

      const delayIndex = Math.min(
        retryCountRef.current,
        BACKOFF_DELAYS.length - 1
      );
      const delay = BACKOFF_DELAYS[delayIndex];
      retryCountRef.current++;

      if (import.meta.env.DEV) {
        console.log(
          `[SSE] Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`
        );
      }

      retryTimerRef.current = setTimeout(connect, delay);
    };
  }, [pollId, enabled, cleanup, queryClient]);

  useEffect(() => {
    if (pollId && enabled) {
      connect();
    } else {
      cleanup();
    }

    return cleanup;
  }, [pollId, enabled, connect, cleanup]);

  return statusRef.current;
}
