import { Request, Response } from 'express';
import { BudgetService } from '../../services/budget.service';
import { logger } from '../../utils/logger';

export class BudgetController {
  private budgetService: BudgetService;

  constructor(budgetService: BudgetService) {
    this.budgetService = budgetService;
  }

  /**
   * GET /api/budget/debts
   * Получить все долги пользователя
   */
  async getDebts(req: Request, res: Response): Promise<void> {
    try {
      // ✅ FIX IDOR: Используем userId из аутентифицированного пользователя
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const status = req.query.status as 'PENDING' | 'PAID' | 'CONFIRMED' | undefined;

      const debts = await this.budgetService.getUserDebts(authenticatedUser.id, status);

      res.json({ success: true, data: debts });
    } catch (error) {
      logger.error('[BudgetController] Error getting debts:', error);
      res.status(500).json({ error: 'Failed to get debts' });
    }
  }

  /**
   * GET /api/budget/credits
   * Получить все кредиты (кто должен пользователю)
   */
  async getCredits(req: Request, res: Response): Promise<void> {
    try {
      // ✅ FIX IDOR: Используем userId из аутентифицированного пользователя
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const status = req.query.status as 'PENDING' | 'PAID' | 'CONFIRMED' | undefined;

      const credits = await this.budgetService.getUserCredits(authenticatedUser.id, status);

      res.json({ success: true, data: credits });
    } catch (error) {
      logger.error('[BudgetController] Error getting credits:', error);
      res.status(500).json({ error: 'Failed to get credits' });
    }
  }

  /**
   * POST /api/budget/mark-paid
   * Пометить транзакцию как оплаченную
   */
  async markAsPaid(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.body;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
        return;
      }

      // ✅ FIX IDOR: Проверяем что пользователь - должник (fromUserId)
      const transaction = await this.budgetService.getTransactionById(transactionId);
      
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      if (transaction.fromUserId !== authenticatedUser.id) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'Вы можете отметить оплаченными только свои долги'
        });
        return;
      }

      await this.budgetService.markAsPaid(transactionId);

      res.json({ success: true });
    } catch (error) {
      logger.error('[BudgetController] Error marking as paid:', error);
      res.status(500).json({ error: 'Failed to mark as paid' });
    }
  }

  /**
   * POST /api/budget/confirm-payment
   * Подтвердить получение платежа (для ответственного)
   */
  async confirmPayment(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.body;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
        return;
      }

      // ✅ FIX IDOR: Проверяем что пользователь - кредитор/ответственный (toUserId)
      const transaction = await this.budgetService.getTransactionById(transactionId);
      
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      if (transaction.toUserId !== authenticatedUser.id) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'Вы можете подтвердить только платежи в ваш адрес'
        });
        return;
      }

      await this.budgetService.confirmPayment(transactionId);

      res.json({ success: true });
    } catch (error) {
      logger.error('[BudgetController] Error confirming payment:', error);
      res.status(500).json({ error: 'Failed to confirm payment' });
    }
  }

  /**
   * POST /api/budget/cancel-mark
   * Отменить пометку оплаты
   */
  async cancelMark(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.body;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
        return;
      }

      // ✅ FIX IDOR: Проверяем что пользователь - должник (fromUserId)
      const transaction = await this.budgetService.getTransactionById(transactionId);
      
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      if (transaction.fromUserId !== authenticatedUser.id) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'Вы можете отменять только свои отметки оплаты'
        });
        return;
      }

      await this.budgetService.cancelMarkAsPaid(transactionId);

      res.json({ success: true });
    } catch (error) {
      logger.error('[BudgetController] Error canceling mark:', error);
      res.status(500).json({ error: 'Failed to cancel mark' });
    }
  }

  /**
   * GET /api/budget/stats
   * Получить статистику пользователя
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // ✅ FIX IDOR: Используем userId из аутентифицированного пользователя
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const from = req.query.from as string;
      const to = req.query.to as string;

      const stats = await this.budgetService.getUserStats(
        authenticatedUser.id,
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined
      );

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[BudgetController] Error getting stats:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  /**
   * POST /api/budget/send-reminder
   * Отправить напоминание должнику
   */
  async sendReminder(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.body;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
        return;
      }

      await this.budgetService.sendReminder(transactionId, authenticatedUser.id);

      res.json({ success: true, message: 'Reminder sent' });
    } catch (error: any) {
      logger.error('[BudgetController] Error sending reminder:', error);
      res.status(500).json({ error: error.message || 'Failed to send reminder' });
    }
  }

  /**
   * POST /api/budget/send-reminders-all
   * Отправить напоминания всем должникам по конкретному заказу
   */
  async sendRemindersAll(req: Request, res: Response): Promise<void> {
    try {
      const { pollId } = req.body;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const result = await this.budgetService.sendRemindersToAll(pollId, authenticatedUser.id);

      res.json({ 
        success: true, 
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalCount: result.totalCount,
        failedUsers: result.failedUsers,
      });
    } catch (error: any) {
      logger.error('[BudgetController] Error sending reminders to all:', error);
      res.status(500).json({ error: error.message || 'Failed to send reminders' });
    }
  }

  /**
   * GET /api/budget/poll-totals/:pollId
   * Получить итоговые суммы по заказу
   */
  async getPollTotals(req: Request, res: Response): Promise<void> {
    try {
      const { pollId } = req.params;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const totals = await this.budgetService.calculateTotals(
        parseInt(pollId),
        authenticatedUser.id
      );

      res.json({ success: true, data: totals });
    } catch (error: any) {
      logger.error('[BudgetController] Error getting poll totals:', error);
      res.status(500).json({ error: error.message || 'Failed to get poll totals' });
    }
  }

  // ============================================
  // COST SPLITTING ENDPOINTS
  // ============================================

  /**
   * POST /api/budget/order-costs/:pollId
   * Set order costs (delivery, service, tips) - only responsible person
   */
  async setOrderCosts(req: Request, res: Response): Promise<void> {
    try {
      const { pollId } = req.params;
      const { deliveryCost, serviceFee, tip, notes } = req.body;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      // Validate input
      if (typeof deliveryCost !== 'number' || deliveryCost < 0) {
        res.status(400).json({ error: 'deliveryCost must be a non-negative number' });
        return;
      }

      if (typeof serviceFee !== 'number' || serviceFee < 0) {
        res.status(400).json({ error: 'serviceFee must be a non-negative number' });
        return;
      }

      if (typeof tip !== 'number' || tip < 0) {
        res.status(400).json({ error: 'tip must be a non-negative number' });
        return;
      }

      const orderCosts = await this.budgetService.setOrderCosts(
        parseInt(pollId),
        authenticatedUser.id,
        { deliveryCost, serviceFee, tip, notes }
      );

      res.json({ success: true, data: orderCosts });
    } catch (error: any) {
      logger.error('[BudgetController] Error setting order costs:', error);

      if (error.message === 'Poll not found') {
        res.status(404).json({ error: 'Poll not found' });
        return;
      }

      if (error.message === 'Only responsible person can set order costs') {
        res.status(403).json({ error: 'Access denied', message: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to set order costs' });
    }
  }

  /**
   * GET /api/budget/order-costs/:pollId
   * Get order costs for a poll
   */
  async getOrderCosts(req: Request, res: Response): Promise<void> {
    try {
      const { pollId } = req.params;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const orderCosts = await this.budgetService.getOrderCosts(parseInt(pollId));

      if (!orderCosts) {
        res.status(404).json({ error: 'Order costs not found for this poll' });
        return;
      }

      res.json({ success: true, data: orderCosts });
    } catch (error: any) {
      logger.error('[BudgetController] Error getting order costs:', error);
      res.status(500).json({ error: 'Failed to get order costs' });
    }
  }

  /**
   * GET /api/budget/poll-breakdown/:pollId
   * Get detailed cost breakdown for a poll
   */
  async getPollCostBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const { pollId } = req.params;
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const breakdown = await this.budgetService.getPollCostBreakdown(parseInt(pollId));

      res.json({ success: true, data: breakdown });
    } catch (error: any) {
      logger.error('[BudgetController] Error getting poll breakdown:', error);
      res.status(500).json({ error: 'Failed to get poll breakdown' });
    }
  }
}
