import { Router } from 'express';
import { metricsService } from '../../services/metrics.service';
import { logger } from '../../utils/logger';
import { adminMiddleware, telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

router.use(telegramAuthMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/metrics
 * Получить текущие метрики приложения
 */
router.get('/', async (req, res) => {
  try {
    const metrics = await metricsService.collectMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', { error });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * GET /api/metrics/detailed
 * Получить детальную статистику
 */
router.get('/detailed', async (req, res) => {
  try {
    const stats = await metricsService.getDetailedStats();
    const currentMetrics = metricsService.getMetrics();

    res.json({
      ...currentMetrics,
      detailed: stats,
    });
  } catch (error) {
    logger.error('Failed to get detailed stats', { error });
    res.status(500).json({ error: 'Failed to get detailed stats' });
  }
});

export default router;
