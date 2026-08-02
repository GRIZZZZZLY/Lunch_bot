/* Поток событий закупки.
   Экран закупки опрашивал сервер каждые 15 секунд и столько же не знал, что
   кто-то добавил позицию, проставил цену или что сбор закрылся сам. Событие
   адресуется людям — инициатору и тем, кто в этот забег заказал, — по той же
   причине, что и долговое: у забега нет опроса, к которому можно привязать
   канал, а смотрят его именно эти люди.

   Опрос остаётся страховкой: в вебвью Telegram поток может не подняться, и
   молчащий экран закупки хуже лишнего запроса. Пока поток жив, опрос
   выключается (см. useStoreRun). */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { queryKeys } from '@/lib/queryClient';
import { useEventStream, type SSEStatus, type StreamEvent } from './useEventStream';

export interface StoreRunUpdatedEvent {
  storeRunId: number;
  status: string;
  audience: number[];
  timestamp: string;
}

function parseFrame(data: string): Partial<StoreRunUpdatedEvent> | null {
  try {
    return JSON.parse(data) as Partial<StoreRunUpdatedEvent>;
  } catch {
    return null;
  }
}

export function useStoreRunStream(storeRunId?: number | null, enabled = true): SSEStatus {
  const qc = useQueryClient();
  const authStatus = useAppStore((s) => s.authStatus);

  const handle = useCallback(
    ({ event, data }: StreamEvent) => {
      if (event !== 'store_run_updated') return;
      /* data — сырой JSON-текст кадра: разбор на вызывающем (см. StreamEvent).
         Битый кадр не должен ронять экран, поэтому разбор в try. */
      const payload = parseFrame(data);
      /* Перезапрашиваем, а не патчим кэш из события: цены и итоги считает
         сервер, и дублировать их в потоке — способ разъехаться с источником
         истины. */
      void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.active() });
      if (payload?.storeRunId) {
        void qc.invalidateQueries({ queryKey: queryKeys.storeRuns.detail(payload.storeRunId) });
      }
    },
    [qc],
  );

  return useEventStream({
    path: '/api/sse/me/stream',
    enabled: enabled && authStatus === 'authenticated' && !!storeRunId,
    onEvent: handle,
  });
}
