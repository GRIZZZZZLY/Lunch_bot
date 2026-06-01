import { User, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateUserData, UpdateUserData } from '../types/user.types';
import { now } from '../utils/date';
import { EncryptionService } from '../utils/encryption';
import { getBotInstance } from '../bot/bot-instance';

export class UserService {
  /**
   * Создание нового пользователя
   */
  static async createUser(data: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          telegramId: BigInt(data.telegramId),
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          isAdmin: false,
          isActive: true,
        },
      });

      logger.info(`User created: ${user.telegramId} (${user.firstName})`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }
  /**
   * Создание или обновление пользователя
   */
  static async upsertUser(data: CreateUserData, groupId?: number): Promise<User> {
    try {
      // Проверяем существует ли пользователь
      const existingUser = await prisma.user.findUnique({
        where: { telegramId: BigInt(data.telegramId) },
      });

      const isNewUser = !existingUser;

      const user = await prisma.user.upsert({
        where: { telegramId: BigInt(data.telegramId) },
        update: {
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl, // ✅ Обновляем фото при каждом входе
          updatedAt: now(),
        },
        create: {
          telegramId: BigInt(data.telegramId),
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl, // ✅ Сохраняем фото при создании
          isAdmin: false,
          isActive: true,
        },
      });

      logger.info(`User upserted: ${user.telegramId} (${user.firstName})${data.photoUrl ? ' with photo' : ''}`);

      // Если это новый пользователь и указана группа, отправляем уведомления админам
      if (isNewUser && groupId) {
        this.notifyAdminsAboutNewUser(user, groupId).catch((error) => {
          logger.error('Error sending new user notifications:', error);
        });
      }

      return user;
    } catch (error) {
      logger.error('Error upserting user:', error);
      throw new Error('Failed to create or update user');
    }
  }

  /**
   * Отправка уведомлений администраторам о новом пользователе
   */
  private static async notifyAdminsAboutNewUser(user: User, groupId: number): Promise<void> {
    try {
      // Получаем настройки уведомлений для группы
      const notificationSettings = await prisma.adminNotificationSettings.findUnique({
        where: { groupId },
      });

      // Если уведомления о новых пользователях отключены, выходим
      if (notificationSettings && !notificationSettings.notifyOnNewUser) {
        logger.info(`[UserService] New user notifications disabled for group ${groupId}`);
        return;
      }

      // Получаем всех активных админов группы
      const groupAdmins = await prisma.user.findMany({
        where: {
          isAdmin: true,
          isActive: true,
          groupMemberships: {
            some: {
              groupId,
              isActive: true,
            },
          },
        },
      });

      if (groupAdmins.length === 0) {
        logger.info(`[UserService] No admins found for group ${groupId}`);
        return;
      }

      const bot = getBotInstance();
      if (!bot) {
        logger.error('[UserService] Bot instance not available');
        return;
      }

      const message = `🆕 *Новый пользователь*\n\n` +
        `👤 ${user.firstName}${user.lastName ? ` ${  user.lastName}` : ''}` +
        `${user.username ? ` (@${user.username})` : ''}`;

      // Отправляем уведомления всем админам
      let sent = 0;
      for (const admin of groupAdmins) {
        try {
          await bot.api.sendMessage(String(admin.telegramId), message, {
            parse_mode: 'Markdown',
          });
          sent++;
        } catch (error) {
          logger.error(`[UserService] Failed to notify admin ${admin.id}:`, error);
        }
      }

      logger.info(`[UserService] Sent new user notifications to ${sent}/${groupAdmins.length} admins`);
    } catch (error) {
      logger.error('[UserService] Error in notifyAdminsAboutNewUser:', error);
      throw error;
    }
  }

  /**
   * Получение пользователя по Telegram ID
   */
  static async getUserByTelegramId(telegramId: bigint): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });
    } catch (error) {
      logger.error('Error getting user by telegram ID:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Получение пользователя по ID
   */
  static async getUserById(id: number): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw new Error('Failed to get user');
    }
  }

  /**
   * Пакетное получение пользователей по списку ID (один запрос вместо N)
   */
  static async getUsersByIds(ids: number[]): Promise<User[]> {
    try {
      if (ids.length === 0) return [];
      return await prisma.user.findMany({
        where: { id: { in: ids } },
      });
    } catch (error) {
      logger.error('Error getting users by IDs:', error);
      throw new Error('Failed to get users');
    }
  }

  /**
   * Обновление пользователя
   */
  static async updateUser(id: number, data: UpdateUserData): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: now(),
        },
      });

      logger.info(`User updated: ${user.telegramId} (${user.firstName})`);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found');
        }
      }
      logger.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * Установка/снятие админских прав
   */
  static async setAdminStatus(telegramId: bigint, isAdmin: boolean): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { telegramId: BigInt(telegramId) },
        data: {
          isAdmin,
          updatedAt: now(),
        },
      });

      logger.info(`Admin status changed: ${user.telegramId} -> ${isAdmin}`);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found');
        }
      }
      logger.error('Error setting admin status:', error);
      throw new Error('Failed to set admin status');
    }
  }

  /**
   * Проверка админских прав
   */
  static async isAdmin(telegramId: bigint): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: { isAdmin: true },
      });

      return user?.isAdmin ?? false;
    } catch (error) {
      logger.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Активация/деактивация пользователя
   */
  static async setActiveStatus(telegramId: bigint, isActive: boolean): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { telegramId: BigInt(telegramId) },
        data: {
          isActive,
          updatedAt: now(),
        },
      });

      logger.info(`User active status changed: ${user.telegramId} -> ${isActive}`);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found');
        }
      }
      logger.error('Error setting active status:', error);
      throw new Error('Failed to set active status');
    }
  }

  /**
   * Получение всех админов
   */
  static async getAdmins(): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: { 
          isAdmin: true,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logger.error('Error getting admins:', error);
      throw new Error('Failed to get admins');
    }
  }

  /**
   * Получение активных пользователей группы
   */
  static async getActiveUsersInGroup(groupId: number): Promise<User[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          groupMemberships: {
            some: {
              groupId,
              isActive: true,
            },
          },
        },
        orderBy: { firstName: 'asc' },
      });

      return users;
    } catch (error) {
      logger.error('Error getting active users in group:', error);
      throw new Error('Failed to get active users in group');
    }
  }

  /**
   * Получение пользователей по ID группы (для poll reminder service)
   */
  static async getUsersByGroupId(groupId: number): Promise<User[]> {
    return this.getActiveUsersInGroup(groupId);
  }

  /**
   * Получение статистики пользователей
   */
  static async getUserStats(): Promise<{
    total: number;
    active: number;
    admins: number;
  }> {
    try {
      const [total, active, admins] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isAdmin: true, isActive: true } }),
      ]);

      return { total, active, admins };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw new Error('Failed to get user stats');
    }
  }

  // Alias methods для обратной совместимости
  async createOrUpdate(data: CreateUserData): Promise<User> {
    return UserService.upsertUser(data);
  }

  async getByTelegramId(telegramId: bigint): Promise<User | null> {
    return UserService.getUserByTelegramId(telegramId);
  }

  async isAdmin(telegramId: bigint): Promise<boolean> {
    return UserService.isAdmin(telegramId);
  }

  /**
   * Обновление платёжных данных пользователя
   * Sprint 1: Данные шифруются перед сохранением
   */
  static async updatePaymentInfo(
    userId: number,
    data: {
      paymentCard?: string;
      paymentPhone?: string;
      paymentDetails?: string;
    }
  ): Promise<User> {
    try {
      // Шифруем чувствительные данные перед сохранением
      const encryptedData: {
        paymentCard?: string;
        paymentPhone?: string;
        paymentDetails?: string;
        updatedAt: Date;
      } = {
        updatedAt: now(),
      };

      if (data.paymentCard !== undefined) {
        encryptedData.paymentCard = data.paymentCard 
          ? EncryptionService.encrypt(data.paymentCard)
          : data.paymentCard; // null или пустая строка остаются как есть
      }

      if (data.paymentPhone !== undefined) {
        encryptedData.paymentPhone = data.paymentPhone
          ? EncryptionService.encrypt(data.paymentPhone)
          : data.paymentPhone;
      }

      if (data.paymentDetails !== undefined) {
        encryptedData.paymentDetails = data.paymentDetails
          ? EncryptionService.encrypt(data.paymentDetails)
          : data.paymentDetails;
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: encryptedData,
      });

      logger.info(`Payment info updated for user: ${user.id} (encrypted)`);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found');
        }
      }
      logger.error('Error updating payment info:', error);
      throw new Error('Failed to update payment info');
    }
  }

  /**
   * Получение платёжных данных пользователя
   * Sprint 1: Данные расшифровываются при получении
   */
  static async getPaymentInfo(userId: number): Promise<{
    paymentCard?: string | null;
    paymentPhone?: string | null;
    paymentDetails?: string | null;
  } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          paymentCard: true,
          paymentPhone: true,
          paymentDetails: true,
        },
      });

      if (!user) {
        return null;
      }

      // Расшифровываем данные (EncryptionService.decrypt обрабатывает legacy данные)
      return {
        paymentCard: user.paymentCard 
          ? EncryptionService.decrypt(user.paymentCard) 
          : user.paymentCard,
        paymentPhone: user.paymentPhone 
          ? EncryptionService.decrypt(user.paymentPhone) 
          : user.paymentPhone,
        paymentDetails: user.paymentDetails 
          ? EncryptionService.decrypt(user.paymentDetails) 
          : user.paymentDetails,
      };
    } catch (error) {
      logger.error('Error getting payment info:', error);
      throw new Error('Failed to get payment info');
    }
  }

  /**
   * Получение маскированных платёжных данных (для отображения)
   * Показывает только последние 4 цифры карты/телефона
   */
  static async getMaskedPaymentInfo(userId: number): Promise<{
    paymentCard?: string | null;
    paymentPhone?: string | null;
    paymentDetails?: string | null;
  } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          paymentCard: true,
          paymentPhone: true,
          paymentDetails: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        paymentCard: user.paymentCard 
          ? EncryptionService.maskCardNumber(user.paymentCard)
          : null,
        paymentPhone: user.paymentPhone 
          ? EncryptionService.maskPhone(user.paymentPhone)
          : null,
        paymentDetails: user.paymentDetails 
          ? EncryptionService.decrypt(user.paymentDetails) 
          : null,
      };
    } catch (error) {
      logger.error('Error getting masked payment info:', error);
      throw new Error('Failed to get payment info');
    }
  }
}
