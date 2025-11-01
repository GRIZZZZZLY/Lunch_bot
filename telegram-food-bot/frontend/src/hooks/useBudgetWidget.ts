import { useMemo, useEffect } from 'react';
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
  const { data: allDebts = [], isLoading: isLoadingDebts, error: debtsError } = useQuery({
    queryKey: ['budget', 'debts', user?.id],
    queryFn: async () => {
      try {
        console.log('[useBudgetWidget] Fetching debts for user:', user?.id);
        const result = await budgetService.getDebts(user!.id);
        console.log('[useBudgetWidget] ✅ Debts fetched:', result?.length || 0);
        return result || [];
      } catch (error) {
        console.error('[useBudgetWidget] ❌ Debts fetch error:', error);
        // Возвращаем пустой массив вместо throw для graceful degradation
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 10000, // Обновляем каждые 10 секунд
    retry: 1, // Одна попытка повтора
    retryDelay: 2000,
    // CRITICAL: Отключаем показ ошибок через React Query Error Boundary
    throwOnError: false,
    // Отключаем логирование ошибок в консоль от React Query
    meta: {
      errorMessage: 'Failed to fetch debts',
    },
  });

  const { data: credits = [], isLoading: isLoadingCredits, error: creditsError } = useQuery({
    queryKey: ['budget', 'credits', user?.id],
    queryFn: async () => {
      try {
        console.log('[useBudgetWidget] Fetching credits for user:', user?.id);
        const result = await budgetService.getCredits(user!.id);
        console.log('[useBudgetWidget] ✅ Credits fetched:', result?.length || 0);
        return result || [];
      } catch (error) {
        console.error('[useBudgetWidget] ❌ Credits fetch error:', error);
        // Возвращаем пустой массив вместо throw для graceful degradation
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 10000,
    retry: 1,
    retryDelay: 2000,
    // CRITICAL: Отключаем показ ошибок через React Query Error Boundary
    throwOnError: false,
    // Отключаем логирование ошибок в консоль от React Query
    meta: {
      errorMessage: 'Failed to fetch credits',
    },
  });

  const isLoading = isLoadingDebts || isLoadingCredits;
  
  const activePoll = activePolls?.[0];
  
  // Debug logging - убраны popup alert для предотвращения крашей
  useEffect(() => {
    console.log('[useBudgetWidget] Data:', {
      user: user?.id,
      allDebts: allDebts?.length,
      credits: credits?.length,
      isLoading,
      activePoll: activePoll?.id,
      debtsError: debtsError ? String(debtsError) : null,
      creditsError: creditsError ? String(creditsError) : null,
    });
    
    // Логируем ошибки без показа popup (чтобы не крашить приложение)
    if (debtsError) {
      console.error('[useBudgetWidget] ❌ Debts fetch failed:', {
        error: debtsError,
        message: debtsError instanceof Error ? debtsError.message : String(debtsError),
        stack: debtsError instanceof Error ? debtsError.stack : undefined,
      });
    }
    if (creditsError) {
      console.error('[useBudgetWidget] ❌ Credits fetch failed:', {
        error: creditsError,
        message: creditsError instanceof Error ? creditsError.message : String(creditsError),
        stack: creditsError instanceof Error ? creditsError.stack : undefined,
      });
    }
  }, [user, allDebts, credits, isLoading, activePoll, debtsError, creditsError]);
  
  // 1. Фильтруем старые CONFIRMED долги (подтверждённые более 2 минут назад)
  const recentDebts = useMemo(() => {
    return allDebts.filter(debt => {
      // Если не CONFIRMED, показываем всегда
      if (debt.status !== 'CONFIRMED') return true;
      
      // Если CONFIRMED, показываем только если подтверждено менее 2 минут назад
      if (debt.confirmedAt) {
        const minutesSinceConfirmed = (Date.now() - new Date(debt.confirmedAt).getTime()) / 1000 / 60;
        return minutesSinceConfirmed <= 2;
      }
      
      return false;
    });
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
  }, [recentDebts, credits, currentDebt, currentCredit, isResponsible, pollJustCompleted]);
  
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
