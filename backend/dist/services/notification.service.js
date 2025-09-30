"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const logger_1 = require("../utils/logger");
const client_1 = require("../database/client");
const notification_types_1 = require("../types/notification.types");
class NotificationService {
    bot = null;
    templates;
    constructor() {
        this.templates = this.initializeTemplates();
    }
    initialize(bot) {
        this.bot = bot;
        logger_1.logger.info('Notification service initialized');
    }
    initializeTemplates() {
        const templates = new Map();
        templates.set(notification_types_1.NotificationType.POLL_STARTED, {
            type: notification_types_1.NotificationType.POLL_STARTED,
            getTitle: (data) => '🗳️ Началось голосование!',
            getMessage: (data) => {
                let message = `📢 В группе *${data.groupTitle}* началось новое голосование!\n\n`;
                message += `🍽️ Доступно блюд: ${data.menuItems.length}\n`;
                if (data.endTime) {
                    message += `⏰ Завершится: ${this.formatDate(data.endTime)}\n`;
                }
                message += `\n👉 Проголосуйте в чате группы!`;
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.NORMAL,
        });
        templates.set(notification_types_1.NotificationType.POLL_ENDED, {
            type: notification_types_1.NotificationType.POLL_ENDED,
            getTitle: (data) => '✅ Голосование завершено!',
            getMessage: (data) => {
                let message = `📊 Голосование завершилось!\n\n`;
                message += `👥 Всего голосов: ${data.totalVotes}\n\n`;
                if (data.winnerItem) {
                    message += `🏆 *Победитель:* ${data.winnerItem.name}\n`;
                    if (data.winnerItem.price) {
                        message += `💰 Цена: ${data.winnerItem.price} руб.\n`;
                    }
                }
                if (data.topItems && data.topItems.length > 0) {
                    message += `\n📈 *Топ блюд:*\n`;
                    data.topItems.slice(0, 3).forEach((item, index) => {
                        const emoji = ['🥇', '🥈', '🥉'][index] || '•';
                        message += `${emoji} ${item.item.name} - ${item.votes} голосов (${item.percentage}%)\n`;
                    });
                }
                message += `\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.HIGH,
        });
        templates.set(notification_types_1.NotificationType.ROULETTE_WINNER, {
            type: notification_types_1.NotificationType.ROULETTE_WINNER,
            getTitle: (data) => '🎉 Вы выбраны ответственным!',
            getMessage: (data) => {
                let message = `🎊 *Поздравляем, ${data.winner.firstName}!*\n\n`;
                message += `Рулетка выбрала вас ответственным за заказ еды.\n\n`;
                if (data.winnerItem) {
                    message += `🍽️ *Заказываем:* ${data.winnerItem.name}\n`;
                    if (data.winnerItem.price) {
                        message += `💰 *Цена:* ${data.winnerItem.price} руб.\n`;
                    }
                    if (data.winnerItem.description) {
                        message += `📝 ${data.winnerItem.description}\n`;
                    }
                }
                message += `\n👥 *Количество участников:* ${data.voters.length}\n`;
                message += `📊 *Всего голосов:* ${data.totalVotes}\n`;
                if (data.orderDetails) {
                    message += `\n📋 *Детали заказа:*\n`;
                    if (data.orderDetails.restaurant) {
                        message += `🏪 Ресторан: ${data.orderDetails.restaurant}\n`;
                    }
                    if (data.orderDetails.deliveryTime) {
                        message += `⏰ Время доставки: ${this.formatDate(data.orderDetails.deliveryTime)}\n`;
                    }
                    if (data.orderDetails.budget) {
                        message += `💵 Бюджет: ${data.orderDetails.budget} руб.\n`;
                    }
                }
                message += `\n📝 *Следующие шаги:*\n`;
                message += `1️⃣ Свяжитесь с участниками\n`;
                message += `2️⃣ Соберите деньги\n`;
                message += `3️⃣ Сделайте заказ\n`;
                message += `4️⃣ Организуйте доставку\n`;
                message += `\n💪 Удачи! Все рассчитывают на вас!`;
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.URGENT,
        });
        templates.set(notification_types_1.NotificationType.ORDER_REMINDER, {
            type: notification_types_1.NotificationType.ORDER_REMINDER,
            getTitle: () => '⏰ Напоминание о заказе',
            getMessage: (data) => {
                let message = `⏰ *Напоминание!*\n\n`;
                message += `Не забудьте сделать заказ еды.\n`;
                if (data.deadline) {
                    message += `⏱️ Крайний срок: ${this.formatDate(data.deadline)}\n`;
                }
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.NORMAL,
        });
        return templates;
    }
    async send(data) {
        const startTime = Date.now();
        try {
            if (!this.bot) {
                throw new Error('Bot not initialized');
            }
            const isMuted = await this.isUserMuted(data.userId);
            if (isMuted) {
                logger_1.logger.info(`User ${data.userId} is muted, skipping notification`);
                return {
                    success: false,
                    error: 'User is muted',
                    sentAt: new Date(),
                };
            }
            const result = await this.bot.api.sendMessage(data.userId, data.message, {
                parse_mode: data.parseMode,
                reply_markup: data.replyMarkup,
                disable_notification: data.disableNotification,
            });
            const deliveryTime = Date.now() - startTime;
            logger_1.logger.info('Notification sent', {
                userId: data.userId,
                type: data.type,
                messageId: result.message_id,
                deliveryTime: `${deliveryTime}ms`,
            });
            return {
                success: true,
                messageId: result.message_id,
                sentAt: new Date(),
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to send notification', {
                userId: data.userId,
                type: data.type,
                error: error.message,
            });
            return {
                success: false,
                error: error.message,
                sentAt: new Date(),
            };
        }
    }
    async sendRouletteWinnerNotification(data) {
        const template = this.templates.get(notification_types_1.NotificationType.ROULETTE_WINNER);
        if (!template) {
            throw new Error('Template not found');
        }
        const message = template.getMessage(data);
        return this.send({
            userId: data.winner.id,
            type: notification_types_1.NotificationType.ROULETTE_WINNER,
            priority: template.priority,
            message,
            parseMode: template.parseMode,
        });
    }
    async sendPollEndedNotification(userIds, data) {
        const template = this.templates.get(notification_types_1.NotificationType.POLL_ENDED);
        if (!template) {
            throw new Error('Template not found');
        }
        const message = template.getMessage(data);
        const results = await Promise.all(userIds.map((userId) => this.send({
            userId,
            type: notification_types_1.NotificationType.POLL_ENDED,
            priority: template.priority,
            message,
            parseMode: template.parseMode,
        })));
        return results;
    }
    async sendPollStartedNotification(userIds, data) {
        const template = this.templates.get(notification_types_1.NotificationType.POLL_STARTED);
        if (!template) {
            throw new Error('Template not found');
        }
        const message = template.getMessage(data);
        const results = await Promise.all(userIds.map((userId) => this.send({
            userId,
            type: notification_types_1.NotificationType.POLL_STARTED,
            priority: template.priority,
            message,
            parseMode: template.parseMode,
        })));
        return results;
    }
    async sendCustomNotification(userId, message, options) {
        let fullMessage = message;
        if (options?.title) {
            fullMessage = `*${options.title}*\n\n${message}`;
        }
        return this.send({
            userId,
            type: notification_types_1.NotificationType.CUSTOM,
            priority: options?.priority || notification_types_1.NotificationPriority.NORMAL,
            message: fullMessage,
            parseMode: options?.parseMode || 'Markdown',
            replyMarkup: options?.replyMarkup,
        });
    }
    async sendBulkNotification(userIds, message, options) {
        const results = await Promise.all(userIds.map((userId) => this.send({
            userId,
            type: options?.type || notification_types_1.NotificationType.CUSTOM,
            priority: options?.priority || notification_types_1.NotificationPriority.NORMAL,
            message,
            parseMode: options?.parseMode || 'Markdown',
        })));
        const successCount = results.filter((r) => r.success).length;
        logger_1.logger.info(`Bulk notification sent to ${successCount}/${userIds.length} users`);
        return results;
    }
    async isUserMuted(userId) {
        try {
            const user = await client_1.prisma.user.findUnique({
                where: { id: userId },
                select: { isActive: true },
            });
            return !user?.isActive;
        }
        catch (error) {
            logger_1.logger.error('Error checking if user is muted', { userId, error });
            return false;
        }
    }
    formatDate(date) {
        const options = {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow',
        };
        return new Intl.DateTimeFormat('ru-RU', options).format(date);
    }
    async getStats() {
        return {
            total: 0,
            sent: 0,
            failed: 0,
            pending: 0,
        };
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map