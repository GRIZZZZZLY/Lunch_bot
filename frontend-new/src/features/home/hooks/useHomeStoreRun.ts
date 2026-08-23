/**
 * Закупки на главной: активные забеги и создание нового.
 *
 * Третий независимый сценарий главной (задача 12). Создание уводит на экран
 * забега сразу после ответа сервера — иначе человек остаётся на главной и не
 * понимает, создалось ли что-нибудь.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useActiveStoreRuns, useCreateStoreRun } from '@/hooks/useStoreRun';
import { useToast } from '@/hooks/useToast';
import { useAppStore } from '@/store/useAppStore';

export interface CreateStoreRunInput {
  storeName: string;
  collectMinutes: number;
}

export function useHomeStoreRun() {
  const navigate = useNavigate();
  const toast = useToast();
  const currentGroupId = useAppStore((s) => s.currentGroupId);

  const runsQuery = useActiveStoreRuns();
  const { data: activeRuns = [] } = runsQuery;
  const createStoreRun = useCreateStoreRun();

  const createRun = useCallback(
    async (input: CreateStoreRunInput): Promise<boolean> => {
      if (!currentGroupId) {
        toast.error('Нет активной группы для закупки');
        return false;
      }

      try {
        const res = await createStoreRun.mutateAsync({
          groupId: Number(currentGroupId),
          ...input,
        });
        const newId = res.data?.id;
        if (newId) navigate(`/store-run/${newId}`);
        return true;
      } catch {
        /* Сообщение показывает сам хук мутации; здесь только «не закрывать
           шторку», чтобы человек мог поправить ввод. */
        return false;
      }
    },
    [currentGroupId, createStoreRun, navigate, toast],
  );

  return {
    activeRuns,
    createStoreRun,
    createRun,
    queries: { runsQuery },
  };
}
