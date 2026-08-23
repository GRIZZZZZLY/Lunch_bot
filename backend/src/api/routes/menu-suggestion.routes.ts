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
import {
  createSuggestionBody,
  rejectSuggestionBody,
  suggestionGroupBody,
  suggestionGroupQuery,
  suggestionIdParam,
  suggestionsQuery,
} from '../schemas/menu-suggestion';

const router = Router();

// Все маршруты требуют аутентификации
router.use(telegramAuthMiddleware);

/* Порядок тот же, что в остальных роутерах: контракт `params` — до проверки
   прав (`requireGroupAdmin` читает параметры и query), контракт `body` — после
   неё. Тонкость: `requireGroupAdmin` читает `groupId` и из ТЕЛА тоже, то есть
   решает о доступе по ещё не провалидированному значению. Разбирает он его сам
   (`middleware/group-admin.ts`), поэтому порядок безопасен — но переставлять
   контракт тела выше guard'а нельзя: тогда тело подменялось бы до проверки
   прав. */

/**
 * POST /api/suggestions
 * Создать новое предложение блюда
 */
router.post('/', createSuggestionBody.middleware, createSuggestion);

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
router.get('/', suggestionsQuery.middleware, getSuggestions);

/**
 * GET /api/suggestions/stats
 * Получить статистику предложений (только админ)
 */
router.get('/stats', suggestionGroupQuery.middleware, requireGroupAdmin, getStats);

/**
 * GET /api/suggestions/pending-count
 * Получить количество ожидающих предложений (только админ)
 */
router.get(
  '/pending-count',
  suggestionGroupQuery.middleware,
  requireGroupAdmin,
  getPendingCount
);

/**
 * GET /api/suggestions/:id
 * Получить предложение по ID
 */
router.get('/:id', suggestionIdParam.middleware, getSuggestionById);

/**
 * POST /api/suggestions/:id/approve
 * Одобрить предложение (только админ)
 */
router.post(
  '/:id/approve',
  suggestionIdParam.middleware,
  requireGroupAdmin,
  suggestionGroupBody.middleware,
  approveSuggestion
);

/**
 * POST /api/suggestions/:id/reject
 * Отклонить предложение (только админ)
 * Body:
 *  - reason?: string
 */
router.post(
  '/:id/reject',
  suggestionIdParam.middleware,
  requireGroupAdmin,
  rejectSuggestionBody.middleware,
  rejectSuggestion
);

/**
 * DELETE /api/suggestions/:id
 * Удалить предложение.
 * Право проверяет сервис, потому что прав два: автор отзывает своё, пока оно
 * на рассмотрении, а админ группы убирает уже разобранное. Админской мидлвары
 * здесь быть не может — она отсекала бы автора, которому кнопка и показана.
 */
router.delete(
  '/:id',
  suggestionIdParam.middleware,
  suggestionGroupBody.middleware,
  deleteSuggestion
);

export default router;
