import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  suggestionsService,
  type CreateSuggestionInput,
} from '@/services/suggestions.service';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import type { SuggestionStatus } from '@/types/models';

export function useSuggestions(params?: {
  status?: SuggestionStatus;
  limit?: number;
  offset?: number;
  groupId?: string;
}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.suggestions.list(params),
    queryFn: async () => {
      const res = await suggestionsService.list(params);
      return res.data ?? [];
    },
    enabled: isAuthenticated,
    staleTime: 15_000,
  });
}

export function useCreateSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { data: CreateSuggestionInput; groupId?: string }) =>
      suggestionsService.create(vars.data, vars.groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.suggestions.all }),
  });
}

export function useApproveSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; groupId?: string }) =>
      suggestionsService.approve(vars.id, vars.groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.suggestions.all });
      qc.invalidateQueries({ queryKey: queryKeys.menu.all });
    },
  });
}

export function useRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; reason?: string; groupId?: string }) =>
      suggestionsService.reject(vars.id, vars.reason, vars.groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.suggestions.all }),
  });
}

export function useDeleteSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; groupId?: string }) =>
      suggestionsService.remove(vars.id, vars.groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.suggestions.all }),
  });
}
