import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { writeLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';

const router = Router();
const adminMutationIdempotency = createIdempotencyMiddleware({
  scope: 'group-admin',
  required: true,
});

// Initialize controller
const adminController = new AdminController();

// Каждый маршрут проверяет права на конкретную группу в контроллере.
// Глобальный администратор имеет расширенное чтение, но не получает
// неявных прав на изменение данных группы.
router.use(telegramAuthMiddleware);

// ===== User Management Routes =====

/**
 * GET /api/admin/users
 * Получение списка всех пользователей с их активностью
 */
router.get('/users', (req, res) => adminController.getAllUsers(req, res));

/**
 * GET /api/admin/users/:userId/stats
 * Получение статистики пользователя
 */
router.get('/users/:userId/stats', (req, res) =>
  adminController.getUserStats(req, res)
);

/**
 * PUT /api/admin/users/:userId/admin
 * Назначение/снятие админ-прав
 */
router.put(
  '/users/:userId/admin',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.toggleAdmin(req, res)
);

/**
 * PUT /api/admin/users/:userId/active
 * Блокировка/разблокировка пользователя
 */
router.put(
  '/users/:userId/active',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.toggleActive(req, res)
);

/**
 * PUT /api/admin/users/:userId/participates-in-polls
 * Переключение постоянного флага «участвует в голосованиях»
 */
router.put(
  '/users/:userId/participates-in-polls',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.toggleParticipatesInPolls(req, res)
);

/**
 * GET /api/admin/polls/:pollId/participants
 * Список участников конкретного голосования (снимок + статус голосования)
 */
router.get('/polls/:pollId/participants', (req, res) =>
  adminController.getPollParticipants(req, res)
);

/**
 * PUT /api/admin/polls/:pollId/participants/:userId
 * Per-poll override: исключить/вернуть участника. Триггерит проверку кворума.
 */
router.put(
  '/polls/:pollId/participants/:userId',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.setPollParticipantStatus(req, res)
);

// ===== Debt Management Routes =====

/**
 * GET /api/admin/debtors
 * Получение списка всех должников с детальной информацией
 */
router.get('/debtors', (req, res) => adminController.getAllDebtors(req, res));

/**
 * GET /api/admin/debt-stats
 * Статистика по задолженностям
 */
router.get('/debt-stats', (req, res) => adminController.getDebtStats(req, res));

/**
 * POST /api/admin/debts/:debtId/forgive
 * Принудительное списание долга (forgive debt)
 */
router.post(
  '/debts/:debtId/forgive',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.forgiveDebt(req, res)
);

/**
 * POST /api/admin/debts/remind-all
 * Отправка напоминаний всем должникам
 */
router.post(
  '/debts/remind-all',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.remindAllDebtors(req, res)
);

/**
 * POST /api/admin/debts/:debtId/remind
 * Отправка напоминания конкретному должнику
 */
router.post(
  '/debts/:debtId/remind',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.remindDebtor(req, res)
);

// ===== Data Cleanup Routes =====

/**
 * DELETE /api/admin/cleanup/old-polls
 * Очистка старых завершённых голосований
 */
router.delete(
  '/cleanup/old-polls',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.cleanupOldPolls(req, res)
);

/**
 * DELETE /api/admin/cleanup/old-transactions
 * Очистка старых оплаченных транзакций
 */
router.delete(
  '/cleanup/old-transactions',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.cleanupOldTransactions(req, res)
);

/**
 * GET /api/admin/cleanup/stats
 * Статистика для очистки (сколько старых данных)
 */
router.get('/cleanup/stats', (req, res) =>
  adminController.getCleanupStats(req, res)
);

// ===== Reminder Settings Routes =====

/**
 * GET /api/admin/reminder-settings/:groupId
 * Получение настроек авто-напоминаний для группы
 */
router.get('/reminder-settings/:groupId', (req, res) =>
  adminController.getReminderSettings(req, res)
);

/**
 * PUT /api/admin/reminder-settings/:groupId
 * Обновление настроек авто-напоминаний
 */
router.put(
  '/reminder-settings/:groupId',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.updateReminderSettings(req, res)
);

/**
 * GET /api/admin/notification-settings/:groupId
 * Получение настроек уведомлений админа
 */
router.get('/notification-settings/:groupId', (req, res) =>
  adminController.getAdminNotificationSettings(req, res)
);

/**
 * PUT /api/admin/notification-settings/:groupId
 * Обновление настроек уведомлений админа
 */
router.put(
  '/notification-settings/:groupId',
  writeLimiter,
  adminMutationIdempotency,
  (req, res) => adminController.updateAdminNotificationSettings(req, res)
);

export default router;
