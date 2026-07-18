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
  const [status, setStatus] = useState<SSEStatus>('disconnected');

  // Используем ref для callbacks чтобы не пересоздавать EventSource
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
    setStatus('connecting');

    const es = new EventSource(buildSSEUrl(pollId));

    const handleConnected = (): void => {
      setStatus('connected');
      retryCount = 0;
    };

    const handlePollUpdated = (event: MessageEvent): void => {
      try {
        const data: PollUpdatedEvent = JSON.parse(event.data);

        // Инвалидируем React Query кеш
        queryClient.invalidateQueries({
          queryKey: queryKeys.polls.detail(pollId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.polls.active(),
        });

        callbacksRef.current.onPollUpdated?.(data);
      } catch {
        // Ignore malformed stream events.
      }
    };

    const handleCategoryOrderUpdated = (event: MessageEvent): void => {
      try {
        const data: CategoryOrderUpdatedEvent = JSON.parse(event.data);

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
      } catch {
        // Ignore malformed stream events.
      }
    };

    const handleResponsibleSelected = (event: MessageEvent): void => {
      try {
        const data: ResponsibleSelectedEvent = JSON.parse(event.data);

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
      } catch {
        // Ignore malformed stream events.
      }
    };

    es.addEventListener('connected', handleConnected);
    es.addEventListener('poll_updated', handlePollUpdated);
    es.addEventListener(
      'category_order_updated',
      handleCategoryOrderUpdated
    );
    es.addEventListener('responsible_selected', handleResponsibleSelected);

    es.onerror = () => {
      setStatus('error');
      retryCount++;

      if (retryCount >= MAX_RETRIES) {
        es.close();
        setStatus('disconnected');
      }
    };

    return () => {
      es.removeEventListener('connected', handleConnected);
      es.removeEventListener('poll_updated', handlePollUpdated);
      es.removeEventListener(
        'category_order_updated',
        handleCategoryOrderUpdated
      );
      es.removeEventListener(
        'responsible_selected',
        handleResponsibleSelected
      );
      es.onerror = null;
      es.close();
    };
  }, [pollId, enabled, queryClient]);

  return status;
}
