"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializePollServiceBot = initializePollServiceBot;
exports.createPollFromWebApp = createPollFromWebApp;
const poll_service_1 = require("./poll.service");
const group_service_1 = require("./group.service");
const vote_service_1 = require("./vote.service");
const logger_1 = require("../utils/logger");
const webapp_keyboard_1 = require("../bot/keyboards/webapp.keyboard");
function createPollNotificationMessage(data) {
    const { title, duration, menuItemsCount, endTime } = data;
    let message = `🗳️ **${title}**\n\n`;
    message += `⏰ **Время голосования:** ${duration} мин\n`;
    message += `🍽️ **Доступно блюд:** ${menuItemsCount}\n`;
    message += `⏱️ **Завершится:** ${endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\n`;
    message += `👉 Откройте Mini App для голосования!\n`;
    message += `Нажмите кнопку "🗳️ Проголосовать" ниже`;
    return message;
}
let botInstance = null;
function initializePollServiceBot(bot) {
    botInstance = bot;
    logger_1.logger.info('PollService bot instance initialized');
}
async function createPollFromWebApp(params) {
    try {
        logger_1.logger.info('🎬 Starting createPollFromWebApp', { groupId: params.groupId, menuItemsCount: params.menuItems.length });
        if (!botInstance) {
            logger_1.logger.error('❌ Bot not initialized in PollService');
            throw new Error('Bot not initialized in PollService');
        }
        logger_1.logger.info('✅ Bot instance confirmed');
        const { groupId, duration, createdBy, title, menuItems, selectedMenuItemIds } = params;
        logger_1.logger.info('🔍 Fetching group data', { groupId });
        const group = await group_service_1.GroupService.getGroupById(groupId);
        if (!group) {
            logger_1.logger.error('❌ Group not found', { groupId });
            throw new Error('Group not found');
        }
        logger_1.logger.info('✅ Group found', { telegramId: group.telegramId.toString(), title: group.title });
        logger_1.logger.info('💾 Creating poll in database', { selectedMenuItemIds });
        const poll = await poll_service_1.PollService.createPoll({
            groupId,
            duration,
            createdBy,
        });
        logger_1.logger.info('✅ Poll created in DB', { pollId: poll.id });
        if (selectedMenuItemIds && selectedMenuItemIds.length > 0) {
            await poll_service_1.PollService.updatePoll(poll.id, {
                selectedMenuItemIds: JSON.stringify(selectedMenuItemIds),
            });
            logger_1.logger.info('✅ Selected menu items saved', { pollId: poll.id, count: selectedMenuItemIds.length });
        }
        try {
            const realCount = await group_service_1.GroupService.getRealMemberCount(group.telegramId.toString(), botInstance);
            if (realCount && realCount > 0) {
                const currentSettings = await group_service_1.GroupService.getGroupSettings(poll.groupId);
                await group_service_1.GroupService.updateGroupSettings(poll.groupId, {
                    ...currentSettings,
                    expectedParticipants: realCount
                });
                logger_1.logger.info(`✅ Set expectedParticipants for new poll ${poll.id}: ${realCount} members`);
            }
            else {
                logger_1.logger.warn(`⚠️ Could not get real member count for group ${group.id}, using fallback`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating expectedParticipants on poll creation:', error);
        }
        const endTime = new Date(Date.now() + duration * 60 * 1000);
        const message = createPollNotificationMessage({
            title: title || 'Голосование за обед',
            duration,
            menuItemsCount: menuItems.length,
            endTime,
        });
        logger_1.logger.info('⌨️ Creating keyboard');
        const keyboard = (0, webapp_keyboard_1.createVoteWebAppKeyboard)(poll.id);
        logger_1.logger.info('✅ Keyboard created', { keyboard });
        const chatId = typeof group.telegramId === 'bigint'
            ? Number(group.telegramId)
            : group.telegramId;
        logger_1.logger.info('📤 Sending message to group', { chatId, messageLength: message.length });
        const sentMessage = await botInstance.api.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
        logger_1.logger.info('✅ Poll message sent to group', {
            pollId: poll.id,
            groupId: group.telegramId.toString(),
            messageId: sentMessage.message_id,
        });
        await poll_service_1.PollService.updatePoll(poll.id, {
            chatId: BigInt(chatId),
            messageId: sentMessage.message_id,
        });
        logger_1.logger.info('✅ Poll updated with chatId and messageId');
        setTimeout(async () => {
            try {
                const currentPoll = await poll_service_1.PollService.getPollById(poll.id);
                if (currentPoll?.status === 'ACTIVE') {
                    await autoCompletePoll(poll.id, parseInt(group.telegramId.toString()), sentMessage.message_id);
                }
            }
            catch (error) {
                logger_1.logger.error('Error in poll auto-completion timeout:', error);
            }
        }, duration * 60 * 1000);
        logger_1.logger.info('🎉 Poll created successfully!', { pollId: poll.id, messageId: sentMessage.message_id });
        return {
            pollId: poll.id,
            messageId: sentMessage.message_id,
        };
    }
    catch (error) {
        logger_1.logger.error('❌ Error creating poll from WebApp:', error);
        throw error;
    }
}
async function autoCompletePoll(pollId, chatId, messageId) {
    try {
        if (!botInstance) {
            logger_1.logger.error('Bot not initialized for auto-complete');
            return;
        }
        logger_1.logger.info(`Auto-completing poll ${pollId}`);
        const result = await poll_service_1.PollService.completePoll(pollId);
        const breakdown = await poll_service_1.PollService.getPollVoteBreakdown(pollId);
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        try {
            await botInstance.api.editMessageReplyMarkup(chatId, messageId, {
                reply_markup: undefined,
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not remove poll button:', error);
        }
        const resultsMessage = createPollResultsMessage({
            totalVotes: result.totalVotes,
            breakdown,
            winnerItem: breakdown.length > 0 ? breakdown[0] : null,
        });
        const resultsKeyboard = (0, webapp_keyboard_1.createResultsWebAppKeyboard)(pollId);
        await botInstance.api.sendMessage(chatId, resultsMessage, {
            parse_mode: 'Markdown',
            reply_markup: resultsKeyboard
        });
        let responsibleUser = null;
        if (result.totalVotes > 0) {
            if (process.env.AUTO_ROULETTE_ENABLED === 'true') {
                const rouletteResult = await poll_service_1.PollService.runRoulette(pollId);
                responsibleUser = rouletteResult.responsibleUser;
                if (responsibleUser) {
                    await botInstance.api.sendMessage(chatId, `🎲 **Рулетка завершена!**\n\n` +
                        `🎯 Ответственный за заказ: [${responsibleUser.firstName}](tg://user?id=${responsibleUser.telegramId})\n\n` +
                        `📞 Ожидаем заказа!`, { parse_mode: 'Markdown' });
                    try {
                        const responsibleKeyboard = (0, webapp_keyboard_1.createResponsibleKeyboard)(pollId);
                        await botInstance.api.sendMessage(Number(responsibleUser.telegramId), `🎯 **Вы выбраны ответственным за заказ!**\n\n` +
                            `📋 Откройте детали заказа в Mini App\n` +
                            `Там вы найдете:\n` +
                            `• Список заказов всех участников\n` +
                            `• Контакты для связи\n` +
                            `• Общую стоимость\n\n` +
                            `💳 Не забудьте указать платёжные данные в профиле!`, {
                            parse_mode: 'Markdown',
                            reply_markup: responsibleKeyboard
                        });
                    }
                    catch (error) {
                        logger_1.logger.warn(`Could not send details to responsible user:`, error.message);
                    }
                }
            }
            await sendPersonalNotifications(pollId, breakdown, responsibleUser);
        }
        logger_1.logger.info(`Poll ${pollId} completed successfully`);
    }
    catch (error) {
        logger_1.logger.error('Error in autoCompletePoll:', error);
    }
}
function createPollResultsMessage(data) {
    const { totalVotes, breakdown, winnerItem } = data;
    let message = `📊 **Голосование завершено!**\n\n`;
    message += `👥 Проголосовало: ${totalVotes}\n\n`;
    if (breakdown.length === 0) {
        message += `😔 Никто не проголосовал`;
        return message;
    }
    if (winnerItem) {
        message += `🏆 **Победитель:** ${winnerItem.menuItemName}\n`;
        message += `   ${winnerItem.votes} голосов (${winnerItem.percentage}%)\n\n`;
    }
    message += `📋 **Топ блюд:**\n\n`;
    breakdown.slice(0, 5).forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${item.menuItemName} — ${item.votes} ${getVotesWord(item.votes)} (${item.percentage}%)\n`;
    });
    return message;
}
function getVotesWord(count) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return 'голосов';
    }
    if (lastDigit === 1) {
        return 'голос';
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return 'голоса';
    }
    return 'голосов';
}
async function sendPersonalNotifications(pollId, breakdown, responsibleUser) {
    try {
        if (!botInstance) {
            logger_1.logger.error('Bot not initialized for notifications');
            return;
        }
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        if (votes.length === 0) {
            return;
        }
        const winnerItem = breakdown.length > 0 ? breakdown[0] : null;
        logger_1.logger.info(`Sending personal notifications to ${votes.length} participants`);
        let successCount = 0;
        let failCount = 0;
        await Promise.all(votes.map(async (vote) => {
            try {
                const userVote = breakdown.find((b) => b.menuItemId === vote.menuItemId);
                let message = `🎉 **Голосование завершено!**\n\n`;
                message += `📊 **Результаты:**\n`;
                if (winnerItem) {
                    message += `🏆 Победитель: **${winnerItem.menuItemName}** (${winnerItem.votes} ${getVotesWord(winnerItem.votes)})\n\n`;
                }
                message += `👤 **Ваш выбор:** ${userVote?.menuItemName || 'Не указан'}\n\n`;
                if (responsibleUser) {
                    message += `💰 **Информация для оплаты:**\n`;
                    message += `👤 Ответственный: ${responsibleUser.firstName}`;
                    if (responsibleUser.username) {
                        message += ` (@${responsibleUser.username})`;
                    }
                    message += `\n`;
                    if (responsibleUser.paymentCard) {
                        message += `💳 Карта: \`${responsibleUser.paymentCard}\`\n`;
                    }
                    if (responsibleUser.paymentPhone) {
                        message += `📱 Телефон: ${responsibleUser.paymentPhone}\n`;
                    }
                    if (responsibleUser.paymentDetails) {
                        message += `📝 Детали: ${responsibleUser.paymentDetails}\n`;
                    }
                    if (!responsibleUser.paymentCard && !responsibleUser.paymentPhone) {
                        message += `\n⚠️ Ответственный ещё не указал платёжные данные.\n`;
                        message += `📍 Свяжитесь с ним напрямую для уточнения деталей оплаты.`;
                    }
                }
                await botInstance.api.sendMessage(Number(vote.user.telegramId), message, { parse_mode: 'Markdown' });
                successCount++;
            }
            catch (error) {
                failCount++;
                logger_1.logger.warn(`Could not send notification to user ${vote.user.id}:`, error.message);
            }
        }));
        logger_1.logger.info(`Personal notifications sent: ${successCount} success, ${failCount} failed`);
    }
    catch (error) {
        logger_1.logger.error('Error sending personal notifications:', error);
    }
}
