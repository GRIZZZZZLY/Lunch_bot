import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller';
import { BudgetService } from '../../services/budget.service';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { reminderLimiter, writeLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

// G0-8: критично для платёжных переходов — double-tap на mark-paid/confirm
// без дедупликации = дублирующая транзакция в БД.
const budgetIdempotency = createIdempotencyMiddleware({
  scope: 'budget',
  required: true,
});

// Initialize service and controller
const budgetService = new BudgetService();
const budgetController = new BudgetController(budgetService);

// Apply auth middleware to all routes
router.use(telegramAuthMiddleware);

// GET routes
router.get('/debts', (req, res) => budgetController.getDebts(req, res));
router.get('/credits', (req, res) => budgetController.getCredits(req, res));
router.get('/stats', (req, res) => budgetController.getStats(req, res));
router.get('/poll-totals/:pollId', (req, res) => budgetController.getPollTotals(req, res));

// Cost splitting routes
router.get('/order-costs/:pollId', (req, res) => budgetController.getOrderCosts(req, res));
router.get('/poll-breakdown/:pollId', (req, res) => budgetController.getPollCostBreakdown(req, res));

// POST routes
router.post('/mark-paid', writeLimiter, budgetIdempotency, (req, res) => budgetController.markAsPaid(req, res));
router.post('/confirm-payment', writeLimiter, budgetIdempotency, (req, res) => budgetController.confirmPayment(req, res));
router.post('/cancel-mark', writeLimiter, budgetIdempotency, (req, res) => budgetController.cancelMark(req, res));
router.post('/mark-all-paid', writeLimiter, budgetIdempotency, (req, res) => budgetController.markAllPaid(req, res));
router.post('/send-reminder', reminderLimiter, budgetIdempotency, (req, res) => budgetController.sendReminder(req, res));
router.post('/send-reminders-all', reminderLimiter, budgetIdempotency, (req, res) => budgetController.sendRemindersAll(req, res));

// Cost splitting POST routes
router.post('/order-costs/:pollId', (req, res) => budgetController.setOrderCosts(req, res));

export default router;
