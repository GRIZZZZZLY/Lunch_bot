import { Router } from 'express';
import { captureException, captureMessage } from '../../config/sentry.config';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Тестовые endpoints для проверки мониторинга
 * ВАЖНО: Использовать только в development/staging!
 */

/**
 * GET /api/test/sentry-error
 * Тест отправки ошибки в Sentry
 */
router.get('/sentry-error', (req, res) => {
  try {
    // Генерируем тестовую ошибку
    throw new Error('🧪 Test Sentry Error - Backend');
  } catch (error) {
    captureException(error as Error, {
      testEndpoint: '/api/test/sentry-error',
      timestamp: new Date().toISOString(),
    });

    logger.error('Test error sent to Sentry', { error });

    res.status(500).json({
      success: true,
      message: 'Test error sent to Sentry',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/test/sentry-message
 * Тест отправки сообщения в Sentry
 */
router.get('/sentry-message', (req, res) => {
  captureMessage('🧪 Test Sentry Message - Backend', 'info', {
    testEndpoint: '/api/test/sentry-message',
    timestamp: new Date().toISOString(),
  });

  logger.info('Test message sent to Sentry');

  res.json({
    success: true,
    message: 'Test message sent to Sentry',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/test/slow-request
 * Тест медленного запроса (для metrics)
 */
router.get('/slow-request', async (req, res) => {
  const delay = parseInt(req.query.delay as string) || 2000;

  logger.info(`Simulating slow request: ${delay}ms`);

  await new Promise(resolve => setTimeout(resolve, delay));

  res.json({
    success: true,
    delay,
    message: 'Slow request completed',
  });
});

/**
 * GET /api/test/memory-leak
 * Тест утечки памяти (осторожно!)
 */
router.get('/memory-leak', (req, res) => {
  const size = parseInt(req.query.size as string) || 100;
  const leak: any[] = [];

  // Создаём массив объектов для симуляции утечки
  for (let i = 0; i < size * 1000; i++) {
    leak.push({
      index: i,
      data: new Array(1000).fill('x'),
    });
  }

  logger.warn(`Memory leak simulated: ${size}MB`);

  res.json({
    success: true,
    message: `Simulated memory leak of ~${size}MB`,
    leakedObjects: leak.length,
  });
});

/**
 * GET /api/test/database-error
 * Тест ошибки базы данных
 */
router.get('/database-error', async (req, res) => {
  try {
    // Попытка выполнить некорректный запрос
    const { prisma } = await import('../../database/client');
    await prisma.$queryRaw`SELECT * FROM non_existent_table`;

    res.json({ success: true });
  } catch (error) {
    logger.error('Database error (expected)', { error });
    captureException(error as Error, {
      testEndpoint: '/api/test/database-error',
    });

    res.status(500).json({
      success: true,
      message: 'Database error sent to Sentry',
      error: (error as Error).message,
    });
  }
});

export default router;
