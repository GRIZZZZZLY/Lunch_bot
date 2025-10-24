import express from 'express';
import { createApiServer } from '../../../api/server';

/**
 * Создаёт Express app для тестирования
 * Отключает лишние middleware (логирование, статику)
 */
export function createTestApp(): express.Application {
  const app = createApiServer();
  return app;
}
