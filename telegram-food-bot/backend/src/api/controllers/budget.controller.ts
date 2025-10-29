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

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
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

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
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

      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
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
}
