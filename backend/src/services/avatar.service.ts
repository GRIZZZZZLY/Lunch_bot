import { User } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { getBotInstance } from '../bot/bot';

/**
 * Avatar Service
 *
 * Загружает и кэширует аватарки пользователей из Telegram API
 *
 * Стратегия кэширования:
 * - Кэш в базе данных: 7 дней
 * - Если кэш валиден → возвращаем из БД
 * - Если невалиден → загружаем из Telegram API → обновляем БД
 */
export class AvatarService {
  private static CACHE_VALIDITY_DAYS = 7;

  /**
   * Проверка валидности кэша
   */
  private static isCacheValid(avatarUpdatedAt: Date | null): boolean {
    if (!avatarUpdatedAt) return false;

    const now = new Date();
    const cacheAge = now.getTime() - avatarUpdatedAt.getTime();
    const maxAge = this.CACHE_VALIDITY_DAYS * 24 * 60 * 60 * 1000; // 7 дней в мс

    return cacheAge < maxAge;
  }

  /**
   * Загрузка аватарки из Telegram API
   */
  private static async fetchAvatarFromTelegram(
    telegramId: bigint
  ): Promise<string | null> {
    try {
      const bot = getBotInstance();
      if (!bot) {
        logger.warn('Bot instance not available for avatar fetch');
        return null;
      }

      // Получаем фото профиля через getUserProfilePhotos
      const photos = await bot.api.getUserProfilePhotos(Number(telegramId), {
        limit: 1,
      });

      if (!photos.photos.length || !photos.photos[0]?.length) {
        logger.info(`No avatar found for user ${telegramId}`);
        return null;
      }

      // Берём самое большое фото (последнее в массиве)
      const photoSizes = photos.photos[0];
      const largestPhoto = photoSizes[photoSizes.length - 1];

      if (!largestPhoto) {
        return null;
      }

      // Получаем URL файла через getFile
      const file = await bot.api.getFile(largestPhoto.file_id);

      if (!file.file_path) {
        logger.warn(`No file_path for avatar ${largestPhoto.file_id}`);
        return null;
      }

      // Формируем полный URL к файлу
      const token = bot.token;
      const avatarUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      logger.info(`Avatar fetched for user ${telegramId}: ${file.file_path}`);
      return avatarUrl;
    } catch (error: any) {
      // Обрабатываем специфичные ошибки Telegram API
      if (error.error_code === 400 && error.description.includes('USER_ID_INVALID')) {
        logger.warn(`Invalid user ID for avatar fetch: ${telegramId}`);
        return null;
      }

      logger.error(`Error fetching avatar from Telegram for ${telegramId}:`, error);
      return null;
    }
  }

  /**
   * Обновление аватарки в базе данных
   */
  private static async updateUserAvatar(
    userId: number,
    avatarUrl: string | null
  ): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl,
          avatarUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info(`Avatar cache updated for user ID ${userId}`);
    } catch (error) {
      logger.error(`Error updating avatar cache for user ID ${userId}:`, error);
      throw new Error('Failed to update avatar cache');
    }
  }

  /**
   * Получение аватарки пользователя с кэшированием
   *
   * @param telegramId - Telegram ID пользователя
   * @returns URL аватарки или null
   */
  static async getUserAvatar(telegramId: bigint): Promise<string | null> {
    try {
      // 1. Получаем пользователя из БД
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: {
          id: true,
          avatarUrl: true,
          avatarUpdatedAt: true,
        },
      });

      if (!user) {
        logger.warn(`User not found for avatar fetch: ${telegramId}`);
        return null;
      }

      // 2. Проверяем валидность кэша
      if (user.avatarUrl && this.isCacheValid(user.avatarUpdatedAt)) {
        logger.debug(`Avatar cache hit for user ${telegramId}`);
        return user.avatarUrl;
      }

      // 3. Кэш невалиден или отсутствует → загружаем из Telegram API
      logger.debug(`Avatar cache miss for user ${telegramId}, fetching from Telegram`);
      const avatarUrl = await this.fetchAvatarFromTelegram(telegramId);

      // 4. Обновляем кэш в БД
      await this.updateUserAvatar(user.id, avatarUrl);

      return avatarUrl;
    } catch (error) {
      logger.error(`Error getting user avatar for ${telegramId}:`, error);
      return null;
    }
  }

  /**
   * Batch-загрузка аватарок для нескольких пользователей
   *
   * Эффективно загружает аватарки для списка пользователей:
   * - Загружает только те, у кого невалидный кэш
   * - Возвращает Map с результатами
   *
   * @param telegramIds - Массив Telegram ID
   * @returns Map<telegramId, avatarUrl | null>
   */
  static async getUserAvatarsBatch(
    telegramIds: bigint[]
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    try {
      if (!telegramIds.length) {
        return results;
      }

      // 1. Получаем всех пользователей из БД за один запрос
      const users = await prisma.user.findMany({
        where: {
          telegramId: { in: telegramIds.map(id => BigInt(id)) },
        },
        select: {
          id: true,
          telegramId: true,
          avatarUrl: true,
          avatarUpdatedAt: true,
        },
      });

      // 2. Разделяем на валидный кэш и требующие обновления
      const validCache: typeof users = [];
      const needsUpdate: typeof users = [];

      for (const user of users) {
        if (user.avatarUrl && this.isCacheValid(user.avatarUpdatedAt)) {
          validCache.push(user);
        } else {
          needsUpdate.push(user);
        }
      }

      // 3. Добавляем пользователей с валидным кэшем
      for (const user of validCache) {
        results.set(user.telegramId.toString(), user.avatarUrl);
      }

      logger.info(
        `Avatar batch: ${validCache.length} from cache, ${needsUpdate.length} need update`
      );

      // 4. Загружаем аватарки для пользователей с невалидным кэшем
      // Используем Promise.allSettled чтобы продолжить при ошибках
      const fetchPromises = needsUpdate.map(async (user) => {
        const avatarUrl = await this.fetchAvatarFromTelegram(user.telegramId);
        await this.updateUserAvatar(user.id, avatarUrl);
        return { telegramId: user.telegramId.toString(), avatarUrl };
      });

      const fetchResults = await Promise.allSettled(fetchPromises);

      // 5. Обрабатываем результаты загрузки
      for (const result of fetchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.telegramId, result.value.avatarUrl);
        } else {
          logger.error('Error in batch avatar fetch:', result.reason);
        }
      }

      return results;
    } catch (error) {
      logger.error('Error in getUserAvatarsBatch:', error);
      return results;
    }
  }

  /**
   * Принудительное обновление аватарки
   *
   * Игнорирует кэш и загружает свежую аватарку из Telegram API
   *
   * @param telegramId - Telegram ID пользователя
   * @returns URL аватарки или null
   */
  static async refreshUserAvatar(telegramId: bigint): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: { id: true },
      });

      if (!user) {
        logger.warn(`User not found for avatar refresh: ${telegramId}`);
        return null;
      }

      const avatarUrl = await this.fetchAvatarFromTelegram(telegramId);
      await this.updateUserAvatar(user.id, avatarUrl);

      return avatarUrl;
    } catch (error) {
      logger.error(`Error refreshing user avatar for ${telegramId}:`, error);
      return null;
    }
  }

  /**
   * Очистка устаревшего кэша аватарок
   *
   * Удаляет avatarUrl для пользователей, у которых кэш старше указанного срока
   * Полезно для периодической очистки (через cron)
   *
   * @param olderThanDays - Удалить кэш старше N дней (по умолчанию 30)
   * @returns Количество очищенных записей
   */
  static async clearStaleCache(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.user.updateMany({
        where: {
          avatarUpdatedAt: {
            lt: cutoffDate,
          },
          avatarUrl: {
            not: null,
          },
        },
        data: {
          avatarUrl: null,
          avatarUpdatedAt: null,
        },
      });

      logger.info(`Cleared ${result.count} stale avatar cache entries older than ${olderThanDays} days`);
      return result.count;
    } catch (error) {
      logger.error('Error clearing stale avatar cache:', error);
      throw new Error('Failed to clear stale cache');
    }
  }
}
