import { Router } from 'express';
import { metricsService } from '../../services/metrics.service';
import { logger } from '../../utils/logger';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { operationsApiMiddleware } from '../middleware/operations-api';
import { getSSEConnectionCount } from '../controllers/sse.controller';

const router = Router();

/* Метрики относятся к инстансу целиком, а не к какой-либо группе, поэтому
   «администратор группы» здесь ничего не выражает. Прежний глобальный флаг
   users.is_admin отменён как понятие, и служебные операции закрыты отдельным
   секретом: ENABLE_OPERATIONS_API=true плюс заголовок X-Operations-Secret.
   Из интерфейса эти маршруты не вызываются — только с сервера. */
router.use(telegramAuthMiddleware);
router.use(operationsApiMiddleware);

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

/**
 * GET /api/metrics/sse
 * Получить статистику SSE соединений
 */
router.get('/sse', (req, res) => {
  try {
    const sseStats = getSSEConnectionCount();
    res.json({
      success: true,
      data: sseStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get SSE metrics', { error });
    res.status(500).json({ error: 'Failed to get SSE metrics' });
  }
});

export default router;
