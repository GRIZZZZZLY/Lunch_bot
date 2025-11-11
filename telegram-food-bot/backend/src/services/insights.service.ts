/**
 * InsightsService - Budget Analytics & Insights
 * Sprint 6: Вариант 2 (Оптимальный)
 * 
 * Анализирует транзакции и предоставляет статистику по бюджету
 */

import { prisma } from '../database/client';
import { logger } from '../utils/logger';

export interface BudgetInsight {
  totalSpent: number; // Всего потрачено
  averagePerDay: number; // Средний чек
  daysActive: number; // Дней активности
  savingsVsExternal: number; // Экономия vs внешние заказы
  mostExpensiveDay: {
    date: string;
    amount: number;
  };
  cheapestDay: {
    date: string;
    amount: number;
  };
  trend: 'up' | 'down' | 'stable';
  projectedMonthly: number; // Прогноз на месяц
}

export class InsightsService {
  /**
   * Получить аналитику бюджета для пользователя
   */
  static async getBudgetInsights(userId: number): Promise<BudgetInsight> {
    try {
      // Получаем все подтвержденные транзакции за последние 30 дней
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const transactions = await prisma.transaction.findMany({
        where: {
          fromUserId: userId,
          status: 'CONFIRMED',
          confirmedAt: {
            gte: thirtyDaysAgo,
          },
        },
        include: {
          poll: {
            include: {
              result: true,
            },
          },
        },
        orderBy: {
          confirmedAt: 'asc',
        },
      });

      // Если нет транзакций, возвращаем пустую статистику
      if (transactions.length === 0) {
        return {
          totalSpent: 0,
          averagePerDay: 0,
          daysActive: 0,
          savingsVsExternal: 0,
          mostExpensiveDay: {
            date: new Date().toISOString().split('T')[0],
            amount: 0,
          },
          cheapestDay: {
            date: new Date().toISOString().split('T')[0],
            amount: 0,
          },
          trend: 'stable',
          projectedMonthly: 0,
        };
      }

      // Вычисляем общую сумму
      const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      // Группируем транзакции по дням
      const transactionsByDay = new Map<string, number>();
      transactions.forEach((t) => {
        const confirmedDate = t.confirmedAt || t.createdAt;
        const dateKey = confirmedDate.toISOString().split('T')[0];
        const current = transactionsByDay.get(dateKey) || 0;
        transactionsByDay.set(dateKey, current + Number(t.amount));
      });

      // Количество дней активности
      const daysActive = transactionsByDay.size;

      // Средний чек
      const averagePerDay = daysActive > 0 ? Math.round(totalSpent / daysActive) : 0;

      // Находим самый дорогой и самый дешевый день
      let mostExpensiveDay = { date: '', amount: 0 };
      let cheapestDay = { date: '', amount: Infinity };

      transactionsByDay.forEach((amount, date) => {
        if (amount > mostExpensiveDay.amount) {
          mostExpensiveDay = { date, amount: Math.round(amount) };
        }
        if (amount < cheapestDay.amount) {
          cheapestDay = { date, amount: Math.round(amount) };
        }
      });

      // Если нет данных, используем текущую дату
      if (mostExpensiveDay.date === '') {
        mostExpensiveDay.date = new Date().toISOString().split('T')[0];
      }
      if (cheapestDay.date === '' || cheapestDay.amount === Infinity) {
        cheapestDay = { date: new Date().toISOString().split('T')[0], amount: 0 };
      }

      // Определяем тренд (сравниваем первую и вторую половину периода)
      const trend = this.calculateTrend(transactions);

      // Рассчитываем экономию vs внешние заказы
      // Предполагаем, что внешний заказ стоит в среднем на 30% дороже
      const savingsVsExternal = Math.round(totalSpent * 0.3);

      // Прогноз на месяц (30 дней)
      const projectedMonthly = daysActive > 0 ? Math.round((totalSpent / daysActive) * 30) : 0;

      return {
        totalSpent: Math.round(totalSpent),
        averagePerDay,
        daysActive,
        savingsVsExternal,
        mostExpensiveDay,
        cheapestDay,
        trend,
        projectedMonthly,
      };
    } catch (error) {
      logger.error('Error getting budget insights:', error);
      throw error;
    }
  }

  /**
   * Определить тренд трат (растут/падают/стабильны)
   */
  private static calculateTrend(transactions: any[]): 'up' | 'down' | 'stable' {
    if (transactions.length < 4) {
      return 'stable'; // Недостаточно данных
    }

    // Разделяем транзакции на две половины
    const midpoint = Math.floor(transactions.length / 2);
    const firstHalf = transactions.slice(0, midpoint);
    const secondHalf = transactions.slice(midpoint);

    // Вычисляем средние суммы для каждой половины
    const avgFirst = firstHalf.reduce((sum, t) => sum + Number(t.amount), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, t) => sum + Number(t.amount), 0) / secondHalf.length;

    // Определяем тренд (разница больше 10%)
    const difference = ((avgSecond - avgFirst) / avgFirst) * 100;

    if (difference > 10) return 'up';
    if (difference < -10) return 'down';
    return 'stable';
  }

  /**
   * Получить статистику по категориям блюд
   */
  static async getCategoryInsights(userId: number): Promise<any> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Получаем все голоса пользователя за последние 30 дней
      const votes = await prisma.vote.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        include: {
          menuItem: true,
        },
      });

      // Группируем по категориям
      const categoryStats = new Map<string, { count: number; items: string[] }>();
      votes.forEach((vote) => {
        if (vote.menuItem && vote.menuItem.category && vote.menuItem.name) {
          const category = vote.menuItem.category;
          const name = vote.menuItem.name;
          const current = categoryStats.get(category) || { count: 0, items: [] };
          current.count++;
          if (!current.items.includes(name)) {
            current.items.push(name);
          }
          categoryStats.set(category, current);
        }
      });

      // Конвертируем в массив и сортируем
      const categories = Array.from(categoryStats.entries())
        .map(([category, data]) => ({
          category,
          count: data.count,
          percentage: Math.round((data.count / votes.length) * 100),
          items: data.items,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        totalVotes: votes.length,
        categories,
        favoriteCategory: categories[0]?.category || 'Пока нет данных',
      };
    } catch (error) {
      logger.error('Error getting category insights:', error);
      throw error;
    }
  }
}
