import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller';
import { BudgetService } from '../../services/budget.service';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

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

// POST routes
router.post('/mark-paid', (req, res) => budgetController.markAsPaid(req, res));
router.post('/confirm-payment', (req, res) => budgetController.confirmPayment(req, res));
router.post('/cancel-mark', (req, res) => budgetController.cancelMark(req, res));
router.post('/send-reminder', (req, res) => budgetController.sendReminder(req, res));
router.post('/send-reminders-all', (req, res) => budgetController.sendRemindersAll(req, res));

export default router;
