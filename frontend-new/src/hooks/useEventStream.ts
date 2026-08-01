/* Транспорт SSE: fetch + Bearer + разбор кадров + переподключение с backoff.
   Именно fetch, а не EventSource: EventSource не умеет ставить заголовки, а
   токен в URL запрещён (см. sse.routes.ts).

   Вынесен из useSSE, чтобы у денежного потока не появилась вторая копия
   парсера: правило одной реализации. Что делать с событием — решает вызывающий. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/services/api.service';

export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface StreamEvent {
  event: string;
  /** Сырой data-блок кадра; разбор JSON — на стороне вызывающего. */
  data: string;
}

const BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 15000];
const MAX_RETRIES = 20;

/** Базовый адрес API без суффикса /api — потоки живут на том же хосте. */
export function streamBaseUrl(): string {
  const isProduction = import.meta.env.MODE === 'production';
  return isProduction
    ? ''
    : import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
}

interface Options {
  /** Полный путь потока, например `/api/sse/me/stream`. null — не подключаться. */
  path: string | null;
  enabled?: boolean;
  onEvent: (event: StreamEvent) => void;
}

export function useEventStream({ path, enabled = true, onEvent }: Options): SSEStatus {
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SSEStatus>('idle');

  /* Колбэк через ref: иначе каждая новая ссылка пересоздавала бы соединение. */
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

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
    if (!path || !enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const run = async (): Promise<void> => {
      setStatus('connecting');
      try {
        const token = apiService.getToken();
        if (!token) throw new Error('Authentication token is missing');

        const response = await fetch(`${streamBaseUrl()}${path}`, {
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
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
          // последний кусок может быть неполным кадром — оставляем в буфере
          buffer = blocks.pop() ?? '';

          for (const block of blocks) {
            const lines = block.split('\n');
            const event =
              lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? 'message';
            const data = lines
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');

            if (event === 'connected') {
              setStatus('connected');
              retryCountRef.current = 0;
            }
            onEventRef.current({ event, data });
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        if (retryCountRef.current >= MAX_RETRIES) {
          abortRef.current = null;
          setStatus('disconnected');
          return;
        }
        const delay = BACKOFF_DELAYS[Math.min(retryCountRef.current, BACKOFF_DELAYS.length - 1)];
        retryCountRef.current++;
        setStatus('error');
        retryTimerRef.current = setTimeout(() => {
          void run();
        }, delay);
      }
    };

    void run();
  }, [path, enabled]);

  useEffect(() => {
    if (path && enabled) connect();
    else cleanup();
    return cleanup;
  }, [path, enabled, connect, cleanup]);

  return path && enabled ? status : 'idle';
}
