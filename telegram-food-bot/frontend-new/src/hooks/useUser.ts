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

export function usePollHistory(params?: { limit?: number; offset?: number }) {
  const authStatus = useAppStore((s) => s.authStatus);
  return useQuery({
    queryKey: queryKeys.polls.history(params),
    queryFn: async () => {
      const res = await pollsService.getHistory(params);
      return res.data ?? [];
    },
    enabled: authStatus === 'authenticated',
    staleTime: 30_000,
  });
}
