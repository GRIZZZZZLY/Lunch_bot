import { Request, Response } from 'express';
import { CategoryOrderService } from '../../services/category-order.service';
import { OrderCalculationService } from '../../services/order-calculation.service';
import { MultiCategoryResponsibleService } from '../../services/multi-category-responsible.service';
import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { getParam } from '../../utils/request-params';
import { toNumber } from '../../utils/decimal';
import { serializeBigInt } from '../../utils/serialize';

export class CategoryOrderController {
  private static getAuthUser(
    req: Request,
    res: Response
  ): { id: number } | null {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
      return null;
    }

    /* Флаг администратора здесь больше не возвращается: ни одна проверка ниже
       его не читает, а решение принимает роль в группе. */
    return {
      id: Number(user.id),
    };
  }

  private static async getCategoryOrderResponsibleUserId(
    categoryOrderId: number
  ): Promise<number | null> {
    const categoryOrder = await prisma.categoryOrder.findUnique({
      where: { id: categoryOrderId },
      select: { responsibleUserId: true },
    });

    return categoryOrder?.responsibleUserId ?? null;
  }

  private static async isUserParticipant(
    categoryOrderId: number,
    userId: number
  ): Promise<boolean> {
    const participantUserIds =
      await CategoryOrderService.getParticipants(categoryOrderId);

    return participantUserIds.includes(userId);
  }

  private static async canAccessPoll(
    pollId: number,
    user: { id: number }
  ): Promise<boolean> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { groupId: true },
    });

    if (!poll) {
      return false;
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: poll.groupId,
          userId: user.id,
        },
      },
      select: { isActive: true },
    });

    return Boolean(membership?.isActive);
  }

  /**
   * GET /api/polls/:pollId/category-orders
   * Get all CategoryOrders for a poll
   */
  static async getCategoryOrdersForPoll(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const pollId = parseInt(getParam(req.params, 'pollId'), 10);

      if (isNaN(pollId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid pollId',
          code: 'INVALID_POLL_ID',
        });
        return;
      }

      const hasAccess = await CategoryOrderController.canAccessPoll(pollId, user);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
        return;
      }

      const categoryOrders =
        await CategoryOrderService.getCategoryOrdersForPoll(pollId);

      res.json({
        success: true,
        data: serializeBigInt(categoryOrders),
        count: categoryOrders.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting category orders for poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category orders',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/polls/:pollId/category-orders/my
   * Get CategoryOrders for poll where current user is participant
   */
  static async getMyCategoryOrdersForPoll(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const pollId = parseInt(getParam(req.params, 'pollId'), 10);

      if (isNaN(pollId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid pollId',
          code: 'INVALID_POLL_ID',
        });
        return;
      }

      const hasAccess = await CategoryOrderController.canAccessPoll(pollId, user);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
        return;
      }

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
      logger.error('Error getting user category orders for poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user category orders',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/category-orders/:id
   * Get a single CategoryOrder by ID
   */
  static async getCategoryOrder(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const id = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const categoryOrder = await CategoryOrderService.getCategoryOrder(id);

      if (!categoryOrder) {
        res.status(404).json({
          success: false,
          error: 'Category order not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(id);
      const isParticipant = await CategoryOrderController.isUserParticipant(
        id,
        user.id
      );

      if (responsibleUserId !== user.id && !isParticipant) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
        return;
      }

      res.json({
        success: true,
        data: serializeBigInt(categoryOrder),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting category order:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get category order',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/category-orders/:id/order-items
   * Save or update an OrderItem (autosave)
   */
  static async saveOrderItem(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);
      const { userId, itemName, price, notes } = req.body;
      const enteredBy = (req as any).user?.id;

      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const parsedUserId = Number(userId);
      const parsedPrice = Number(price);
      const normalizedItemName =
        typeof itemName === 'string' ? itemName.trim() : '';
      const normalizedNotes = typeof notes === 'string' ? notes.trim() : notes;

      if (
        !Number.isInteger(parsedUserId) ||
        parsedUserId <= 0 ||
        !normalizedItemName ||
        !Number.isFinite(parsedPrice) ||
        parsedPrice <= 0
      ) {
        res.status(400).json({
          success: false,
          error:
            'userId must be positive, itemName is required, price must be positive',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      if (!enteredBy) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
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

      if (responsibleUserId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Only responsible user can edit order items',
          code: 'FORBIDDEN',
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
      logger.error('Error saving order item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save order item',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * DELETE /api/order-items/:id
   * Delete an OrderItem
   */
  static async deleteOrderItem(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const id = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid order item ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const orderItem = await prisma.orderItem.findUnique({
        where: { id },
        select: { categoryOrderId: true },
      });

      if (!orderItem) {
        res.status(404).json({
          success: false,
          error: 'Order item not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
          orderItem.categoryOrderId
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
      logger.error('Error deleting order item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete order item',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/category-orders/:id/progress
   * Get calculation progress
   */
  static async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
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

      const isResponsible = responsibleUserId === user.id;
      const isParticipant = await CategoryOrderController.isUserParticipant(
        categoryOrderId,
        user.id
      );

      if (!isResponsible && !isParticipant) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
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
      logger.error('Error getting progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get progress',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/category-orders/:id/participants
   * Get participants (users who voted for this category)
   */
  static async getParticipants(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
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

      if (responsibleUserId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
        return;
      }

      const participantUserIds =
        await CategoryOrderService.getParticipants(categoryOrderId);

      // Fetch user details
      const users = await prisma.user.findMany({
        where: {
          id: { in: participantUserIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      });

      res.json({
        success: true,
        data: users,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting participants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get participants',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/category-orders/:id/finalize
   * Finalize calculation and create transactions
   */
  static async finalizeCalculation(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
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

      if (responsibleUserId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Only responsible user can finalize calculation',
          code: 'FORBIDDEN',
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
    res: Response
  ): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);
      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

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

      const hasAccess = await CategoryOrderController.canAccessPoll(
        categoryOrder.pollId,
        user
      );
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { telegramId: true },
      });

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
      logger.error('Error volunteering for category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to volunteer for category',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * PUT /api/category-orders/:id/costs
   * Update additional costs (delivery, service, tip)
   */
  static async updateCosts(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);
      const { deliveryCost, serviceFee, tip, notes } = req.body;

      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
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

      if (responsibleUserId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Only responsible user can update costs',
          code: 'FORBIDDEN',
        });
        return;
      }

      const parseOptionalCost = (
        value: unknown,
        fieldName: string
      ): number | undefined => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }

        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error(`${fieldName} must be a non-negative number`);
        }

        return parsed;
      };

      let parsedCosts: {
        deliveryCost?: number;
        serviceFee?: number;
        tip?: number;
        notes?: string;
      };

      try {
        parsedCosts = {
          deliveryCost: parseOptionalCost(deliveryCost, 'deliveryCost'),
          serviceFee: parseOptionalCost(serviceFee, 'serviceFee'),
          tip: parseOptionalCost(tip, 'tip'),
          notes: typeof notes === 'string' ? notes.trim() : notes,
        };
      } catch (validationError) {
        res.status(400).json({
          success: false,
          error:
            validationError instanceof Error
              ? validationError.message
              : 'Invalid costs',
          code: 'VALIDATION_ERROR',
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
      logger.error('Error updating costs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update costs',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/order-items/:id/edit-history
   * Get edit history for an OrderItem (admin only)
   */
  static async getEditHistory(req: Request, res: Response): Promise<void> {
    try {
      const orderItemId = parseInt(getParam(req.params, 'id'), 10);
      const user = (req as any).user;

      if (isNaN(orderItemId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid order item ID',
          code: 'INVALID_ID',
        });
        return;
      }

      /* Право на историю правок проверяет groupAdminMiddleware на маршруте:
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
      logger.error('Error getting edit history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get edit history',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/category-orders/:id/order-items
   * Get all OrderItems for a CategoryOrder
   */
  static async getOrderItems(req: Request, res: Response): Promise<void> {
    try {
      const user = CategoryOrderController.getAuthUser(req, res);
      if (!user) return;

      const categoryOrderId = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(categoryOrderId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid category order ID',
          code: 'INVALID_ID',
        });
        return;
      }

      const responsibleUserId =
        await CategoryOrderController.getCategoryOrderResponsibleUserId(
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

      if (responsibleUserId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
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
      logger.error('Error getting order items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order items',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}
