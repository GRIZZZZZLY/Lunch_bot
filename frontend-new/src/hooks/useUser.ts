import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService, type PaymentInfo } from '@/services/user.service';
import { pollsService } from '@/services/polls.service';
import { queryKeys } from '@/lib/queryClient';
import { useAppStore } from '@/store/useAppStore';

export function useMe() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await userService.getMe()).data,
    enabled: authStatus === 'authenticated',
    staleTime: 60_000,
  });
}

export function useMyGroups() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: ['user', 'groups'],
    queryFn: async () => (await userService.getMyGroups()).data ?? [],
    enabled: authStatus === 'authenticated',
    staleTime: 60_000,
  });
}

export function usePaymentInfo() {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: ['user', 'payment-info'],
    queryFn: async (): Promise<PaymentInfo | undefined> => (await userService.getPaymentInfo()).data,
    enabled: authStatus === 'authenticated',
    staleTime: 60_000,
  });
}

export function useUpdatePaymentInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PaymentInfo) => userService.updatePaymentInfo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'payment-info'] });
    },
  });
}

/* Профиль и расчёт серии читают одну и ту же историю. Раньше страница просила
   30 записей, а useStreak — 90: разные ключи React Query, а значит два сетевых
   запроса к одному эндпоинту при каждом открытии профиля. Один лимит на двоих
   склеивает их в один запрос. */
export const PROFILE_HISTORY_LIMIT = 90;

/* См. menuItemsQueryOptions: те же опции нужны предзагрузке на простое. */
export function pollHistoryQueryOptions(params?: { limit?: number; offset?: number }) {
  return {
    queryKey: queryKeys.polls.history(params),
    queryFn: async () => {
      const res = await pollsService.getHistory(params);
      return res.data ?? [];
    },
    staleTime: 30_000,
  };
}

export function usePollHistory(params?: { limit?: number; offset?: number }) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    ...pollHistoryQueryOptions(params),
    enabled: authStatus === 'authenticated',
  });
}
