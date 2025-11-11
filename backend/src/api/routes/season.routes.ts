import { Router } from 'express';
import { SeasonController } from '../controllers/season.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

/**
 * Season Routes - API endpoints для сезонной системы
 * Sprint 6: Season System
 * 
 * Все endpoints требуют Telegram аутентификацию
 */

// GET /api/seasons - Получить все сезоны
router.get('/', telegramAuthMiddleware, SeasonController.getAllSeasons);

// GET /api/seasons/current - Получить текущий сезон
router.get('/current', telegramAuthMiddleware, SeasonController.getCurrentSeason);

// GET /api/seasons/current/stats/:userId - Статистика пользователя за текущий сезон
router.get('/current/stats/:userId', telegramAuthMiddleware, SeasonController.getCurrentSeasonUserStats);

// GET /api/seasons/:id - Получить сезон по ID
router.get('/:id', telegramAuthMiddleware, SeasonController.getSeasonById);

// GET /api/seasons/:id/leaderboard - Лидерборд сезона
router.get('/:id/leaderboard', telegramAuthMiddleware, SeasonController.getSeasonLeaderboard);

// GET /api/seasons/:id/stats/:userId - Статистика пользователя за конкретный сезон
router.get('/:id/stats/:userId', telegramAuthMiddleware, SeasonController.getUserSeasonStats);

// POST /api/seasons/rotate - Ротировать сезон (admin only)
router.post('/rotate', telegramAuthMiddleware, SeasonController.rotateSeason);

// POST /api/seasons/create - Создать новый сезон (admin only)
router.post('/create', telegramAuthMiddleware, SeasonController.createMonthlySeason);

export default router;
