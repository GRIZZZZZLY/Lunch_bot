import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useActivePolls } from './usePolls';
import { budgetService, Transaction } from '../services/budget.service';

export type WidgetScenario =
  | 'urgent-debt'
  | 'waiting-confirmation'
  | 'success-message'
  | 'overview'
  | 'responsible-view'
  | 'hidden';

export interface BudgetWidgetData {
  scenario: WidgetScenario;
  currentDebt: Transaction | null;
  otherDebts: Transaction[];
  credits: Transaction[];
  isResponsible: boolean;
  pollJustCompleted: boolean;
  totalDebts: number;
  totalCredits: number;
  isLoading: boolean;
}

/**
 * Хук для логики адаптивного виджета бюджет-трекера
 */
export function useBudgetWidget(): BudgetWidgetData {
  const { user } = useAuth();
  const { data: activePolls } = useActivePolls();
  
  // Получаем все долги и кредиты с улучшенной обработкой ошибок
  const { data: allDebts = [], isLoading: isLoadingDebts } = useQuery({
    queryKey: ['budget', 'debts', user?.id],
    queryFn: async () => {
      try {
        const result = await budgetService.getDebts(user!.id, undefined, {
          activeOnly: true,
        });
        return result || [];
      } catch {
        // Возвращаем пустой массив вместо throw для graceful degradation
        return [];
      }
    },
    enabled: !!user,
    staleTime: 30000, // Данные актуальны 30 секунд
    gcTime: 60000, // Хранить в кэше 1 минуту
    refetchInterval: 60000, // Обновляем каждые 60 секунд (было 10)
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: 2000,
    throwOnError: false,
    meta: {
      errorMessage: 'Failed to fetch debts',
    },
  });

  const { data: credits = [], isLoading: isLoadingCredits } = useQuery({
    queryKey: ['budget', 'credits', user?.id],
    queryFn: async () => {
      try {
        const result = await budgetService.getCredits(user!.id, undefined, {
          activeOnly: true,
        });
        return result || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
    staleTime: 30000, // Данные актуальны 30 секунд
    gcTime: 60000, // Хранить в кэше 1 минуту
    refetchInterval: 60000, // Обновляем каждые 60 секунд (было 10)
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: 2000,
    throwOnError: false,
    meta: {
      errorMessage: 'Failed to fetch credits',
    },
  });

  const isLoading = isLoadingDebts || isLoadingCredits;
  
  const activePoll = activePolls?.[0];
  
  const recentDebts = useMemo(() => {
    return allDebts;
  }, [allDebts]);
  
  // 2. Определяем временной контекст (голосование завершено менее 5 минут назад)
  const pollJustCompleted = useMemo(() => {
    if (!activePoll || activePoll.status !== 'COMPLETED') return false;
    
    const endTime = activePoll.endedAt ? new Date(activePoll.endedAt).getTime() : Date.now();
    const minutesSinceEnd = (Date.now() - endTime) / 1000 / 60;
    
    return minutesSinceEnd <= 5;
  }, [activePoll]);
  
  // 3. Определяем роль пользователя в текущем голосовании
  const currentDebt = useMemo(() => {
    if (!activePoll || !recentDebts.length) return null;
    return recentDebts.find(d => d.pollId === activePoll.id) || null;
  }, [activePoll, recentDebts]);
  
  const currentCredit = useMemo(() => {
    if (!activePoll || !credits.length) return null;
    return credits.find(c => c.pollId === activePoll.id) || null;
  }, [activePoll, credits]);
  
  const isResponsible = !!currentCredit;
  
  // 4. Определяем сценарий отображения
  const scenario: WidgetScenario = useMemo(() => {
    // Нет долгов и кредитов → скрываем виджет
    if (!recentDebts.length && !credits.length) {
      return 'hidden';
    }
    
    // Только что подтвердили → показываем успех на 3 секунды
    if (currentDebt?.status === 'CONFIRMED' && pollJustCompleted) {
      return 'success-message';
    }
    
    // Я ответственный в текущем голосовании (показываем всегда, не только первые 5 минут)
    if (isResponsible) {
      return 'responsible-view';
    }
    
    // Есть текущий долг и он оплачен, но не подтвержден (показываем всегда)
    if (currentDebt?.status === 'PAID') {
      return 'waiting-confirmation';
    }
    
    // Есть текущий долг и он PENDING (показываем всегда)
    if (currentDebt?.status === 'PENDING') {
      return 'urgent-debt';
    }
    
    // Все остальные случаи → обзор всех финансов
    return 'overview';
  }, [recentDebts, credits, currentDebt, isResponsible, pollJustCompleted]);
  
  // 5. Разделяем долги на текущие и старые
  const otherDebts = useMemo(() => {
    if (!recentDebts.length) return [];
    
    if (scenario === 'urgent-debt' || scenario === 'waiting-confirmation') {
      return recentDebts.filter(d => d.pollId !== activePoll?.id);
    }
    
    return recentDebts;
  }, [recentDebts, activePoll, scenario]);
  
  // 6. Рассчитываем суммы
  const totalDebts = useMemo(() => {
    return recentDebts.reduce((sum, d) => sum + d.amount, 0);
  }, [recentDebts]);
  
  const totalCredits = useMemo(() => {
    return credits.reduce((sum, c) => sum + c.amount, 0);
  }, [credits]);
  
  return {
    scenario,
    currentDebt,
    otherDebts,
    credits,
    isResponsible,
    pollJustCompleted,
    totalDebts,
    totalCredits,
    isLoading,
  };
}
