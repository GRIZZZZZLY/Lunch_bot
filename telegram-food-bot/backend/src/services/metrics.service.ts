import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

/**
 * Application metrics with Prometheus
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
 * Metrics Service with Prometheus
 * Собирает и экспортирует метрики в формате Prometheus
 */
class MetricsService {
  private registry: Registry;

  // Prometheus counters
  private pollsCreatedCounter: Counter;
  private votesCounter: Counter;
  private errorsCounter: Counter;
  private httpRequestsCounter: Counter;

  // Prometheus gauges
  private activePollsGauge: Gauge;
  private totalUsersGauge: Gauge;

  // Prometheus histograms
  private httpRequestDuration: Histogram;

  // Legacy metrics for compatibility
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

  constructor() {
    // Create a new registry
    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc)
    collectDefaultMetrics({ register: this.registry });

    // Initialize custom metrics
    this.pollsCreatedCounter = new Counter({
      name: 'food_bot_polls_created_total',
      help: 'Total number of polls created',
      registers: [this.registry],
    });

    this.votesCounter = new Counter({
      name: 'food_bot_votes_total',
      help: 'Total number of votes cast',
      registers: [this.registry],
    });

    this.errorsCounter = new Counter({
      name: 'food_bot_errors_total',
      help: 'Total number of errors',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.httpRequestsCounter = new Counter({
      name: 'food_bot_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.activePollsGauge = new Gauge({
      name: 'food_bot_active_polls',
      help: 'Number of currently active polls',
      registers: [this.registry],
    });

    this.totalUsersGauge = new Gauge({
      name: 'food_bot_users_total',
      help: 'Total number of registered users',
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'food_bot_http_request_duration_ms',
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    logger.info('✅ Metrics service initialized with Prometheus');
  }

  /**
   * Получить Registry для экспорта метрик
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Получить метрики в формате Prometheus
   */
  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

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

      // Update Prometheus gauges
      this.activePollsGauge.set(activePolls);
      this.totalUsersGauge.set(totalUsers);

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
   * Инкрементировать счётчик созданных polls
   */
  incrementPollsCreated(): void {
    this.pollsCreatedCounter.inc();
  }

  /**
   * Инкрементировать счётчик голосов
   */
  incrementVotes(): void {
    this.votesCounter.inc();
  }

  /**
   * Инкрементировать счётчик ошибок
   */
  incrementErrors(type: string = 'unknown'): void {
    this.errorsCounter.inc({ type });
    this.metrics.errors24h++;
  }

  /**
   * Записать HTTP запрос
   */
  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    this.httpRequestsCounter.inc({ method, route, status: status.toString() });
    this.httpRequestDuration.observe({ method, route, status: status.toString() }, duration);
    this.recordResponseTime(duration);
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

// Сбор метрик каждые 60 секунд
setInterval(async () => {
  await metricsService.collectMetrics();
}, 60 * 1000);
