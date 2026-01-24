import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller';
import { BudgetService } from '../../services/budget.service';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { reminderLimiter, writeLimiter } from '../middleware/rate-limiter';

const router = Router();

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
router.post('/mark-paid', writeLimiter, (req, res) => budgetController.markAsPaid(req, res));
router.post('/confirm-payment', writeLimiter, (req, res) => budgetController.confirmPayment(req, res));
router.post('/cancel-mark', writeLimiter, (req, res) => budgetController.cancelMark(req, res));
router.post('/send-reminder', reminderLimiter, (req, res) => budgetController.sendReminder(req, res));
router.post('/send-reminders-all', reminderLimiter, (req, res) => budgetController.sendRemindersAll(req, res));

// Cost splitting POST routes
router.post('/order-costs/:pollId', (req, res) => budgetController.setOrderCosts(req, res));

export default router;
