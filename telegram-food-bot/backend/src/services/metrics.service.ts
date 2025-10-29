import { prisma } from '../database/client';
import { logger } from '../utils/logger';

/**
 * Application metrics
 */
export interface Metrics {
  totalPolls: number;
  activePolls: number;
  completedPolls: number;
  totalVotes: number;
  totalUsers: number;
  totalTransactions: number;
  avgResponseTime: number;
  errors24h: number;
  timestamp: string;
}

/**
 * Metrics Service
 * Собирает и предоставляет метрики приложения
 */
class MetricsService {
  private metrics: Metrics = {
    totalPolls: 0,
    activePolls: 0,
    completedPolls: 0,
    totalVotes: 0,
    totalUsers: 0,
    totalTransactions: 0,
    avgResponseTime: 0,
    errors24h: 0,
    timestamp: new Date().toISOString(),
  };

  private responseTimes: number[] = [];
  private readonly MAX_RESPONSE_TIMES = 100;

  /**
   * Собрать все метрики из базы данных
   */
  async collectMetrics(): Promise<Metrics> {
    try {
      const [
        totalPolls,
        activePolls,
        completedPolls,
        totalVotes,
        totalUsers,
        totalTransactions,
      ] = await Promise.all([
        prisma.poll.count(),
        prisma.poll.count({ where: { status: 'ACTIVE' } }),
        prisma.poll.count({ where: { status: 'COMPLETED' } }),
        prisma.vote.count(),
        prisma.user.count(),
        prisma.transaction.count(),
      ]);

      this.metrics = {
        totalPolls,
        activePolls,
        completedPolls,
        totalVotes,
        totalUsers,
        totalTransactions,
        avgResponseTime: this.calculateAvgResponseTime(),
        errors24h: this.metrics.errors24h,
        timestamp: new Date().toISOString(),
      };

      logger.debug('Metrics collected', this.metrics);
      return this.metrics;
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
      return this.metrics;
    }
  }

  /**
   * Получить текущие метрики (без запроса к БД)
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Записать время ответа
   */
  recordResponseTime(time: number): void {
    this.responseTimes.push(time);

    // Храним только последние N значений
    if (this.responseTimes.length > this.MAX_RESPONSE_TIMES) {
      this.responseTimes.shift();
    }
  }

  /**
   * Вычислить среднее время ответа
   */
  private calculateAvgResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  /**
   * Инкрементировать счётчик ошибок
   */
  incrementErrors(): void {
    this.metrics.errors24h++;
  }

  /**
   * Сбросить счётчик ошибок (вызывать каждые 24 часа)
   */
  resetErrorCount(): void {
    this.metrics.errors24h = 0;
    logger.info('Error count reset');
  }

  /**
   * Получить детальную статистику
   */
  async getDetailedStats() {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [polls24h, votes24h, users24h, polls7d, votes7d] = await Promise.all([
        prisma.poll.count({ where: { createdAt: { gte: last24h } } }),
        prisma.vote.count({ where: { createdAt: { gte: last24h } } }),
        prisma.user.count({ where: { createdAt: { gte: last24h } } }),
        prisma.poll.count({ where: { createdAt: { gte: last7d } } }),
        prisma.vote.count({ where: { createdAt: { gte: last7d } } }),
      ]);

      return {
        last24h: {
          polls: polls24h,
          votes: votes24h,
          users: users24h,
        },
        last7d: {
          polls: polls7d,
          votes: votes7d,
        },
        avgVotesPerPoll: this.metrics.totalPolls > 0
          ? Math.round(this.metrics.totalVotes / this.metrics.totalPolls)
          : 0,
      };
    } catch (error) {
      logger.error('Failed to get detailed stats', { error });
      return null;
    }
  }
}

export const metricsService = new MetricsService();

// Сброс счётчика ошибок каждые 24 часа
setInterval(() => {
  metricsService.resetErrorCount();
}, 24 * 60 * 60 * 1000);
