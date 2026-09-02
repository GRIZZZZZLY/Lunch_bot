import { Request, Response } from 'express';
import { BudgetService } from '../../services/budget.service';
import { OrderCostsService } from '../../services/order-costs.service';
import { ReminderService } from '../../services/reminder.service';
import { BudgetQueryService } from '../../services/budget-query.service';
import { PollFlowService } from '../../services/poll-flow.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  budgetDebtsQuery,
  budgetPollIdParam,
  budgetStatsQuery,
  pollIdBody,
  transactionIdBody,
} from '../schemas/budget';
import { toNumber } from '../../utils/decimal';
import { serializeBigInt as serializeData } from '../../utils/serialize';
import { PollQueryService } from '../../services/poll-query.service';

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
  const pollGroupId = await PollQueryService.getPollGroupId(pollId);
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

/* Шесть zod-схем жили здесь. Две работали, четыре были объявлены и не
   вызывались ни разу. Все шесть переехали в `api/schemas/budget.ts` и
   подключены на маршрутах — включая те четыре. */

export class BudgetController {
  private budgetService: BudgetService;
  private orderCostsService: OrderCostsService;
  private reminderService: ReminderService;
  private queryService: BudgetQueryService;
  private pollFlowService: PollFlowService;

  constructor(
    budgetService: BudgetService,
    orderCostsService: OrderCostsService,
    reminderService: ReminderService,
    queryService: BudgetQueryService,
    pollFlowService: PollFlowService
  ) {
    this.budgetService = budgetService;
    this.orderCostsService = orderCostsService;
    this.reminderService = reminderService;
    this.queryService = queryService;
    this.pollFlowService = pollFlowService;
  }

  /**
   * GET /api/budget/debts
   * Получить все долги пользователя
   */
  async getDebts(req: Request, res: Response): Promise<void> {
    try {
      // ✅ FIX IDOR: Используем userId из аутентифицированного пользователя
      const authenticatedUser = req.user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { status, activeOnly } = budgetDebtsQuery.get(req);

      const debts = await this.queryService.getUserDebts(
        authenticatedUser.id,
        status,
        activeOnly === 'true' || activeOnly === '1'
      );

      res.json({ success: true, data: serializeData(debts) });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { status, activeOnly } = budgetDebtsQuery.get(req);

      const credits = await this.queryService.getUserCredits(
        authenticatedUser.id,
        status,
        activeOnly === 'true' || activeOnly === '1'
      );

      res.json({ success: true, data: serializeData(credits) });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const { transactionId } = transactionIdBody.get(req);

      // ✅ FIX IDOR: Проверяем что пользователь - должник (fromUserId)
      const transaction =
        await this.queryService.getTransactionById(transactionId);

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const { transactionId } = transactionIdBody.get(req);

      // ✅ FIX IDOR: Проверяем что пользователь - кредитор/ответственный (toUserId)
      const transaction =
        await this.queryService.getTransactionById(transactionId);

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const { transactionId } = transactionIdBody.get(req);
      const transaction = await this.queryService.getTransactionById(transactionId);
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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const { transactionId } = transactionIdBody.get(req);

      // ✅ FIX IDOR: Проверяем что пользователь - должник (fromUserId)
      const transaction =
        await this.queryService.getTransactionById(transactionId);

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res
          .status(401)
          .json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
      }

      const { pollId } = pollIdBody.get(req);

      await this.budgetService.markAllPaidByResponsible(
        pollId,
        authenticatedUser.id
      );

      res.json({ success: true });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;
      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { from, to } = budgetStatsQuery.get(req);

      const stats = await this.queryService.getUserStats(
        authenticatedUser.id,
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined
      );

      res.json({ success: true, data: serializeData(stats) });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { transactionId } = transactionIdBody.get(req);

      await this.reminderService.sendReminder(
        transactionId,
        authenticatedUser.id
      );

      res.json({ success: true, message: 'Reminder sent' });
    } catch (error: unknown) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      /* Раньше проверка была `if (!pollId)` — то есть `pollId: "нет"` уходил в
         сервис как строка. Схема требует целое положительное. */
      const { pollId } = pollIdBody.get(req);

      const result = await this.reminderService.sendRemindersToAll(
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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { pollId: pollIdNum } = budgetPollIdParam.get(req);
      if (!(await requirePollAccess(res, authenticatedUser, pollIdNum))) return;

      const totals = await this.pollFlowService.calculateTotals(
        pollIdNum,
        authenticatedUser.id
      );

      res.json({ success: true, data: serializeData(totals) });
    } catch (error: unknown) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[BudgetController] Error getting poll totals:', error);
      res.status(500).json({ error: 'Failed to get poll totals' });
    }
  }

  // ============================================
  // COST SPLITTING ENDPOINTS
  // ============================================

  /**
   * GET /api/budget/order-costs/:pollId
   * Get order costs for a poll
   */
  async getOrderCosts(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { pollId: pollIdNum } = budgetPollIdParam.get(req);
      if (!(await requirePollAccess(res, authenticatedUser, pollIdNum))) return;

      const orderCosts = await this.orderCostsService.getOrderCosts(pollIdNum);

      if (!orderCosts) {
        res.status(404).json({ error: 'Order costs not found for this poll' });
        return;
      }

      res.json({ success: true, data: serializeData(orderCosts) });
    } catch (error: any) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { pollId: pollIdNum } = budgetPollIdParam.get(req);
      if (!(await requirePollAccess(res, authenticatedUser, pollIdNum))) return;

      const breakdown =
        await this.orderCostsService.getPollCostBreakdown(pollIdNum);

      res.json({ success: true, data: serializeData(breakdown) });
    } catch (error: any) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('[BudgetController] Error getting poll breakdown:', error);
      res.status(500).json({ error: 'Failed to get poll breakdown' });
    }
  }
}
