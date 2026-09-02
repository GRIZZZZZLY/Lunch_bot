import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller';
import { BudgetService } from '../../services/budget.service';
import { OrderCostsService } from '../../services/order-costs.service';
import { ReminderService } from '../../services/reminder.service';
import { BudgetQueryService } from '../../services/budget-query.service';
import { PollFlowService } from '../../services/poll-flow.service';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { reminderLimiter, writeLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import {
  budgetDebtsQuery,
  budgetPollIdParam,
  budgetStatsQuery,
  pollIdBody,
  transactionIdBody,
} from '../schemas/budget';

const router = Router();

// G0-8: критично для платёжных переходов — double-tap на mark-paid/confirm
// без дедупликации = дублирующая транзакция в БД.
const budgetIdempotency = createIdempotencyMiddleware({
  scope: 'budget',
  required: true,
});

// Initialize service and controller
const budgetService = new BudgetService();
const orderCostsService = new OrderCostsService();
const reminderService = new ReminderService();
const queryService = new BudgetQueryService();
const pollFlowService = new PollFlowService();
const budgetController = new BudgetController(
  budgetService,
  orderCostsService,
  reminderService,
  queryService,
  pollFlowService
);

// Apply auth middleware to all routes
router.use(telegramAuthMiddleware);

/* Валидация по тому же правилу, что в остальных роутерах: `params`/`query` —
   сразу после аутентификации (она здесь навешена через `router.use` выше),
   `body` — после идемпотентности, чтобы ключ считался по исходному телу. */

// GET routes
router.get('/debts', budgetDebtsQuery.middleware, (req, res) => budgetController.getDebts(req, res));
router.get('/credits', budgetDebtsQuery.middleware, (req, res) => budgetController.getCredits(req, res));
router.get('/stats', budgetStatsQuery.middleware, (req, res) => budgetController.getStats(req, res));
router.get('/poll-totals/:pollId', budgetPollIdParam.middleware, (req, res) => budgetController.getPollTotals(req, res));

// Cost splitting routes
router.get('/order-costs/:pollId', budgetPollIdParam.middleware, (req, res) => budgetController.getOrderCosts(req, res));
router.get('/poll-breakdown/:pollId', budgetPollIdParam.middleware, (req, res) => budgetController.getPollCostBreakdown(req, res));

// POST routes
router.post('/mark-paid', writeLimiter, budgetIdempotency, transactionIdBody.middleware, (req, res) => budgetController.markAsPaid(req, res));
router.post('/confirm-payment', writeLimiter, budgetIdempotency, transactionIdBody.middleware, (req, res) => budgetController.confirmPayment(req, res));
router.post('/undo-confirmation', writeLimiter, budgetIdempotency, transactionIdBody.middleware, (req, res) => budgetController.undoConfirmation(req, res));
router.post('/cancel-mark', writeLimiter, budgetIdempotency, transactionIdBody.middleware, (req, res) => budgetController.cancelMark(req, res));
router.post('/mark-all-paid', writeLimiter, budgetIdempotency, pollIdBody.middleware, (req, res) => budgetController.markAllPaid(req, res));
router.post('/send-reminder', reminderLimiter, budgetIdempotency, transactionIdBody.middleware, (req, res) => budgetController.sendReminder(req, res));
router.post('/send-reminders-all', reminderLimiter, budgetIdempotency, pollIdBody.middleware, (req, res) => budgetController.sendRemindersAll(req, res));

export default router;
