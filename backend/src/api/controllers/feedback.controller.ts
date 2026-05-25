import { Request, Response } from 'express';
import { feedbackService } from '../../services/feedback.service';
import { logger } from '../../utils/logger';

/**
 * Feedback Controller - Контроллер обратной связи
 */
class FeedbackController {
  /**
   * Отправить обратную связь
   * POST /api/feedback
   */
  async send(req: Request, res: Response) {
    try {
      const authUser = (req as any).user;
      if (!authUser) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      // Анти-спуфинг: identity берётся ТОЛЬКО из аутентифицированного контекста.
      // Поля userId/username/firstName из body игнорируются.
      // Telegram ID хранится BigInt → конвертируем в number (Telegram ID < 2^53, безопасно).
      const userId: number | undefined =
        authUser.telegramId != null ? Number(authUser.telegramId) : authUser.id;
      const username: string | undefined = authUser.username ?? undefined;
      const firstName: string | undefined = authUser.firstName ?? undefined;

      logger.info('📨 [FeedbackController] Received feedback request', {
        hasMessage: !!req.body.message,
        userId,
      });

      const { message } = req.body;

      // Валидация
      if (!message || typeof message !== 'string' || !message.trim()) {
        logger.warn('⚠️ [FeedbackController] Validation failed: empty message');
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a non-empty string'
        });
      }

      if (message.trim().length > 1000) {
        logger.warn('⚠️ [FeedbackController] Validation failed: message too long');
        return res.status(400).json({
          success: false,
          error: 'Message is too long (max 1000 characters)'
        });
      }

      logger.info('🚀 [FeedbackController] Calling feedbackService.sendToAdmin()');

      // Отправляем сообщение создателю бота через Telegram
      await feedbackService.sendToAdmin({
        message: message.trim(),
        userId,
        username,
        firstName,
      });

      logger.info('✅ [FeedbackController] Feedback received and sent successfully', { 
        userId, 
        username,
        messageLength: message.trim().length
      });

      return res.json({
        success: true,
        data: {
          id: Date.now(), // Временный ID
          createdAt: new Date().toISOString(),
        }
      });
    } catch (error: any) {
      logger.error('❌ [FeedbackController] Error processing feedback:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send feedback'
      });
    }
  }
}

export const feedbackController = new FeedbackController();
