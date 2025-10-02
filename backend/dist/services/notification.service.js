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
            getTitle: (data) => 'рџ—іпёЏ РќР°С‡Р°Р»РѕСЃСЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ!',
            getMessage: (data) => {
                let message = `рџ“ў Р’ РіСЂСѓРїРїРµ *${data.groupTitle}* РЅР°С‡Р°Р»РѕСЃСЊ РЅРѕРІРѕРµ РіРѕР»РѕСЃРѕРІР°РЅРёРµ!\n\n`;
                message += `рџЌЅпёЏ Р”РѕСЃС‚СѓРїРЅРѕ Р±Р»СЋРґ: ${data.menuItems.length}\n`;
                if (data.endTime) {
                    message += `вЏ° Р—Р°РІРµСЂС€РёС‚СЃСЏ: ${this.formatDate(data.endTime)}\n`;
                }
                message += `\nрџ‘‰ РџСЂРѕРіРѕР»РѕСЃСѓР№С‚Рµ РІ С‡Р°С‚Рµ РіСЂСѓРїРїС‹!`;
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.NORMAL,
        });
        templates.set(notification_types_1.NotificationType.POLL_ENDED, {
            type: notification_types_1.NotificationType.POLL_ENDED,
            getTitle: (data) => 'вњ… Р“РѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ!',
            getMessage: (data) => {
                let message = `рџ“Љ Р“РѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р°РІРµСЂС€РёР»РѕСЃСЊ!\n\n`;
                message += `рџ‘Ґ Р’СЃРµРіРѕ РіРѕР»РѕСЃРѕРІ: ${data.totalVotes}\n\n`;
                if (data.winnerItem) {
                    message += `рџЏ† *РџРѕР±РµРґРёС‚РµР»СЊ:* ${data.winnerItem.name}\n`;
                    if (data.winnerItem.price) {
                        message += `рџ’° Р¦РµРЅР°: ${data.winnerItem.price} СЂСѓР±.\n`;
                    }
                }
                if (data.topItems && data.topItems.length > 0) {
                    message += `\nрџ“€ *РўРѕРї Р±Р»СЋРґ:*\n`;
                    data.topItems.slice(0, 3).forEach((item, index) => {
                        const emoji = ['рџҐ‡', 'рџҐ€', 'рџҐ‰'][index] || 'вЂў';
                        message += `${emoji} ${item.item.name} - ${item.votes} РіРѕР»РѕСЃРѕРІ (${item.percentage}%)\n`;
                    });
                }
                message += `\nрџЋІ РЎРµР№С‡Р°СЃ Р·Р°РїСѓСЃС‚РёС‚СЃСЏ СЂСѓР»РµС‚РєР° РґР»СЏ РІС‹Р±РѕСЂР° РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕРіРѕ...`;
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.HIGH,
        });
        templates.set(notification_types_1.NotificationType.ROULETTE_WINNER, {
            type: notification_types_1.NotificationType.ROULETTE_WINNER,
            getTitle: (data) => 'рџЋ‰ Р’С‹ РІС‹Р±СЂР°РЅС‹ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Рј!',
            getMessage: (data) => {
                let message = `рџЋЉ *РџРѕР·РґСЂР°РІР»СЏРµРј, ${data.winner.firstName}!*\n\n`;
                message += `Р СѓР»РµС‚РєР° РІС‹Р±СЂР°Р»Р° РІР°СЃ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Рј Р·Р° Р·Р°РєР°Р· РµРґС‹.\n\n`;
                if (data.winnerItem) {
                    message += `рџЌЅпёЏ *Р—Р°РєР°Р·С‹РІР°РµРј:* ${data.winnerItem.name}\n`;
                    if (data.winnerItem.price) {
                        message += `рџ’° *Р¦РµРЅР°:* ${data.winnerItem.price} СЂСѓР±.\n`;
                    }
                    if (data.winnerItem.description) {
                        message += `рџ“ќ ${data.winnerItem.description}\n`;
                    }
                }
                message += `\nрџ‘Ґ *РљРѕР»РёС‡РµСЃС‚РІРѕ СѓС‡Р°СЃС‚РЅРёРєРѕРІ:* ${data.voters.length}\n`;
                message += `рџ“Љ *Р’СЃРµРіРѕ РіРѕР»РѕСЃРѕРІ:* ${data.totalVotes}\n`;
                if (data.orderDetails) {
                    message += `\nрџ“‹ *Р”РµС‚Р°Р»Рё Р·Р°РєР°Р·Р°:*\n`;
                    if (data.orderDetails.restaurant) {
                        message += `рџЏЄ Р РµСЃС‚РѕСЂР°РЅ: ${data.orderDetails.restaurant}\n`;
                    }
                    if (data.orderDetails.deliveryTime) {
                        message += `вЏ° Р’СЂРµРјСЏ РґРѕСЃС‚Р°РІРєРё: ${this.formatDate(data.orderDetails.deliveryTime)}\n`;
                    }
                    if (data.orderDetails.budget) {
                        message += `рџ’µ Р‘СЋРґР¶РµС‚: ${data.orderDetails.budget} СЂСѓР±.\n`;
                    }
                }
                message += `\nрџ“ќ *РЎР»РµРґСѓСЋС‰РёРµ С€Р°РіРё:*\n`;
                message += `1пёЏвѓЈ РЎРІСЏР¶РёС‚РµСЃСЊ СЃ СѓС‡Р°СЃС‚РЅРёРєР°РјРё\n`;
                message += `2пёЏвѓЈ РЎРѕР±РµСЂРёС‚Рµ РґРµРЅСЊРіРё\n`;
                message += `3пёЏвѓЈ РЎРґРµР»Р°Р№С‚Рµ Р·Р°РєР°Р·\n`;
                message += `4пёЏвѓЈ РћСЂРіР°РЅРёР·СѓР№С‚Рµ РґРѕСЃС‚Р°РІРєСѓ\n`;
                message += `\nрџ’Є РЈРґР°С‡Рё! Р’СЃРµ СЂР°СЃСЃС‡РёС‚С‹РІР°СЋС‚ РЅР° РІР°СЃ!`;
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.URGENT,
        });
        templates.set(notification_types_1.NotificationType.ORDER_REMINDER, {
            type: notification_types_1.NotificationType.ORDER_REMINDER,
            getTitle: () => 'вЏ° РќР°РїРѕРјРёРЅР°РЅРёРµ Рѕ Р·Р°РєР°Р·Рµ',
            getMessage: (data) => {
                let message = `вЏ° *РќР°РїРѕРјРёРЅР°РЅРёРµ!*\n\n`;
                message += `РќРµ Р·Р°Р±СѓРґСЊС‚Рµ СЃРґРµР»Р°С‚СЊ Р·Р°РєР°Р· РµРґС‹.\n`;
                if (data.deadline) {
                    message += `вЏ±пёЏ РљСЂР°Р№РЅРёР№ СЃСЂРѕРє: ${this.formatDate(data.deadline)}\n`;
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