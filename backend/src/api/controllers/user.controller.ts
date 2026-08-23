import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { AvatarService } from '../../services/avatar.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';
import { requireAuthUser } from '../middleware/require-auth-user';

/**
 * Реквизиты для переводов. Проверка была только на `typeof === 'string'`:
 * прямой вызов API принимал любую строку как реквизит, по которому людям
 * предлагается отправить деньги.
 *
 * Схему ссылки проверяем именно здесь, а не только на клиенте: значение
 * показывается ДРУГИМ участникам кнопкой «Перевести по ссылке», и
 * `javascript:`-адрес из чужого профиля исполнился бы под пальцем того, кто
 * платит. Клиентская проверка защищает только того, кто её проходит.
 */
const PAYMENT_LINK_SCHEMES = ['http:', 'https:'];

const paymentLink = z
  .string()
  .trim()
  .max(500, 'Ссылка слишком длинная')
  .refine((value) => {
    try {
      return PAYMENT_LINK_SCHEMES.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Ссылка должна начинаться с https://');

const paymentPhone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }, 'В номере телефона должно быть от 10 до 15 цифр');

/* Пустая строка означает «реквизит убрали» и должна доходить до сервиса как
   очистка поля, а не отвергаться проверкой формата. */
const emptiable = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([z.literal(''), schema]).nullish();

const PaymentInfoSchema = z.object({
  paymentPhone: emptiable(paymentPhone),
  paymentCard: emptiable(paymentLink),
  paymentDetails: z.string().trim().max(200).nullish(),
});

export class UserController {
  /**
   * GET /api/user/me
   * Получение информации о текущем пользователе
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;

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
      const user = req.user;

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
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      const parsed = PaymentInfoSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Invalid payment info',
          code: 'INVALID_PAYMENT_INFO',
          issues: parsed.error.issues,
        });
        return;
      }
      /* Сервис различает три случая: undefined — «поле не трогать», пустая
         строка — «очистить». null от клиента означает именно очистку, поэтому
         превращаем его в пустую строку; отсутствующий ключ так и остаётся
         отсутствующим. Без этого убрать свои реквизиты было нельзя вовсе:
         клиент слал undefined, ключ пропадал из JSON, и сервер сохранял
         старое значение. */
      const clearable = (v: string | null | undefined) => (v === null ? '' : v);

      const updatedUser = await UserService.updatePaymentInfo(user.id, {
        paymentCard: clearable(parsed.data.paymentCard),
        paymentPhone: clearable(parsed.data.paymentPhone),
        paymentDetails: clearable(parsed.data.paymentDetails),
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
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      // Группы пользователя = только реальные активные членства. Глобальный
      // isAdmin НЕ даёт доступ к чужим группам (group-scoped изоляция): чтобы
      // управлять группой, нужно быть её админом в group_members. Иначе
      // супер-админ видел бы все группы в переключателе/создании, а бэк всё
      // равно вернул бы 403 на assertAdmin — нестыковка + утечка чужих групп.
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
      const requestingUser = requireAuthUser(req, res);
      if (!requestingUser) return;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const parsedUserId = parseInt(userId, 10);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      if (!requestingUser?.isAdmin) {
        const accessibleUserIds = await GroupService.getUsersSharingActiveGroup(
          requestingUser.id,
          [parsedUserId]
        );
        if (!accessibleUserIds.has(parsedUserId)) {
          res.status(404).json({
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND',
          });
          return;
        }
      }

      // Получаем пользователя по ID
      const user = await UserService.getUserById(parsedUserId);

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
      const requestingUser = requireAuthUser(req, res);
      if (!requestingUser) return;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'User IDs array is required',
          code: 'VALIDATION_ERROR',
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
      const parsedIds = userIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0);
      const accessibleIds = requestingUser?.isAdmin
        ? new Set(parsedIds)
        : await GroupService.getUsersSharingActiveGroup(
            requestingUser.id,
            parsedIds
          );
      const authorizedIds = parsedIds.filter(id => accessibleIds.has(id));
      const usersById = new Map(
        (await UserService.getUsersByIds(authorizedIds)).map((u) => [u.id, u])
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
