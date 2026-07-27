import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetService } from '@/services/budget.service';
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

export function useMarkPaid() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.markPaid(transactionId),
    onSuccess: () => {
      invalidateBudget(qc);
      push({ type: 'success', message: 'Отмечено как оплачено. Ждём подтверждения.' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отметить оплату') }),
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.confirmPayment(transactionId),
    onSuccess: () => {
      invalidateBudget(qc);
      push({ type: 'success', message: 'Оплата подтверждена' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось подтвердить оплату') }),
  });
}

export function useCancelMark() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (transactionId: number) => budgetService.cancelMark(transactionId),
    onSuccess: () => {
      invalidateBudget(qc);
      push({ type: 'info', message: 'Отметка снята' });
    },
    onError: (err) => push({ type: 'error', message: apiErrorMessage(err, 'Не удалось отменить отметку') }),
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
