import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

export class UserController {
  /**
   * GET /api/user/me
   * Получение информации о текущем пользователе
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting current user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user info',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/user/payment-info
   * Получение платёжных данных
   */
  static async getPaymentInfo(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      const paymentInfo = await UserService.getPaymentInfo(user.id);

      res.json({
        success: true,
        data: paymentInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting payment info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment info',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * PUT /api/user/payment-info
   * Обновление платёжных данных
   */
  static async updatePaymentInfo(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { paymentCard, paymentPhone, paymentDetails } = req.body;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      // Валидация
      if (paymentCard && typeof paymentCard !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid payment card format',
          code: 'INVALID_PAYMENT_CARD',
        });
        return;
      }

      if (paymentPhone && typeof paymentPhone !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid payment phone format',
          code: 'INVALID_PAYMENT_PHONE',
        });
        return;
      }

      const updatedUser = await UserService.updatePaymentInfo(user.id, {
        paymentCard,
        paymentPhone,
        paymentDetails,
      });

      logger.info(`Payment info updated for user ${user.id}`);

      res.json({
        success: true,
        data: {
          paymentCard: updatedUser.paymentCard,
          paymentPhone: updatedUser.paymentPhone,
          paymentDetails: updatedUser.paymentDetails,
        },
        message: 'Payment info updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating payment info:', error);

      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update payment info',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/user/groups
   * Получение списка групп где пользователь админ
   */
  static async getUserGroups(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      // TODO: Реализовать получение групп через Telegram API или из БД
      // Пока возвращаем все активные группы (для демо)
      const { groups, total } = await GroupService.getAllGroups();

      res.json({
        success: true,
        data: groups.map(group => ({
          id: typeof group.id === 'bigint' ? Number(group.id) : group.id,
          title: group.title,
          telegramId: typeof group.telegramId === 'bigint' ? group.telegramId.toString() : group.telegramId,
          type: group.type,
          isActive: group.isActive,
        })),
        total,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting user groups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user groups',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export const userController = UserController;
