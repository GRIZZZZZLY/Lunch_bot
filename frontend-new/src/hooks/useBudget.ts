import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '@/services/budget.service';
import type { Transaction, TransactionStatus } from '@/types/models';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import { useToastStore } from '@/store/useToastStore';
import { apiErrorMessage } from '@/lib/apiError';

/* `live` — жив ли персональный поток (useMoneyStream). Пока он жив, опрос не
   нужен: сервер сам скажет об изменении. Опрос остаётся страховкой на случай,
   когда поток не поднялся, — молчащий экран денег хуже лишнего запроса.
   По умолчанию false, поэтому вызывающие без потока (Главная) не меняются. */
/* Опции отдельно от хука: их берёт предзагрузка первого экрана
   (lib/prefetch.ts). Ключ и queryFn общие — иначе предзагрузка греет соседнюю
   ячейку кэша, и барьер Главной всё равно ждёт сеть. */
export function debtsQueryOptions(params?: { status?: string }) {
  return {
    queryKey: queryKeys.budget.debts(params),
    queryFn: async () => {
      const res = await budgetService.getDebts(params);
      return res.data ?? [];
    },
    staleTime: 10_000,
  };
}

export function useDebts(params?: { status?: string }, live = false) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    ...debtsQueryOptions(params),
    enabled: isAuthenticated,
    refetchInterval: live ? false : 15_000,
  });
}

export function creditsQueryOptions(params?: { status?: string }) {
  return {
    queryKey: queryKeys.budget.credits(params),
    queryFn: async () => {
      const res = await budgetService.getCredits(params);
      return res.data ?? [];
    },
    staleTime: 10_000,
  };
}

export function useCredits(params?: { status?: string }, live = false) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    ...creditsQueryOptions(params),
    enabled: isAuthenticated,
    refetchInterval: live ? false : 15_000,
  });
}

function invalidateBudget(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['budget'] });
}

type Qc = ReturnType<typeof useQueryClient>;
type Snapshot = ReturnType<Qc['getQueriesData']>;

/**
 * Оптимистичная смена статуса транзакции в уже загруженном списке. Фильтр по
 * префиксу ключа, а не по точному ключу: списки кэшируются вместе с params
 * (`['budget','debts',params]`), и патчить нужно любой из них.
 */
function patchStatus(qc: Qc, list: 'debts' | 'credits', txId: number, status: TransactionStatus) {
  const filter = { queryKey: ['budget', list] };
  const snapshot = qc.getQueriesData(filter);
  qc.setQueriesData<Transaction[]>(filter, (old) =>
    old?.map((t) => (t.id === txId ? { ...t, status } : t)),
  );
  return snapshot;
}

function restore(qc: Qc, snapshot: Snapshot | undefined) {
  for (const [key, data] of snapshot ?? []) qc.setQueryData(key, data);
}

/* Три мутации, меняющие состояние, применяются оптимистично: тап по деньгам не
   должен ждать round-trip. Отказ откатывает список к снимку и говорит вслух —
   иначе строка молча вернулась бы в прежний статус. sendReminder оптимистики не
   получает: он ничего не меняет в списке, а отправляет сообщение. */
export function useMarkPaid() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.markPaid(transactionId),
    onMutate: async (transactionId) => {
      await qc.cancelQueries({ queryKey: ['budget', 'debts'] });
      return { snapshot: patchStatus(qc, 'debts', transactionId, 'PAID') };
    },
    onSuccess: () => push({ type: 'success', message: 'Отмечено как оплачено. Ждём подтверждения.' }),
    onError: (err, _id, ctx) => {
      restore(qc, ctx?.snapshot);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отметить оплату') });
    },
    onSettled: () => invalidateBudget(qc),
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.confirmPayment(transactionId),
    onMutate: async (transactionId) => {
      await qc.cancelQueries({ queryKey: ['budget', 'credits'] });
      return { snapshot: patchStatus(qc, 'credits', transactionId, 'CONFIRMED') };
    },
    onSuccess: () => push({ type: 'success', message: 'Оплата подтверждена' }),
    onError: (err, _id, ctx) => {
      restore(qc, ctx?.snapshot);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось подтвердить оплату') });
    },
    onSettled: () => invalidateBudget(qc),
  });
}

/**
 * Отмена подтверждения. Оптимистики нет намеренно: окно (сутки) проверяет
 * сервер, и показать долг вернувшимся, чтобы через миг отобрать, — плохой обмен
 * на денежном экране. Ждём ответа и говорим результат.
 */
export function useUndoConfirmation() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.undoConfirmation(transactionId),
    onSuccess: () => push({ type: 'info', message: 'Подтверждение отменено, участник уведомлён' }),
    onError: (err) =>
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отменить подтверждение') }),
    onSettled: () => invalidateBudget(qc),
  });
}

export function useCancelMark() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.cancelMark(transactionId),
    onMutate: async (transactionId) => {
      await qc.cancelQueries({ queryKey: ['budget', 'debts'] });
      return { snapshot: patchStatus(qc, 'debts', transactionId, 'PENDING') };
    },
    onSuccess: () => push({ type: 'info', message: 'Отметка снята' }),
    onError: (err, _id, ctx) => {
      restore(qc, ctx?.snapshot);
      push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отменить отметку') });
    },
    onSettled: () => invalidateBudget(qc),
  });
}

/**
 * Напомнить всем сразу. Сборщик с восемью должниками иначе делает восемь
 * одинаковых касаний. Последовательно, а не Promise.all: это исходящие
 * сообщения в Telegram, и упереться в лимит записи на середине хуже, чем
 * отправить чуть медленнее. Возвращаем сколько дошло — частичный успех тоже
 * результат, и он должен быть назван.
 *
 * Массового ПОДТВЕРЖДЕНИЯ здесь сознательно нет: подтверждение необратимо, и
 * пакетировать необратимое денежное действие нельзя. См. ConfirmDialog на
 * одиночном подтверждении — там мы, наоборот, добавляем трение.
 */
export function useRemindAll() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: async (transactionIds: number[]) => {
      let sent = 0;
      let lastError: unknown = null;
      for (const id of transactionIds) {
        try {
          await budgetService.sendReminder(id);
          sent += 1;
        } catch (err) {
          lastError = err;
        }
      }
      return { sent, total: transactionIds.length, lastError };
    },
    onSuccess: ({ sent, total, lastError }) => {
      if (sent === 0) {
        push({ type: 'error', message: apiErrorMessage(lastError, 'Не удалось отправить напоминания') });
        return;
      }
      push({
        type: sent === total ? 'success' : 'info',
        message:
          sent === total
            ? `Напоминания отправлены: ${sent}`
            : `Отправлено ${sent} из ${total} — остальные не ушли`,
      });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отправить напоминания') }),
    onSettled: () => invalidateBudget(qc),
  });
}

export function useSendReminder() {
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.sendReminder(transactionId),
    onSuccess: () => push({ type: 'success', message: 'Напоминание отправлено' }),
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отправить напоминание') }),
  });
}
