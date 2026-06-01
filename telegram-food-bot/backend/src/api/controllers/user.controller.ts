import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { AvatarService } from '../../services/avatar.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

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
   * Получение списка групп где есть бот
   * Проверка прав админа происходит при создании голосования
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

      // Супер-админ видит все активные группы с ролью ADMIN
      if (user.isAdmin === true) {
        const allGroups = await GroupService.getAllActiveGroups();
        logger.info(`Super-admin ${user.id} requested groups list, found ${allGroups.length} groups`);
        res.json({
          success: true,
          data: allGroups.map((group) => ({
            id: group.id,
            title: group.title,
            telegramId: group.telegramId.toString(),
            type: group.type,
            isActive: group.isActive,
            role: 'ADMIN',
          })),
          total: allGroups.length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const memberships = await GroupService.getGroupsForUser(user.id, true);

      logger.info(`User ${user.id} requested groups list, found ${memberships.length} groups`);

      res.json({
        success: true,
        data: memberships.map((membership) => ({
          id: membership.group.id,
          title: membership.group.title,
          telegramId: membership.group.telegramId.toString(),
          type: membership.group.type,
          isActive: membership.group.isActive,
          role: membership.role,
        })),
        total: memberships.length,
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

  /**
   * GET /api/user/:userId/avatar
   * Получение аватарки пользователя по ID
   */
  static async getUserAvatar(req: Request, res: Response): Promise<void> {
    try {
      const userId = getParam(req.params, 'userId');

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
          code: 'INVALID_PARAMS',
        });
        return;
      }

      // Получаем пользователя по ID
      const user = await UserService.getUserById(parseInt(userId, 10));

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      // Получаем аватарку через AvatarService (с кэшированием)
      const avatarUrl = await AvatarService.getUserAvatar(user.telegramId);

      res.json({
        success: true,
        data: {
          userId: user.id,
          telegramId: user.telegramId.toString(),
          avatarUrl,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting user avatar:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user avatar',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/user/avatars/batch
   * Batch-загрузка аватарок для нескольких пользователей
   *
   * Body: { userIds: number[] }
   */
  static async getUserAvatarsBatch(req: Request, res: Response): Promise<void> {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'User IDs array is required',
          code: 'INVALID_PARAMS',
        });
        return;
      }

      // Ограничиваем количество запросов за раз
      if (userIds.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Maximum 100 user IDs per request',
          code: 'TOO_MANY_IDS',
        });
        return;
      }

      // Получаем пользователей одним запросом вместо N отдельных
      const parsedIds = userIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      const usersById = new Map(
        (await UserService.getUsersByIds(parsedIds)).map((u) => [u.id, u])
      );

      // Сохраняем исходный порядок userIds, отбрасывая ненайденных
      const validUsers = parsedIds
        .map((id) => usersById.get(id))
        .filter((u): u is NonNullable<typeof u> => u !== undefined);
      const telegramIds = validUsers.map((u) => u.telegramId);

      // Batch-загрузка аватарок
      const avatarsMap = await AvatarService.getUserAvatarsBatch(telegramIds);

      // Формируем результат
      const result = validUsers.map((user) => ({
        userId: user.id,
        telegramId: user.telegramId.toString(),
        avatarUrl: avatarsMap.get(user.telegramId.toString()) || null,
      }));

      res.json({
        success: true,
        data: result,
        total: result.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting user avatars batch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user avatars',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

export const userController = UserController;
