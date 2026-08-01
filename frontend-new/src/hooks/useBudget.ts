import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '@/services/budget.service';
import type { Transaction, TransactionStatus } from '@/types/models';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import { useToastStore } from '@/store/useToastStore';
import { apiErrorMessage } from '@/lib/apiError';

export function useDebts(params?: { status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.budget.debts(params),
    queryFn: async () => {
      const res = await budgetService.getDebts(params);
      return res.data ?? [];
    },
    enabled: isAuthenticated,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCredits(params?: { status?: string }) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.budget.credits(params),
    queryFn: async () => {
      const res = await budgetService.getCredits(params);
      return res.data ?? [];
    },
    enabled: isAuthenticated,
    staleTime: 10_000,
    refetchInterval: 15_000,
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

export function useSendReminder() {
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.sendReminder(transactionId),
    onSuccess: () => push({ type: 'success', message: 'Напоминание отправлено' }),
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отправить напоминание') }),
  });
}
