import { Request, Response } from 'express';
import { z } from 'zod';
import { BudgetService } from '../../services/budget.service';
import { PollService } from '../../services/poll.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';
import { toNumber } from '../../utils/decimal';
import { serializeBigInt as serializeData } from '../../utils/serialize';

/**
 * Anti-IDOR: для read-эндпоинтов по pollId — допуск только участникам группы poll'а
 * или админу. Возвращает true если доступ разрешён, иначе пишет ответ (404/403) и
 * возвращает false. Зеркалит pattern из vote.controller.requirePollAccess.
 */
async function requirePollAccess(
  res: Response,
  user: { id?: number } | undefined,
  pollId: number
): Promise<boolean> {
  if (!user?.id) {
    res
      .status(401)
      .json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return false;
  }
  const pollGroupId = await PollService.getPollGroupId(pollId);
  if (!pollGroupId) {
    res
      .status(404)
      .json({
        success: false,
        error: 'Poll not found',
        code: 'POLL_NOT_FOUND',
      });
    return false;
  }
  /* Прежде здесь глобальный флаг открывал бюджет любой группы. Понятия
     глобального администратора больше нет: доступ решает членство в группе
     голосования. */
  const isMember = await GroupService.isUserGroupMember(user.id, pollGroupId);
  if (!isMember) {
    res
      .status(403)
      .json({ success: false, error: 'Access denied', code: 'FORBIDDEN' });
    return false;
  }
  return true;
}

// Zod схемы валидации (Sprint 1)
const TransactionIdSchema = z.object({
  transactionId: z
    .number()
    .int()
    .positive('transactionId must be a positive integer'),
});

const PollIdParamSchema = z.object({
  pollId: z.string().regex(/^\d+$/, 'pollId must be numeric').transform(Number),
});

const SendRemindersAllSchema = z.object({
  pollId: z.number().int().positive('pollId must be a positive integer'),
});

const StatusQuerySchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CONFIRMED']).optional(),
});

const DateRangeQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .refine(
    data => !(data.from && data.to && new Date(data.from) > new Date(data.to)),
    { message: 'from date must be before to date' }
  );

const SetOrderCostsSchema = z.object({
  deliveryCost: z.number().min(0).max(100000, 'deliveryCost max 100000'),
  serviceFee: z.number().min(0).max(100000, 'serviceFee max 100000'),
  tip: z.number().min(0).max(100000, 'tip max 100000'),
  notes: z.string().max(500).optional(),
});

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

      const status = req.query.status as
        | 'PENDING'
        | 'PAID'
        | 'CONFIRMED'
        | undefined;
      const activeOnly = req.query.activeOnly === 'true';

      const debts = await this.budgetService.getUserDebts(
        authenticatedUser.id,
        status,
        activeOnly
      );

      res.json({ success: true, data: serializeData(debts) });
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

      const status = req.query.status as
        | 'PENDING'
        | 'PAID'
        | 'CONFIRMED'
        | undefined;
      const activeOnly = req.query.activeOnly === 'true';

      const credits = await this.budgetService.getUserCredits(
        authenticatedUser.id,
        status,
        activeOnly
      );

      res.json({ success: true, data: serializeData(credits) });
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
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      // Zod валидация
      const parseResult = TransactionIdSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors,
        });
        return;
      }

      const { transactionId } = parseResult.data;

      // ✅ FIX IDOR: Проверяем что пользователь - должник (fromUserId)
      const transaction =
        await this.budgetService.getTransactionById(transactionId);

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      if (transaction.fromUserId !== authenticatedUser.id) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Ты можешь отметить оплаченными только свои долги',
        });
        return;
      }

      await this.budgetService.markAsPaid(transactionId, authenticatedUser.id);

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
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      // Zod валидация
      const parseResult = TransactionIdSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors,
        });
        return;
      }

      const { transactionId } = parseResult.data;

      // ✅ FIX IDOR: Проверяем что пользователь - кредитор/ответственный (toUserId)
      const transaction =
        await this.budgetService.getTransactionById(transactionId);

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      if (transaction.toUserId !== authenticatedUser.id) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Ты можешь подтвердить только платежи в твой адрес',
        });
        return;
      }

      await this.budgetService.confirmPayment(
        transactionId,
        authenticatedUser.id
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('[BudgetController] Error confirming payment:', error);
      res.status(500).json({ error: 'Failed to confirm payment' });
    }
  }

  /**
   * POST /api/budget/undo-confirmation
   * Сборщик отменяет своё подтверждение (окно — сутки).
   *
   * Отдельные коды на «не подтверждено» и «окно истекло»: интерфейсу нужно
   * различать «кнопки быть не должно» и «поздно», а 500 на ожидаемый отказ
   * выглядел бы поломкой сервера.
   */
  async undoConfirmation(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const parseResult = TransactionIdSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors,
        });
        return;
      }

      const { transactionId } = parseResult.data;
      const transaction = await this.budgetService.getTransactionById(transactionId);
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      if (transaction.toUserId !== authenticatedUser.id) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Отменить подтверждение может только получатель платежа',
        });
        return;
      }

      await BudgetService.undoConfirmation(transactionId, authenticatedUser.id);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Undo window has expired') {
        res.status(409).json({
          error: 'Отменить можно в течение суток после подтверждения',
          code: 'UNDO_WINDOW_EXPIRED',
        });
        return;
      }
      if (message === 'Only a confirmed payment can be undone' || message === 'Transaction state changed') {
        res.status(409).json({ error: 'Платёж уже не подтверждён', code: 'WRONG_STATUS' });
        return;
      }
      logger.error('[BudgetController] Error undoing confirmation:', error);
      res.status(500).json({ error: 'Failed to undo confirmation' });
    }
  }

  /**
   * POST /api/budget/cancel-mark
   * Отменить пометку оплаты
   */
  async cancelMark(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      // Zod валидация
      const parseResult = TransactionIdSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: parseResult.error.errors,
        });
        return;
      }

      const { transactionId } = parseResult.data;

      // ✅ FIX IDOR: Проверяем что пользователь - должник (fromUserId)
      const transaction =
        await this.budgetService.getTransactionById(transactionId);

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      if (transaction.fromUserId !== authenticatedUser.id) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Ты можешь отменять только свои отметки оплаты',
        });
        return;
      }

      await this.budgetService.cancelMarkAsPaid(
        transactionId,
        authenticatedUser.id
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('[BudgetController] Error canceling mark:', error);
      res.status(500).json({ error: 'Failed to cancel mark' });
    }
  }

  /**
   * POST /api/budget/mark-all-paid
   * Подтвердить все непогашенные платежи по заказу.
   */
  async markAllPaid(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const parsed = SendRemindersAllSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.errors
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join('; '),
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      await this.budgetService.markAllPaidByResponsible(
        parsed.data.pollId,
        authenticatedUser.id
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('[BudgetController] Error marking all as paid:', error);
      res.status(500).json({ error: 'Failed to mark all as paid' });
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

      res.json({ success: true, data: serializeData(stats) });
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
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const parsed = TransactionIdSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.errors
            .map(e => `${e.path.join('.')}: ${e.message}`)
            .join('; '),
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      await this.budgetService.sendReminder(
        parsed.data.transactionId,
        authenticatedUser.id
      );

      res.json({ success: true, message: 'Reminder sent' });
    } catch (error: unknown) {
      logger.error('[BudgetController] Error sending reminder:', error);
      res.status(500).json({ error: 'Failed to send reminder' });
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

      const result = await this.budgetService.sendRemindersToAll(
        pollId,
        authenticatedUser.id
      );

      res.json({
        success: true,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalCount: result.totalCount,
        failedUsers: result.failedUsers,
      });
    } catch (error: unknown) {
      logger.error('[BudgetController] Error sending reminders to all:', error);
      res.status(500).json({ error: 'Failed to send reminders' });
    }
  }

  /**
   * GET /api/budget/poll-totals/:pollId
   * Получить итоговые суммы по заказу
   */
  async getPollTotals(req: Request, res: Response): Promise<void> {
    try {
      const pollId = getParam(req.params, 'pollId');
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const pollIdNum = parseInt(pollId);
      if (!(await requirePollAccess(res, authenticatedUser, pollIdNum))) return;

      const totals = await this.budgetService.calculateTotals(
        pollIdNum,
        authenticatedUser.id
      );

      res.json({ success: true, data: serializeData(totals) });
    } catch (error: unknown) {
      logger.error('[BudgetController] Error getting poll totals:', error);
      res.status(500).json({ error: 'Failed to get poll totals' });
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
      const pollId = getParam(req.params, 'pollId');
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
        res
          .status(400)
          .json({ error: 'deliveryCost must be a non-negative number' });
        return;
      }

      if (typeof serviceFee !== 'number' || serviceFee < 0) {
        res
          .status(400)
          .json({ error: 'serviceFee must be a non-negative number' });
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

      res.json({ success: true, data: serializeData(orderCosts) });
    } catch (error: any) {
      logger.error('[BudgetController] Error setting order costs:', error);

      if (error.message === 'Poll not found') {
        res.status(404).json({ error: 'Poll not found' });
        return;
      }

      if (error.message === 'Only responsible person can set order costs') {
        res
          .status(403)
          .json({ error: 'Access denied', message: error.message });
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
      const pollId = getParam(req.params, 'pollId');
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const pollIdNum = parseInt(pollId);
      if (!(await requirePollAccess(res, authenticatedUser, pollIdNum))) return;

      const orderCosts = await this.budgetService.getOrderCosts(pollIdNum);

      if (!orderCosts) {
        res.status(404).json({ error: 'Order costs not found for this poll' });
        return;
      }

      res.json({ success: true, data: serializeData(orderCosts) });
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
      const pollId = getParam(req.params, 'pollId');
      const authenticatedUser = (req as any).user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!pollId) {
        res.status(400).json({ error: 'pollId is required' });
        return;
      }

      const pollIdNum = parseInt(pollId);
      if (!(await requirePollAccess(res, authenticatedUser, pollIdNum))) return;

      const breakdown =
        await this.budgetService.getPollCostBreakdown(pollIdNum);

      res.json({ success: true, data: serializeData(breakdown) });
    } catch (error: any) {
      logger.error('[BudgetController] Error getting poll breakdown:', error);
      res.status(500).json({ error: 'Failed to get poll breakdown' });
    }
  }
}
