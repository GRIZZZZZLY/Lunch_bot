import { NextFunction, Request, Response } from 'express';
import { CategoryOrderService } from '../../services/category-order.service';
import { OrderCalculationService } from '../../services/order-calculation.service';
import { MultiCategoryResponsibleService } from '../../services/multi-category-responsible.service';
import { UserService } from '../../services/user.service';
import { logger } from '../../utils/logger';
import { requireAuthUser } from '../middleware/require-auth-user';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  categoryOrderIdParam,
  categoryOrderPollIdParam,
  saveOrderItemBody,
  updateCostsBody,
} from '../schemas/category-order';
import { toNumber } from '../../utils/decimal';
import { serializeBigInt } from '../../utils/serialize';

export class CategoryOrderController {
  /**
   * Участник категории? Единственная проверка доступа, оставшаяся в
   * контроллере, и остаётся она осознанно: в `saveOrderItem` она задаётся
   * не про ВЫЗЫВАЮЩЕГО, а про пользователя из ТЕЛА запроса — «позицию можно
   * создать только участнику категории». В middleware разобранного тела ещё
   * нет, и перенос превратил бы проверку в её отсутствие.
   *
   * Авторизация вызывающего живёт на маршруте: см.
   * `api/middleware/authorization.ts` и матрицу `tech_debt/04-auth-matrix.md`.
   */
  private static async isUserParticipant(
    categoryOrderId: number,
    userId: number
  ): Promise<boolean> {
    const participantUserIds =
      await CategoryOrderService.getParticipants(categoryOrderId);

    return participantUserIds.includes(userId);
  }

  /**
   * GET /api/polls/:pollId/category-orders
   * Get all CategoryOrders for a poll
   */
  static async getCategoryOrdersForPoll(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { pollId } = categoryOrderPollIdParam.get(req);

      const categoryOrders =
        await CategoryOrderService.getCategoryOrdersForPoll(pollId);

      res.json({
        success: true,
        data: serializeBigInt(categoryOrders),
        count: categoryOrders.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting category orders for poll:', error);
      next(error);
    }
  }

  /**
   * GET /api/polls/:pollId/category-orders/my
   * Get CategoryOrders for poll where current user is participant
   */
  static async getMyCategoryOrdersForPoll(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { pollId } = categoryOrderPollIdParam.get(req);

      const categoryOrders =
        await CategoryOrderService.getCategoryOrdersForPoll(pollId);

      // Один запрос голосов на все категории вместо getParticipants на каждую
      const participantsByCategory =
        await CategoryOrderService.getParticipantsByCategoriesForPoll(
          pollId,
          categoryOrders.map(order => order.category)
        );

      const myCategoryOrders = categoryOrders.filter(
        order =>
          participantsByCategory.get(order.category)?.has(user.id) ?? false
      );

      res.json({
        success: true,
        data: serializeBigInt(myCategoryOrders),
        count: myCategoryOrders.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting user category orders for poll:', error);
      next(error);
    }
  }

  /**
   * GET /api/category-orders/:id
   * Get a single CategoryOrder by ID
   */
  static async getCategoryOrder(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id } = categoryOrderIdParam.get(req);

      const categoryOrder = await CategoryOrderService.getCategoryOrder(id);

      if (!categoryOrder) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: serializeBigInt(categoryOrder),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting category order:', error);
      next(error);
    }
  }

  /**
   * POST /api/category-orders/:id/order-items
   * Save or update an OrderItem (autosave)
   */
  static async saveOrderItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);
      /* Приведение и обрезка пробелов теперь в схеме: `userId` — целое
         положительное, `itemName` — непустая строка после trim, `price` —
         конечное положительное число. */
      const {
        userId: parsedUserId,
        itemName: normalizedItemName,
        price: parsedPrice,
        notes: normalizedNotes,
      } = saveOrderItemBody.get(req);
      const enteredBy = req.user?.id;

      if (!enteredBy) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(
          categoryOrderId
        );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const isParticipant = await CategoryOrderController.isUserParticipant(
        categoryOrderId,
        parsedUserId
      );
      if (!isParticipant) {
        res.status(403).json({
          success: false,
          error: 'Order items can only be created for category participants',
          code: 'FORBIDDEN',
        });
        return;
      }

      const orderItem = await OrderCalculationService.saveOrderItem({
        categoryOrderId,
        userId: parsedUserId,
        itemName: normalizedItemName,
        price: parsedPrice,
        notes: normalizedNotes || undefined,
        enteredBy,
      });

      res.json({
        success: true,
        data: serializeBigInt(orderItem),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error saving order item:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/order-items/:id
   * Delete an OrderItem
   */
  static async deleteOrderItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id } = categoryOrderIdParam.get(req);

      /* Здесь `:id` — ПОЗИЦИЯ, а право на удаление принадлежит ответственному
         за ЗАКАЗ. Поэтому проверка доступа осталась в контроллере, а не уехала
         на маршрут: middleware по `:id` проверял бы не ту сущность. */
      const categoryOrderIdForItem =
        await OrderCalculationService.getCategoryOrderIdForItem(id);

      if (categoryOrderIdForItem === null) {
        res.status(404).json({
          success: false,
          error: 'Order item not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const responsibleUserId = await CategoryOrderService.getResponsibleUserId(
        categoryOrderIdForItem
      );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      if (responsibleUserId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Only responsible user can delete order items',
          code: 'FORBIDDEN',
        });
        return;
      }

      await OrderCalculationService.deleteOrderItem(id);

      res.json({
        success: true,
        message: 'Order item deleted',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error deleting order item:', error);
      next(error);
    }
  }

  /**
   * GET /api/category-orders/:id/progress
   * Get calculation progress
   */
  static async getProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(
          categoryOrderId
        );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const progress =
        await OrderCalculationService.getProgress(categoryOrderId);

      res.json({
        success: true,
        data: progress,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting progress:', error);
      next(error);
    }
  }

  /**
   * GET /api/category-orders/:id/participants
   * Get participants (users who voted for this category)
   */
  static async getParticipants(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(
          categoryOrderId
        );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const participantUserIds =
        await CategoryOrderService.getParticipants(categoryOrderId);

      /* Поля перечислены здесь, а не отданы целиком из сервиса, намеренно:
         `getUsersByIds` возвращает полную запись, включая telegramId, и
         `data: users` отдал бы её наружу. Форма ответа при этом ровно та же,
         что была у прежнего `select` в Prisma. */
      const participants = await UserService.getUsersByIds(participantUserIds);
      const users = participants.map(participant => ({
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        username: participant.username,
      }));

      res.json({
        success: true,
        data: users,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting participants:', error);
      next(error);
    }
  }

  /**
   * POST /api/category-orders/:id/finalize
   * Finalize calculation and create transactions
   */
  static async finalizeCalculation(req: Request, res: Response): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(
          categoryOrderId
        );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const result =
        await OrderCalculationService.finalizeCalculation(categoryOrderId);

      res.json({
        success: true,
        data: result,
        message: 'Calculation finalized and transactions created',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      /* Единственный handler здесь, который отвечает сам, а не через `next`:
         его `catch` превратил бы ошибку разбора входа в 500. */
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error finalizing calculation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to finalize calculation',
        code: 'FINALIZATION_ERROR',
      });
    }
  }

  /**
   * POST /api/category-orders/:id/volunteer
   * Volunteer as responsible from Mini App
   */
  static async volunteerForCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);

      const categoryOrder =
        await CategoryOrderService.getCategoryOrder(categoryOrderId);
      if (!categoryOrder) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      /* `req.user` уже несёт telegramId, но перечитываем из базы: запись могли
         деактивировать между выдачей токена и этим запросом, а отклик на
         категорию — действие от имени человека. Прежний код делал то же самое,
         только напрямую через Prisma. */
      const dbUser = await UserService.getUserById(user.id);

      if (!dbUser?.telegramId) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const selected =
        await MultiCategoryResponsibleService.handleVolunteerForCategory(
          categoryOrderId,
          dbUser.telegramId
        );
      if (!selected) {
        res.status(409).json({
          success: false,
          error:
            'Category is already assigned or user is not an eligible participant',
          code: 'VOLUNTEER_NOT_AVAILABLE',
        });
        return;
      }

      const updatedOrder =
        await CategoryOrderService.getCategoryOrder(categoryOrderId);

      res.json({
        success: true,
        data: serializeBigInt(updatedOrder),
        message: 'Volunteer request processed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error volunteering for category:', error);
      next(error);
    }
  }

  /**
   * PUT /api/category-orders/:id/costs
   * Update additional costs (delivery, service, tip)
   */
  static async updateCosts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);
      const parsedCosts = updateCostsBody.get(req);

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(
          categoryOrderId
        );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const categoryOrder = await CategoryOrderService.updateCosts(
        categoryOrderId,
        parsedCosts
      );

      res.json({
        success: true,
        data: serializeBigInt(categoryOrder),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error updating costs:', error);
      next(error);
    }
  }

  /**
   * GET /api/order-items/:id/edit-history
   * Get edit history for an OrderItem (admin only)
   */
  static async getEditHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: orderItemId } = categoryOrderIdParam.get(req);
      const user = req.user;

      /* Право на историю правок проверяет requireGroupAdmin на маршруте:
         это данные группы, и решает роль в ней. Здесь остаётся только проверка
         аутентификации — дублировать авторизацию в контроллере значит рано или
         поздно развести две проверки. */
      if (!user) {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'FORBIDDEN',
        });
        return;
      }

      const history = await OrderCalculationService.getEditHistory(orderItemId);

      res.json({
        success: true,
        data: serializeBigInt(history),
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting edit history:', error);
      next(error);
    }
  }

  /**
   * GET /api/category-orders/:id/order-items
   * Get all OrderItems for a CategoryOrder
   */
  static async getOrderItems(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = requireAuthUser(req, res);
      if (!user) return;

      const { id: categoryOrderId } = categoryOrderIdParam.get(req);

      const responsibleUserId =
        await CategoryOrderService.getResponsibleUserId(
          categoryOrderId
        );

      if (!responsibleUserId) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const items =
        await OrderCalculationService.getOrderItems(categoryOrderId);

      res.json({
        success: true,
        data: serializeBigInt(items),
        count: items.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting order items:', error);
      next(error);
    }
  }
}
