import { Router } from 'express';
import { SeasonController } from '../controllers/season.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { operationsApiMiddleware } from '../middleware/operations-api';
import { writeLimiter } from '../middleware/rate-limiter';
import {
  seasonIdParam,
  seasonLeaderboardQuery,
  seasonListQuery,
  seasonUserIdParam,
  seasonUserStatsParams,
} from '../schemas/season';

const router = Router();
const seasonMutationIdempotency = createIdempotencyMiddleware({
  scope: 'season-maintenance',
  required: true,
});

/**
 * Season Routes - API endpoints для сезонной системы
 * Sprint 6: Season System
 *
 * Все endpoints требуют Telegram аутентификацию
 */

// GET /api/seasons - Получить все сезоны
router.get(
  '/',
  telegramAuthMiddleware,
  seasonListQuery.middleware,
  SeasonController.getAllSeasons
);

// GET /api/seasons/current - Получить текущий сезон
router.get(
  '/current',
  telegramAuthMiddleware,
  SeasonController.getCurrentSeason
);

// GET /api/seasons/current/stats/:userId - Статистика пользователя за текущий сезон
router.get(
  '/current/stats/:userId',
  telegramAuthMiddleware,
  seasonUserIdParam.middleware,
  SeasonController.getCurrentSeasonUserStats
);

// GET /api/seasons/:id - Получить сезон по ID
router.get(
  '/:id',
  telegramAuthMiddleware,
  seasonIdParam.middleware,
  SeasonController.getSeasonById
);

// GET /api/seasons/:id/leaderboard - Лидерборд сезона
router.get(
  '/:id/leaderboard',
  telegramAuthMiddleware,
  seasonIdParam.middleware,
  seasonLeaderboardQuery.middleware,
  SeasonController.getSeasonLeaderboard
);

// GET /api/seasons/:id/stats/:userId - Статистика пользователя за конкретный сезон
router.get(
  '/:id/stats/:userId',
  telegramAuthMiddleware,
  seasonUserStatsParams.middleware,
  SeasonController.getUserSeasonStats
);

// POST /api/seasons/rotate - Ротировать сезон (admin only)
router.post(
  '/rotate',
  telegramAuthMiddleware,
  operationsApiMiddleware,
  writeLimiter,
  seasonMutationIdempotency,
  SeasonController.rotateSeason
);

// POST /api/seasons/create - Создать новый сезон (admin only)
router.post(
  '/create',
  telegramAuthMiddleware,
  operationsApiMiddleware,
  writeLimiter,
  seasonMutationIdempotency,
  SeasonController.createMonthlySeason
);

export default router;
