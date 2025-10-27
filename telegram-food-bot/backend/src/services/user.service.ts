import { User, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateUserData, UpdateUserData } from '../types/user.types';

export class UserService {
  /**
   * РЎРѕР·РґР°РЅРёРµ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
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
  static async upsertUser(data: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.upsert({
        where: { telegramId: BigInt(data.telegramId) },
        update: {
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl, // ✅ Обновляем фото при каждом входе
          updatedAt: new Date(),
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
      return user;
    } catch (error) {
      logger.error('Error upserting user:', error);
      throw new Error('Failed to create or update user');
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
   * Обновление пользователя
   */
  static async updateUser(id: number, data: UpdateUserData): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
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
          updatedAt: new Date(),
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
          updatedAt: new Date(),
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
   * TODO: Requires many-to-many relation between User and Group in Prisma schema
   */
  /* 
  static async getActiveUsersInGroup(groupId: number): Promise<User[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          groups: {
            some: {
              groupId: groupId,
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
  */

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
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          paymentCard: data.paymentCard,
          paymentPhone: data.paymentPhone,
          paymentDetails: data.paymentDetails,
          updatedAt: new Date(),
        },
      });

      logger.info(`Payment info updated for user: ${user.id}`);
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

      return user;
    } catch (error) {
      logger.error('Error getting payment info:', error);
      throw new Error('Failed to get payment info');
    }
  }
}
