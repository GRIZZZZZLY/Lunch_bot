import type { TelegramSender } from '../types/bot.types';
import { logger } from '../utils/logger';
import { escapeHtml } from '../utils/telegram-html';

interface FeedbackData {
  message: string;
  userId?: number;
  username?: string;
  firstName?: string;
}

/**
 * Feedback Service - Сервис обратной связи
 * 
 * Отправляет сообщения пользователей создателю бота в Telegram
 */
class FeedbackService {
  private bot: TelegramSender | null = null;
  /* Все id из ADMIN_USER_IDS. Раньше брался только первый, и остальные
     админы, перечисленные в настройке, писем не получали. */
  private adminUserIds: string[];

  constructor() {
    this.adminUserIds = (process.env.ADMIN_USER_IDS ?? '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (this.adminUserIds.length === 0) {
      logger.warn('⚠️ ADMIN_USER_IDS not set in .env - feedback will not work');
    }
  }

  /**
   * Инициализация с ботом
   */
  initialize(bot: TelegramSender): void {
    this.bot = bot;
    logger.info('✅ Feedback service initialized', {
      adminCount: this.adminUserIds.length,
    });
  }

  /**
   * Отправить обратную связь админу
   */
  async sendToAdmin(data: FeedbackData): Promise<void> {
    logger.info('🔵 [FeedbackService] sendToAdmin called', {
      hasBot: !!this.bot,
      adminCount: this.adminUserIds.length,
      messageLength: data.message?.length,
    });

    const bot = this.bot;
    if (!bot) {
      logger.error('❌ [FeedbackService] Bot not initialized!');
      throw new Error('Bot not initialized');
    }

    if (this.adminUserIds.length === 0) {
      logger.error('❌ [FeedbackService] Admin user ID not configured!');
      throw new Error('Admin user ID not configured');
    }

    try {
      const { message, userId, username, firstName } = data;

      // Форматируем сообщение с HTML разметкой
      let feedbackMessage = '📩 <b>Новая обратная связь</b>\n\n';
      
      feedbackMessage += `💬 <b>Сообщение:</b>\n${escapeHtml(message)}\n\n`;
      
      feedbackMessage += '👤 <b>От пользователя:</b>\n';
      if (firstName) feedbackMessage += `Имя: ${escapeHtml(firstName)}\n`;
      if (username) feedbackMessage += `Username: @${escapeHtml(username)}\n`;
      if (userId) feedbackMessage += `ID: ${userId}\n`;
      
      feedbackMessage += `\n⏰ ${new Date().toLocaleString('ru-RU')}`;

      logger.info('📤 [FeedbackService] Sending message to Telegram', {
        adminCount: this.adminUserIds.length,
        messageLength: feedbackMessage.length,
      });

      /* Каждому админу отдельно и независимо: один заблокировавший бота
         админ не должен лишать письма остальных. Ошибка запроса — только если
         не дошло никому. */
      const results = await Promise.allSettled(
        this.adminUserIds.map(adminId =>
          bot.api.sendMessage(adminId, feedbackMessage, { parse_mode: 'HTML' })
        )
      );
      const failed = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      for (const failure of failed) {
        logger.warn('⚠️ [FeedbackService] Feedback not delivered to one admin', {
          error: failure.reason,
        });
      }
      if (failed.length === results.length) {
        throw failed[0].reason;
      }

      logger.info('✅ [FeedbackService] Message sent successfully to admin', {
        delivered: results.length - failed.length,
        userId,
        messageLength: message.length
      });

    } catch (error: any) {
      logger.error('❌ [FeedbackService] Error sending feedback to admin:', error);
      throw new Error('Failed to send feedback');
    }
  }
}

export const feedbackService = new FeedbackService();
