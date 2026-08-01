/* Персональный поток денежных событий.
   Экран бюджета опрашивал сервер дважды каждые 15 секунд и до 15 секунд не знал,
   что коллега отметил или подтвердил оплату. Поток адресуется людям, а не
   сущности: у магазинной транзакции опроса может не быть вовсе.

   Опрос остаётся страховкой: в вебвью Telegram поток может не подняться, и тогда
   молчащий экран денег — хуже лишнего запроса. Пока поток жив, опрос выключается
   (см. useDebts/useCredits и refetchInterval). */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { useEventStream, type SSEStatus, type StreamEvent } from './useEventStream';

export interface DebtUpdatedEvent {
  transactionId: number;
  status: 'PENDING' | 'PAID' | 'CONFIRMED';
  audience: number[];
  timestamp: string;
}

export function useMoneyStream(enabled = true): SSEStatus {
  const qc = useQueryClient();
  const authStatus = useAppStore((s) => s.authStatus);

  const handle = useCallback(
    ({ event }: StreamEvent) => {
      if (event !== 'debt_updated') return;
      /* Перезапрашиваем, а не патчим кэш из события: суммы и итоги считает
         сервер, и класть в поток деньги только чтобы их продублировать — способ
         разъехаться с источником истины. */
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
    [qc],
  );

  return useEventStream({
    path: '/api/sse/me/stream',
    enabled: enabled && authStatus === 'authenticated',
    onEvent: handle,
  });
}
