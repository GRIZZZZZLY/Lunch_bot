/**
 * Insights Service - Budget Analytics
 * Sprint 6: Вариант 2 (Оптимальный)
 */

import { apiService } from './api.service';

export interface BudgetInsight {
  totalSpent: number;
  averagePerDay: number;
  daysActive: number;
  savingsVsExternal: number;
  mostExpensiveDay: {
    date: string;
    amount: number;
  };
  cheapestDay: {
    date: string;
    amount: number;
  };
  trend: 'up' | 'down' | 'stable';
  projectedMonthly: number;
}

export interface CategoryInsight {
  totalVotes: number;
  categories: Array<{
    category: string;
    count: number;
    percentage: number;
    items: string[];
  }>;
  favoriteCategory: string;
}

class InsightsService {
  /**
   * Получить аналитику бюджета для текущего пользователя
   */
  async getBudgetInsights(): Promise<BudgetInsight> {
    const response = await apiService.get<{ success: boolean; data: BudgetInsight }>(
      '/insights/budget'
    );
    return response.data.data;
  }

  /**
   * Получить аналитику бюджета для конкретного пользователя
   */
  async getBudgetInsightsByUserId(userId: number): Promise<BudgetInsight> {
    const response = await apiService.get<{ success: boolean; data: BudgetInsight }>(
      `/insights/budget/${userId}`
    );
    return response.data.data;
  }

  /**
   * Получить статистику по категориям блюд
   */
  async getCategoryInsights(): Promise<CategoryInsight> {
    const response = await apiService.get<{ success: boolean; data: CategoryInsight }>(
      '/insights/categories'
    );
    return response.data.data;
  }
}

export const insightsService = new InsightsService();
