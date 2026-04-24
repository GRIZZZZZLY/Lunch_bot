import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  recurringPollService,
  type CreateRecurringPollInput,
  type UpdateRecurringPollInput,
} from '@/services/recurring-poll.service';
import { useToastStore } from '@/store/useToastStore';

const errMsg = (err: unknown, fb: string) => (err instanceof Error ? err.message : fb);

export function useRecurringSchedule(groupId: number | null) {
  return useQuery({
    queryKey: ['recurring', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await recurringPollService.getByGroup(groupId);
      return res.data ?? null;
    },
    enabled: !!groupId,
    staleTime: 30_000,
  });
}

export function useCreateRecurringPoll() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: (input: CreateRecurringPollInput) => recurringPollService.create(input),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['recurring', vars.groupId] });
      push({ type: 'success', message: 'Расписание сохранено', title: '🔁 Автозапуск настроен' });
    },
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось сохранить расписание') }),
  });
}

export function useUpdateRecurringPoll() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateRecurringPollInput }) =>
      recurringPollService.update(id, input),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['recurring', vars.input.groupId] });
      push({ type: 'success', message: 'Расписание обновлено' });
    },
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось обновить расписание') }),
  });
}

export function useToggleRecurringPoll() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id, groupId }: { id: number; groupId: number }) =>
      recurringPollService.toggle(id, groupId),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['recurring', vars.groupId] });
    },
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось переключить расписание') }),
  });
}

export function useDeleteRecurringPoll() {
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  return useMutation({
    mutationFn: ({ id }: { id: number; groupId: number }) => recurringPollService.remove(id),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['recurring', vars.groupId] });
      push({ type: 'info', message: 'Расписание удалено' });
    },
    onError: (err) => push({ type: 'error', message: errMsg(err, 'Не удалось удалить расписание') }),
  });
}
