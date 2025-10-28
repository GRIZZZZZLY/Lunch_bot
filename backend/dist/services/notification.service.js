"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const logger_1 = require("../utils/logger");
const client_1 = require("../database/client");
const notification_types_1 = require("../types/notification.types");
function getPluralForm(count, one, few, many) {
    if (count % 10 === 1 && count % 100 !== 11)
        return one;
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100))
        return few;
    return many;
}
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
                let message = `🗳️ Голосование завершилось!\n\n`;
                message += `👥 Всего голосов: ${data.totalVotes}\n\n`;
                if (data.mode === 'multi-winner' && data.winners) {
                    if (data.winners.length > 0) {
                        message += `🍽️ *Кто что заказывает:*\n\n`;
                        data.winners.forEach((winner, index) => {
                            const voterCount = winner.voters?.length || 0;
                            const votersText = getPluralForm(voterCount, 'человек', 'человека', 'человек');
                            message += `${index + 1}. *${winner.menuItemName}* — ${voterCount} ${votersText}\n`;
                            if (winner.voters && winner.voters.length > 0) {
                                const displayVoters = winner.voters.slice(0, 3);
                                const voterNames = displayVoters.map(v => v.firstName).join(', ');
                                message += `   👤 ${voterNames}`;
                                if (winner.voters.length > 3) {
                                    message += ` и ещё ${winner.voters.length - 3}`;
                                }
                                message += `\n`;
                            }
                            message += `\n`;
                        });
                    }
                    if (data.bringOwn && data.bringOwn.count > 0) {
                        const bringOwnText = getPluralForm(data.bringOwn.count, 'человек', 'человека', 'человек');
                        message += `🥪 *Принесу своё:* ${data.bringOwn.count} ${bringOwnText}\n`;
                        if (data.bringOwn.voters && data.bringOwn.voters.length > 0) {
                            const names = data.bringOwn.voters.slice(0, 3).map(v => v.firstName).join(', ');
                            message += `   👤 ${names}`;
                            if (data.bringOwn.voters.length > 3) {
                                message += ` и ещё ${data.bringOwn.voters.length - 3}`;
                            }
                            message += `\n`;
                        }
                        message += `\n`;
                    }
                    if (data.skipped && data.skipped.count > 0) {
                        const skippedText = getPluralForm(data.skipped.count, 'человек', 'человека', 'человек');
                        message += `⏭️ *Пропустили:* ${data.skipped.count} ${skippedText}\n\n`;
                    }
                    message += `✅ Заказ оформлен!`;
                }
                else {
                    if (data.winnerItem) {
                        message += `🏆 *Победитель:* ${data.winnerItem.name}\n`;
                        if (data.winnerItem.price) {
                            message += `💰 Цена: ${data.winnerItem.price} руб.\n`;
                        }
                    }
                    if (data.topItems && data.topItems.length > 0) {
                        message += `\n📊 *Топ блюд:*\n`;
                        data.topItems.slice(0, 3).forEach((item, index) => {
                            const emoji = ['🥇', '🥈', '🥉'][index] || '•';
                            message += `${emoji} ${item.item.name} - ${item.votes} ${getPluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\n`;
                        });
                    }
                    message += `\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
                }
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
        templates.set(notification_types_1.NotificationType.POLL_CANCELLED, {
            type: notification_types_1.NotificationType.POLL_CANCELLED,
            getTitle: (data) => '❌ Голосование отменено',
            getMessage: (data) => {
                let message = `❌ Голосование отменено администратором ${data.cancelledBy.firstName}\n\n`;
                if (data.reason) {
                    message += `📝 Причина: ${data.reason}\n\n`;
                }
                message += `👥 Проголосовало: ${data.totalVotes} чел.\n`;
                if (data.voters.length > 0) {
                    message += `\n✅ Участники:\n`;
                    data.voters.slice(0, 10).forEach(v => {
                        message += `• ${v.firstName}${v.lastName ? ' ' + v.lastName : ''}\n`;
                    });
                    if (data.voters.length > 10) {
                        message += `... и еще ${data.voters.length - 10}\n`;
                    }
                }
                return message;
            },
            parseMode: 'Markdown',
            priority: notification_types_1.NotificationPriority.NORMAL,
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
    async notifyResponsible(pollId, responsibleUserId) {
        try {
            const poll = await client_1.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    result: {
                        include: {
                            winnerMenuItem: true,
                            responsibleUser: true,
                        },
                    },
                    group: true,
                },
            });
            if (!poll || !poll.result) {
                throw new Error('Poll or poll result not found');
            }
            const votes = await client_1.prisma.vote.findMany({
                where: { pollId },
                include: {
                    user: true,
                },
            });
            const voters = votes.map(vote => ({
                id: vote.user.id,
                firstName: vote.user.firstName,
                username: vote.user.username,
            }));
            const notificationData = {
                winner: poll.result.responsibleUser,
                poll: poll,
                winnerItem: poll.result.winnerMenuItem || undefined,
                voters: votes.map(v => v.user),
                totalVotes: poll.result.totalVotes,
            };
            return await this.sendRouletteWinnerNotification(notificationData);
        }
        catch (error) {
            logger_1.logger.error('Failed to notify responsible user', { pollId, responsibleUserId, error });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                sentAt: new Date(),
            };
        }
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
    async sendPollCompletionNotifications(pollId) {
        try {
            const poll = await client_1.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    result: { include: { winnerMenuItem: true } },
                    votes: { include: { user: true, menuItem: true } },
                    group: true,
                }
            });
            if (!poll || !poll.result) {
                throw new Error('Poll or result not found');
            }
            let resultData = null;
            let mode = 'single-winner';
            if (poll.result.rouletteData) {
                try {
                    resultData = JSON.parse(poll.result.rouletteData);
                    if (resultData?.mode === 'multi-winner') {
                        mode = 'multi-winner';
                    }
                }
                catch (e) {
                    logger_1.logger.warn('Failed to parse rouletteData, using single-winner mode');
                }
            }
            let data;
            if (mode === 'multi-winner' && resultData) {
                data = {
                    pollId,
                    mode: 'multi-winner',
                    totalVotes: poll.result.totalVotes,
                    groupTitle: poll.group.title,
                    winners: resultData.winners,
                    bringOwn: resultData.bringOwn,
                    skipped: resultData.skipped,
                    tieBreak: resultData.meta?.tieBreak,
                };
            }
            else {
                const votesByItem = new Map();
                poll.votes.forEach(vote => {
                    if (vote.menuItemId) {
                        votesByItem.set(vote.menuItemId, (votesByItem.get(vote.menuItemId) || 0) + 1);
                    }
                });
                const topItems = Array.from(votesByItem.entries())
                    .map(([itemId, votes]) => {
                    const item = poll.votes.find(v => v.menuItemId === itemId)?.menuItem;
                    return item ? {
                        item: {
                            id: item.id,
                            name: item.name,
                            description: item.description || undefined,
                            price: item.price || undefined,
                        },
                        votes,
                        percentage: Math.round((votes / poll.votes.length) * 100)
                    } : null;
                })
                    .filter(Boolean)
                    .sort((a, b) => b.votes - a.votes);
                data = {
                    pollId,
                    mode: 'single-winner',
                    totalVotes: poll.result.totalVotes,
                    groupTitle: poll.group.title,
                    winnerItem: poll.result.winnerMenuItem ? {
                        id: poll.result.winnerMenuItem.id,
                        name: poll.result.winnerMenuItem.name,
                        description: poll.result.winnerMenuItem.description || undefined,
                        price: poll.result.winnerMenuItem.price || undefined,
                    } : undefined,
                    topItems: topItems,
                };
            }
            const voterIds = Array.from(new Set(poll.votes.map(v => v.userId)));
            const results = await this.sendPollEndedNotification(voterIds, data);
            if (poll.chatId && this.bot) {
                try {
                    const template = this.templates.get(notification_types_1.NotificationType.POLL_ENDED);
                    if (template) {
                        await this.bot.api.sendMessage(Number(poll.chatId), template.getMessage(data), { parse_mode: template.parseMode });
                        logger_1.logger.info(`Completion notification sent to group ${poll.chatId}`);
                    }
                }
                catch (error) {
                    logger_1.logger.error('Error sending completion notification to group:', error);
                }
            }
            return results;
        }
        catch (error) {
            logger_1.logger.error('Failed to send poll completion notifications', { pollId, error });
            throw error;
        }
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
    async sendPollCancelledNotifications(pollId, cancelledBy, reason) {
        try {
            const poll = await client_1.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    group: true,
                    votes: {
                        include: { user: true },
                        distinct: ['userId']
                    }
                }
            });
            if (!poll) {
                logger_1.logger.warn(`Poll not found for cancelled notifications: ${pollId}`);
                return;
            }
            const voters = poll.votes.map(v => v.user);
            const template = this.templates.get(notification_types_1.NotificationType.POLL_CANCELLED);
            if (!template || !this.bot) {
                logger_1.logger.warn('Template or bot not available for cancelled notifications');
                return;
            }
            const data = {
                poll,
                cancelledBy,
                reason,
                totalVotes: voters.length,
                voters
            };
            if (poll.chatId) {
                try {
                    await this.bot.api.sendMessage(poll.chatId, template.getMessage(data), { parse_mode: template.parseMode });
                    logger_1.logger.info(`Cancelled notification sent to group ${poll.chatId}`);
                }
                catch (error) {
                    logger_1.logger.error('Error sending cancelled notification to group:', error);
                }
            }
            for (const voter of voters) {
                try {
                    await this.send({
                        userId: Number(voter.telegramId),
                        type: notification_types_1.NotificationType.POLL_CANCELLED,
                        message: template.getMessage(data),
                        parseMode: template.parseMode,
                        priority: notification_types_1.NotificationPriority.NORMAL
                    });
                }
                catch (error) {
                    logger_1.logger.error(`Error sending notification to user ${voter.id}:`, error);
                }
            }
            logger_1.logger.info(`Poll cancelled notifications sent: ${pollId}, voters: ${voters.length}`);
        }
        catch (error) {
            logger_1.logger.error('Error sending poll cancelled notifications:', error);
        }
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
