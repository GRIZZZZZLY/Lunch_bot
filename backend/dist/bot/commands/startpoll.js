"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPollCommand = startPollCommand;
const poll_service_1 = require("../../services/poll.service");
const menu_service_1 = require("../../services/menu.service");
const group_service_1 = require("../../services/group.service");
const user_service_1 = require("../../services/user.service");
const poll_reminder_service_1 = require("../../services/poll-reminder.service");
const client_1 = require("../../database/client");
const logger_1 = require("../../utils/logger");
const poll_keyboard_1 = require("../keyboards/poll.keyboard");
const pollUpdateIntervals = new Map();
async function updatePollMessage(ctx, pollId, messageId, chatId, itemCount) {
    try {
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll || poll.status !== 'ACTIVE') {
            const interval = pollUpdateIntervals.get(pollId);
            if (interval) {
                clearInterval(interval);
                pollUpdateIntervals.delete(pollId);
            }
            return;
        }
        const currentVotes = poll.votes.length;
        const updatedMessage = (0, poll_keyboard_1.createCompactPollMessage)(poll, itemCount, currentVotes);
        const keyboard = (0, poll_keyboard_1.createCompactPollKeyboard)(pollId);
        await ctx.api.editMessageText(chatId, messageId, updatedMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
        logger_1.logger.info(`Poll message updated: ${pollId}, votes: ${currentVotes}`);
    }
    catch (error) {
        if (error?.description?.includes('message is not modified')) {
            return;
        }
        logger_1.logger.error('Error updating poll message:', error);
    }
}
async function startPollCommand(ctx) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('Не удалось определить пользователя');
            return;
        }
        const chat = ctx.chat;
        if (!chat || chat.type === 'private') {
            await ctx.reply('Эта команда доступна только в группах');
            return;
        }
        let group = await group_service_1.GroupService.getGroupByTelegramId(chat.id.toString());
        if (!group) {
            group = await group_service_1.GroupService.upsertGroup({
                telegramId: chat.id.toString(),
                title: chat.title || 'Unknown',
                type: chat.type,
            });
        }
        const existingPoll = await poll_service_1.PollService.getActivePollInGroup(group.id);
        if (existingPoll) {
            await ctx.reply('В этой группе уже есть активное голосование!');
            return;
        }
        const durationMinutes = ctx.match ? parseInt(ctx.match.toString()) : 30;
        if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
            await ctx.reply('Неверная длительность. Укажите число от 1 до 1440 минут.');
            return;
        }
        const activeItems = await menu_service_1.MenuService.getActiveMenuItems();
        if (activeItems.length === 0) {
            await ctx.reply('Меню пусто! Сначала добавьте блюда через Mini App.');
            return;
        }
        const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            await ctx.reply('Пользователь не найден в системе');
            return;
        }
        const poll = await poll_service_1.PollService.createPoll({
            groupId: group.id,
            duration: durationMinutes,
            createdBy: dbUser.id,
        });
        const keyboard = (0, poll_keyboard_1.createCompactPollKeyboard)(poll.id);
        const pollMessage = (0, poll_keyboard_1.createCompactPollMessage)(poll, activeItems.length, 0);
        const sentMessage = await ctx.reply(pollMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
        await poll_service_1.PollService.updatePoll(poll.id, {
            messageId: sentMessage.message_id,
            chatId: BigInt(chat.id)
        });
        logger_1.logger.info('Poll started via bot command', {
            pollId: poll.id,
            groupId: group.id,
            startedBy: dbUser.id,
            durationMinutes,
        });
        const updateInterval = setInterval(() => {
            updatePollMessage(ctx, poll.id, sentMessage.message_id, chat.id, activeItems.length);
        }, 60 * 1000);
        pollUpdateIntervals.set(poll.id, updateInterval);
        poll_reminder_service_1.PollReminderService.scheduleReminders(poll.id, durationMinutes, BigInt(chat.id));
        setTimeout(async () => {
            try {
                const currentPoll = await poll_service_1.PollService.getPollById(poll.id);
                if (currentPoll?.status === 'ACTIVE') {
                    await autoCompletePoll(ctx, poll.id, sentMessage.message_id);
                }
            }
            catch (error) {
                logger_1.logger.error('Error in poll auto-completion timeout:', error);
            }
        }, durationMinutes * 60 * 1000);
        await ctx.reply(`✅ Голосование запущено на ${durationMinutes} минут!\n` +
            `Голосуйте, нажимая на кнопки выше.`);
    }
    catch (error) {
        logger_1.logger.error('Error in startPollCommand:', error);
        await ctx.reply('Произошла ошибка при создании голосования');
    }
}
async function autoCompletePoll(ctx, pollId, messageId) {
    try {
        const updateInterval = pollUpdateIntervals.get(pollId);
        if (updateInterval) {
            clearInterval(updateInterval);
            pollUpdateIntervals.delete(pollId);
        }
        poll_reminder_service_1.PollReminderService.cancelReminders(pollId);
        const result = await poll_service_1.PollService.completePoll(pollId);
        await ctx.api.editMessageReplyMarkup(ctx.chat.id, messageId, {
            reply_markup: undefined
        });
        await ctx.reply('⏰ Время голосования истекло!');
        if (result.totalVotes > 0) {
            await autoRunRoulette(ctx, pollId);
        }
    }
    catch (error) {
        logger_1.logger.error('Error in autoCompletePoll:', error);
    }
}
async function autoRunRoulette(ctx, pollId) {
    try {
        const result = await poll_service_1.PollService.runRoulette(pollId);
        if (result.responsibleUserId) {
            const responsibleUser = await user_service_1.UserService.getUserById(result.responsibleUserId);
            if (!responsibleUser)
                return;
            const winnerMention = `[${responsibleUser.firstName}](tg://user?id=${responsibleUser.telegramId})`;
            let winnerItem = 'выбранное блюдо';
            if (result.winnerMenuItemId) {
                const menuItem = await client_1.prisma.menuItem.findUnique({
                    where: { id: result.winnerMenuItemId }
                });
                winnerItem = menuItem?.name || winnerItem;
            }
            await ctx.reply(`🎲 **Рулетка завершена!**\n\n` +
                `🎯 **Ответственный за заказ:** ${winnerMention}\n` +
                `🍽️ **Блюдо-победитель:** ${winnerItem}\n\n` +
                `📞 ${responsibleUser.firstName}, ожидаем вашего заказа! 😊`, { parse_mode: 'Markdown' });
        }
    }
    catch (error) {
        logger_1.logger.error('Error in auto-run roulette:', error);
    }
}
