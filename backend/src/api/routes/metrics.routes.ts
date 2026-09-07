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
 * GET /api/metrics/prometheus
 * Показатели в формате Prometheus — для сборщика, а не для человека.
 *
 * Реестр `prom-client` в сервисе жил с самого начала, счётчики и датчики в
 * него писались, но НИ ОДИН маршрут его не отдавал: наружу не выходило
 * ничего. Считать метрику и никому её не показывать — то же самое, что не
 * считать.
 *
 * `collectMetrics()` вызывается перед выдачей: датчики, которые читаются из
 * БД (активные голосования, очередь уведомлений), иначе отдавали бы значения
 * с прошлого обращения к `/api/metrics`, то есть, возможно, никогда не
 * заполненные.
 *
 * Доступ тот же, что у остальных служебных маршрутов: `ENABLE_OPERATIONS_API`
 * плюс `X-Operations-Secret` (см. `router.use` выше). Сборщик ходит с сервера
 * с этим заголовком.
 */
router.get('/prometheus', async (req, res) => {
  try {
    await metricsService.collectMetrics();
    const registry = metricsService.getRegistry();
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  } catch (error) {
    logger.error('Failed to render Prometheus metrics', { error });
    res.status(500).json({ error: 'Failed to render Prometheus metrics' });
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
