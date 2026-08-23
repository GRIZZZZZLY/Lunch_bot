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
  private adminUserId: string;

  constructor() {
    // ID создателя бота из .env
    this.adminUserId = process.env.ADMIN_USER_IDS?.split(',')[0] || '';
    
    if (!this.adminUserId) {
      logger.warn('⚠️ ADMIN_USER_IDS not set in .env - feedback will not work');
    }
  }

  /**
   * Инициализация с ботом
   */
  initialize(bot: TelegramSender): void {
    this.bot = bot;
    logger.info('✅ Feedback service initialized', {
      adminUserId: this.adminUserId
    });
  }

  /**
   * Отправить обратную связь админу
   */
  async sendToAdmin(data: FeedbackData): Promise<void> {
    logger.info('🔵 [FeedbackService] sendToAdmin called', {
      hasBot: !!this.bot,
      adminUserId: this.adminUserId,
      messageLength: data.message?.length,
    });

    if (!this.bot) {
      logger.error('❌ [FeedbackService] Bot not initialized!');
      throw new Error('Bot not initialized');
    }

    if (!this.adminUserId) {
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
        adminUserId: this.adminUserId,
        messageLength: feedbackMessage.length,
      });

      // Отправляем админу с HTML parse_mode
      await this.bot.api.sendMessage(this.adminUserId, feedbackMessage, {
        parse_mode: 'HTML',
      });

      logger.info('✅ [FeedbackService] Message sent successfully to admin', { 
        adminId: this.adminUserId, 
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
