import { Router } from 'express';
import {
  createSuggestion,
  getSuggestions,
  getSuggestionById,
  approveSuggestion,
  rejectSuggestion,
  getStats,
  getPendingCount,
  deleteSuggestion,
} from '../controllers/menu-suggestion.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { groupAdminMiddleware } from '../middleware/group-admin';

const router = Router();

// Все маршруты требуют аутентификации
router.use(telegramAuthMiddleware);

/**
 * POST /api/suggestions
 * Создать новое предложение блюда
 */
router.post('/', createSuggestion);

/**
 * GET /api/suggestions
 * Получить список предложений
 * Query params:
 *  - status: PENDING | APPROVED | REJECTED
 *  - limit: number
 *  - offset: number
 * Обычные пользователи видят только свои предложения
 * Админы видят все предложения
 */
router.get('/', getSuggestions);

/**
 * GET /api/suggestions/stats
 * Получить статистику предложений (только админ)
 */
router.get('/stats', groupAdminMiddleware, getStats);

/**
 * GET /api/suggestions/pending-count
 * Получить количество ожидающих предложений (только админ)
 */
router.get('/pending-count', groupAdminMiddleware, getPendingCount);

/**
 * GET /api/suggestions/:id
 * Получить предложение по ID
 */
router.get('/:id', getSuggestionById);

/**
 * POST /api/suggestions/:id/approve
 * Одобрить предложение (только админ)
 */
router.post('/:id/approve', groupAdminMiddleware, approveSuggestion);

/**
 * POST /api/suggestions/:id/reject
 * Отклонить предложение (только админ)
 * Body:
 *  - reason?: string
 */
router.post('/:id/reject', groupAdminMiddleware, rejectSuggestion);

/**
 * DELETE /api/suggestions/:id
 * Удалить предложение (только админ, только отклонённые)
 */
router.delete('/:id', groupAdminMiddleware, deleteSuggestion);

export default router;
