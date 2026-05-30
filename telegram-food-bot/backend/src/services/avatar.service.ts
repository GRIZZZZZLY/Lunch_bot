import { User } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { getBotInstance } from '../bot/bot-instance';
import { signAvatarUrl } from '../utils/avatar-url-signer';

/**
 * При выдаче клиенту трансформируем `tg://avatar/<fileId>` (хранится в БД)
 * в подписанный `/api/avatar/<fileId>?exp=&sig=`. Подпись короткоживущая;
 * хранить её в БД нельзя (протухнет). Любые другие форматы (внешние URL)
 * — возвращаем как есть.
 */
function presentAvatarUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const prefix = 'tg://avatar/';
  if (stored.startsWith(prefix)) {
    const fileId = stored.slice(prefix.length);
    if (!fileId) return null;
    return signAvatarUrl(fileId);
  }
  return stored;
}

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
        logger.error('[AvatarService] ❌ Bot instance not available for avatar fetch - bot may not be initialized yet');
        return null;
      }

      logger.info(`[AvatarService] 🔄 Fetching avatar for user ${telegramId} from Telegram API`);

      // Получаем фото профиля через getUserProfilePhotos
      const photos = await bot.api.getUserProfilePhotos(Number(telegramId), {
        limit: 1,
      });

      if (!photos.photos.length || !photos.photos[0]?.length) {
        logger.info(`[AvatarService] ℹ️  No avatar found for user ${telegramId}`);
        return null;
      }

      // Берём самое большое фото (последнее в массиве)
      const photoSizes = photos.photos[0];
      const largestPhoto = photoSizes[photoSizes.length - 1];

      if (!largestPhoto) {
        logger.warn(`[AvatarService] ⚠️  No largest photo found for user ${telegramId}`);
        return null;
      }

      logger.debug(`[AvatarService] Found photo file_id: ${largestPhoto.file_id}`);

      // Получаем URL файла через getFile
      const file = await bot.api.getFile(largestPhoto.file_id);

      if (!file.file_path) {
        logger.warn(`[AvatarService] ⚠️  No file_path for avatar ${largestPhoto.file_id}`);
        return null;
      }

      // ВАЖНО: Telegram API файлы недоступны напрямую из браузера из-за CORS.
      // В БД храним `tg://avatar/{file_id}` как стабильный маркер (file_id живёт долго),
      // на отдачу клиенту трансформируем в подписанный `/api/avatar/{file_id}?exp=&sig=`
      // через presentAvatarUrl() — иначе <img src> получит 401 от auth-middleware.
      const avatarUrl = `tg://avatar/${largestPhoto.file_id}`;

      logger.info(`[AvatarService] ✅ Avatar fetched successfully for user ${telegramId}: ${file.file_path} (file_id: ${largestPhoto.file_id})`);
      return avatarUrl;
    } catch (error: any) {
      // Обрабатываем специфичные ошибки Telegram API
      if (error.error_code === 400 && error.description?.includes('USER_ID_INVALID')) {
        logger.warn(`[AvatarService] ⚠️  Invalid user ID for avatar fetch: ${telegramId}`);
        return null;
      }

      if (error.error_code === 400 && error.description?.includes('Bad Request: user not found')) {
        logger.warn(`[AvatarService] ⚠️  User not found in Telegram: ${telegramId}`);
        return null;
      }

      logger.error(`[AvatarService] ❌ Error fetching avatar from Telegram for ${telegramId}:`, {
        error_code: error.error_code,
        description: error.description,
        message: error.message,
        stack: error.stack,
      });
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
      logger.debug(`[AvatarService] 📷 getUserAvatar called for telegramId: ${telegramId}`);

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
        logger.warn(`[AvatarService] ⚠️  User not found in DB for avatar fetch: ${telegramId}`);
        return null;
      }

      logger.debug(`[AvatarService] Found user in DB: id=${user.id}, hasAvatar=${!!user.avatarUrl}, updatedAt=${user.avatarUpdatedAt}`);

      // 2. Проверяем валидность кэша
      if (user.avatarUrl && this.isCacheValid(user.avatarUpdatedAt)) {
        logger.debug(`[AvatarService] ✅ Avatar cache HIT for user ${telegramId}`);
        return presentAvatarUrl(user.avatarUrl);
      }

      // 3. Кэш невалиден или отсутствует → загружаем из Telegram API
      logger.info(`[AvatarService] 🔄 Avatar cache MISS for user ${telegramId}, fetching from Telegram API`);
      const avatarUrl = await this.fetchAvatarFromTelegram(telegramId);

      // 4. Обновляем кэш в БД
      await this.updateUserAvatar(user.id, avatarUrl);

      return presentAvatarUrl(avatarUrl);
    } catch (error) {
      logger.error(`[AvatarService] ❌ Error getting user avatar for ${telegramId}:`, error);
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
        results.set(user.telegramId.toString(), presentAvatarUrl(user.avatarUrl));
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
          results.set(result.value.telegramId, presentAvatarUrl(result.value.avatarUrl));
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
