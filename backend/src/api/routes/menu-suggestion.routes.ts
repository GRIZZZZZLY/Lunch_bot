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
import { requireGroupAdmin } from '../middleware/group-admin';

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
router.get('/stats', requireGroupAdmin, getStats);

/**
 * GET /api/suggestions/pending-count
 * Получить количество ожидающих предложений (только админ)
 */
router.get('/pending-count', requireGroupAdmin, getPendingCount);

/**
 * GET /api/suggestions/:id
 * Получить предложение по ID
 */
router.get('/:id', getSuggestionById);

/**
 * POST /api/suggestions/:id/approve
 * Одобрить предложение (только админ)
 */
router.post('/:id/approve', requireGroupAdmin, approveSuggestion);

/**
 * POST /api/suggestions/:id/reject
 * Отклонить предложение (только админ)
 * Body:
 *  - reason?: string
 */
router.post('/:id/reject', requireGroupAdmin, rejectSuggestion);

/**
 * DELETE /api/suggestions/:id
 * Удалить предложение.
 * Право проверяет сервис, потому что прав два: автор отзывает своё, пока оно
 * на рассмотрении, а админ группы убирает уже разобранное. Админской мидлвары
 * здесь быть не может — она отсекала бы автора, которому кнопка и показана.
 */
router.delete('/:id', deleteSuggestion);

export default router;
