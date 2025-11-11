import { Request, Response } from 'express';
import https from 'https';
import { logger } from '../../utils/logger';
import { getBotInstance } from '../../bot/bot';

/**
 * Avatar Controller
 * 
 * Проксирует запросы к Telegram API для загрузки аватарок
 * Решает проблему CORS при прямом обращении к api.telegram.org
 */

/**
 * GET /api/avatar/:fileId
 * Загружает аватарку из Telegram API и возвращает как изображение
 */
export async function getAvatarByFileId(req: Request, res: Response): Promise<void> {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      res.status(400).json({
        success: false,
        error: 'File ID is required',
      });
      return;
    }

    const bot = getBotInstance();
    if (!bot) {
      logger.error('[AvatarController] Bot instance not available');
      res.status(503).json({
        success: false,
        error: 'Bot service unavailable',
      });
      return;
    }

    // Получаем информацию о файле
    const file = await bot.api.getFile(fileId);

    if (!file.file_path) {
      res.status(404).json({
        success: false,
        error: 'File path not found',
      });
      return;
    }

    // Формируем URL к файлу
    const token = bot.token;
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Загружаем файл через https.get
    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        res.status(response.statusCode || 500).json({
          success: false,
          error: 'Failed to fetch file from Telegram',
        });
        return;
      }

      // Определяем Content-Type
      const contentType = response.headers['content-type'] || 'image/jpeg';

      // Устанавливаем заголовки для кэширования
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 дней
      res.setHeader('Access-Control-Allow-Origin', '*'); // Разрешаем CORS

      // Pipe response напрямую
      response.pipe(res);

      logger.debug(`[AvatarController] Avatar served: ${fileId}`);
    }).on('error', (error) => {
      logger.error('[AvatarController] Error downloading file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download file',
      });
    });

  } catch (error: any) {
    logger.error('[AvatarController] Error fetching avatar:', {
      fileId: req.params.fileId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch avatar',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
