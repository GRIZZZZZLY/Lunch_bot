import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../../services/metrics.service';

/**
 * Middleware для отслеживания времени ответа
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  // Когда ответ завершён
  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsService.recordResponseTime(duration);

    // Инкрементируем счётчик ошибок при 5xx статусах
    if (res.statusCode >= 500) {
      metricsService.incrementErrors();
    }
  });

  next();
}
