"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollReminderService = void 0;
const logger_1 = require("../utils/logger");
const poll_service_1 = require("./poll.service");
class PollReminderService {
    static reminders = new Map();
    static botInstance = null;
    static initialize(bot) {
        this.botInstance = bot;
        logger_1.logger.info('PollReminderService initialized');
    }
    static scheduleReminders(pollId, durationMinutes, chatId) {
        logger_1.logger.info(`[UX] Reminder notifications DISABLED for poll ${pollId} (using live updates instead)`);
        this.reminders.set(pollId, { pollId, timers: {} });
    }
    static async sendReminderNotification(pollId, chatId, minutesRemaining) {
        try {
            const poll = await poll_service_1.PollService.getPollById(pollId);
            if (!poll || poll.status !== 'ACTIVE') {
                logger_1.logger.warn(`Poll ${pollId} is not active, skipping reminder`);
                return;
            }
            const totalUsers = poll.votes?.length || 0;
            const uniqueVoters = new Set(poll.votes?.map(v => v.userId) || []).size;
            const message = `⏰ **Осталось ${minutesRemaining} минут!**\n\n` +
                `🗳️ Голосование скоро завершится\n` +
                `👥 Уже проголосовало: ${uniqueVoters}\n\n` +
                `💡 Не забудьте проголосовать, если еще не сделали этого!`;
            await this.botInstance.api.sendMessage(Number(chatId), message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📱 Проголосовать', callback_data: `openpoll:${pollId}` }],
                        [{ text: '📊 Результаты', callback_data: `show_results:${pollId}` }]
                    ]
                }
            });
            logger_1.logger.info(`Sent ${minutesRemaining}-minute reminder for poll ${pollId}`);
            await this.sendPersonalReminders(pollId, minutesRemaining);
        }
        catch (error) {
            logger_1.logger.error(`Error sending reminder notification for poll ${pollId}:`, error);
        }
    }
    static async sendFinalCallNotification(pollId, chatId) {
        try {
            const poll = await poll_service_1.PollService.getPollById(pollId);
            if (!poll || poll.status !== 'ACTIVE') {
                return;
            }
            const uniqueVoters = new Set(poll.votes?.map(v => v.userId) || []).size;
            const message = `🚨 **Последний шанс!**\n\n` +
                `⏰ Голосование завершается через 30 секунд\n` +
                `👥 Проголосовало: ${uniqueVoters}\n\n` +
                `⚡ Успейте проголосовать прямо сейчас!`;
            await this.botInstance.api.sendMessage(Number(chatId), message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⚡ Проголосовать СЕЙЧАС', callback_data: `openpoll:${pollId}` }]
                    ]
                }
            });
            logger_1.logger.info(`Sent final call notification for poll ${pollId}`);
        }
        catch (error) {
            logger_1.logger.error(`Error sending final call notification for poll ${pollId}:`, error);
        }
    }
    static async sendPersonalReminders(pollId, minutesRemaining) {
        try {
            const poll = await poll_service_1.PollService.getPollById(pollId);
            if (!poll || !poll.group)
                return;
            const groupMembers = [];
            const votedUserIds = new Set(poll.votes?.map(v => v.userId) || []);
            const notVotedUsers = groupMembers.filter((user) => !votedUserIds.has(user.id));
            const usersToNotify = notVotedUsers.slice(0, 50);
            for (const user of usersToNotify) {
                try {
                    await this.botInstance.api.sendMessage(Number(user.telegramId), `👋 **Привет, ${user.firstName}!**\n\n` +
                        `⏰ Осталось ${minutesRemaining} минут до окончания голосования\n` +
                        `🗳️ Не забудьте проголосовать!\n\n` +
                        `💡 Нажмите кнопку ниже, чтобы быстро проголосовать`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📱 Проголосовать', callback_data: `openpoll:${pollId}` }]
                            ]
                        }
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                catch (userError) {
                    if (!userError.description?.includes('blocked')) {
                        logger_1.logger.warn(`Failed to send personal reminder to user ${user.id}:`, userError.description);
                    }
                }
            }
            logger_1.logger.info(`Sent personal reminders to ${usersToNotify.length} users for poll ${pollId}`);
        }
        catch (error) {
            logger_1.logger.error(`Error sending personal reminders for poll ${pollId}:`, error);
        }
    }
    static cancelReminders(pollId) {
        const reminder = this.reminders.get(pollId);
        if (reminder) {
            if (reminder.timers.tenMinutes)
                clearTimeout(reminder.timers.tenMinutes);
            if (reminder.timers.twoMinutes)
                clearTimeout(reminder.timers.twoMinutes);
            if (reminder.timers.finalCall)
                clearTimeout(reminder.timers.finalCall);
            this.reminders.delete(pollId);
            logger_1.logger.info(`Cancelled reminders for poll ${pollId}`);
        }
    }
    static cancelAllReminders() {
        for (const [pollId] of this.reminders) {
            this.cancelReminders(pollId);
        }
        logger_1.logger.info('Cancelled all reminders');
    }
    static getActiveReminders() {
        return Array.from(this.reminders.keys());
    }
}
exports.PollReminderService = PollReminderService;
//# sourceMappingURL=poll-reminder.service.js.map