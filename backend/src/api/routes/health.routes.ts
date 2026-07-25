import { Router } from 'express';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';
import { cacheService } from '../../services/cache.service';

const router = Router();

/**
 * GET /health
 * Health check endpoint для мониторинга
 */
router.get('/', async (req, res) => {
  try {
    // Проверка подключения к базе данных
    await prisma.$queryRaw`SELECT 1`;

    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    res.json({
      status: 'healthy',
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      uptimeSeconds: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    logger.error('Health check failed', { error });

    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/ready
 * Readiness check (для Kubernetes/Docker)
 */
router.get('/ready', async (req, res) => {
  try {
    // Проверяем что приложение полностью готово
    await prisma.$queryRaw`SELECT 1`;
    const cacheReady = await cacheService.healthCheck();
    if (!cacheReady) {
      throw new Error('Redis is not ready');
    }

    res.status(200).json({
      ready: true,
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
    });
  }
});

/**
 * GET /health/live
 * Liveness check (для Kubernetes/Docker)
 */
router.get('/live', (req, res) => {
  // Простая проверка что процесс жив
  res.status(200).json({
    alive: true,
  });
});

export default router;
