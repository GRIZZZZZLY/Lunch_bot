"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVote = handleVote;
exports.handleCompletePoll = handleCompletePoll;
exports.handleRefreshPoll = handleRefreshPoll;
exports.handleShowResults = handleShowResults;
exports.handleRunRoulette = handleRunRoulette;
exports.handleCancelPoll = handleCancelPoll;
exports.handleShowResultsWithoutComplete = handleShowResultsWithoutComplete;
exports.handlePollCallback = handlePollCallback;
exports.handleStartPoll = handleStartPoll;
const poll_service_1 = require("../../services/poll.service");
const vote_service_1 = require("../../services/vote.service");
const menu_service_1 = require("../../services/menu.service");
const user_service_1 = require("../../services/user.service");
const roulette_service_1 = require("../../services/roulette.service");
const notification_service_1 = require("../../services/notification.service");
const logger_1 = require("../../utils/logger");
const poll_keyboard_1 = require("../keyboards/poll.keyboard");
async function handleVote(ctx, pollId, menuItemId) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
            return;
        }
        let dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            dbUser = await user_service_1.UserService.createUser({
                telegramId: user.id.toString(),
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
            });
        }
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll) {
            await ctx.answerCallbackQuery('❌ Голосование не найдено');
            return;
        }
        if (poll.status !== 'ACTIVE') {
            await ctx.answerCallbackQuery('⚠️ Голосование уже завершено');
            return;
        }
        const menuItem = await menu_service_1.MenuService.getMenuItemById(menuItemId);
        if (!menuItem || !menuItem.isActive) {
            await ctx.answerCallbackQuery('❌ Блюдо недоступно');
            return;
        }
        const existingVote = await vote_service_1.VoteService.getUserVoteInPoll(pollId, dbUser.id);
        if (existingVote) {
            if (existingVote.menuItemId === menuItemId) {
                await ctx.answerCallbackQuery(`✅ Вы уже проголосовали за "${menuItem.name}"`);
                return;
            }
            await vote_service_1.VoteService.updateVote(existingVote.id, menuItemId);
            await ctx.answerCallbackQuery(`🔄 Голос изменен на "${menuItem.name}"`);
            logger_1.logger.info(`Vote updated: user ${dbUser.id} changed to item ${menuItemId} in poll ${pollId}`);
        }
        else {
            await vote_service_1.VoteService.createVote({
                pollId,
                userId: dbUser.id,
                menuItemId,
            });
            await ctx.answerCallbackQuery(`✅ Вы проголосовали за "${menuItem.name}"`);
            logger_1.logger.info(`Vote created: user ${dbUser.id} voted for item ${menuItemId} in poll ${pollId}`);
        }
        await updatePollMessage(ctx, pollId);
    }
    catch (error) {
        logger_1.logger.error('Error in handleVote:', error);
        await ctx.answerCallbackQuery('❌ Ошибка при голосовании');
    }
}
async function updatePollMessage(ctx, pollId) {
    try {
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll)
            return;
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        const menuItems = await menu_service_1.MenuService.getActiveMenuItems();
        const votesByItem = new Map();
        votes.forEach(vote => {
            const itemVotes = votesByItem.get(vote.menuItemId) || [];
            itemVotes.push(vote);
            votesByItem.set(vote.menuItemId, itemVotes);
        });
        const message = (0, poll_keyboard_1.createPollMessage)({
            poll,
            menuItems,
            votes: votesByItem,
            totalVotes: votes.length,
        });
        const keyboard = (0, poll_keyboard_1.createPollKeyboard)(pollId, menuItems, votesByItem);
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating poll message:', error);
    }
}
async function handleCompletePoll(ctx, pollId) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
            return;
        }
        const isAdmin = await user_service_1.UserService.isAdmin(BigInt(user.id));
        const chat = ctx.chat;
        if (!isAdmin && chat) {
            const member = await ctx.api.getChatMember(chat.id, user.id);
            const isChatAdmin = ['creator', 'administrator'].includes(member.status);
            if (!isChatAdmin) {
                await ctx.answerCallbackQuery('❌ Только администраторы могут завершать голосование');
                return;
            }
        }
        const result = await poll_service_1.PollService.completePoll(pollId);
        await ctx.answerCallbackQuery('✅ Голосование завершено');
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        const breakdown = await vote_service_1.VoteService.getVoteBreakdown(pollId);
        const resultsMessage = (0, poll_keyboard_1.createResultsMessage)({
            poll: result,
            result,
            breakdown,
            totalVotes: votes.length,
        });
        const keyboard = (0, poll_keyboard_1.createCompletedPollKeyboard)(pollId, votes.length > 0, false);
        await ctx.editMessageText(resultsMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
        logger_1.logger.info(`Poll completed: ${pollId} by user ${user.id}`);
        if (process.env.AUTO_ROULETTE_ENABLED === 'true' && votes.length > 0) {
            setTimeout(() => handleRunRoulette(ctx, pollId), 2000);
        }
    }
    catch (error) {
        logger_1.logger.error('Error in handleCompletePoll:', error);
        await ctx.answerCallbackQuery('❌ Ошибка при завершении голосования');
    }
}
async function handleRefreshPoll(ctx, pollId) {
    try {
        await ctx.answerCallbackQuery('🔄 Обновление...');
        await updatePollMessage(ctx, pollId);
        logger_1.logger.info(`Poll refreshed: ${pollId}`);
    }
    catch (error) {
        logger_1.logger.error('Error in handleRefreshPoll:', error);
        await ctx.answerCallbackQuery('❌ Ошибка при обновлении');
    }
}
async function handleShowResults(ctx, pollId) {
    try {
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll) {
            await ctx.answerCallbackQuery('❌ Голосование не найдено');
            return;
        }
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        const breakdown = await vote_service_1.VoteService.getVoteBreakdown(pollId);
        const result = await poll_service_1.PollService.getPollResult(pollId);
        const resultsMessage = (0, poll_keyboard_1.createResultsMessage)({
            poll,
            result,
            breakdown,
            totalVotes: votes.length,
        });
        const keyboard = (0, poll_keyboard_1.createCompletedPollKeyboard)(pollId, votes.length > 0, !!result?.responsibleUserId);
        await ctx.editMessageText(resultsMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
        await ctx.answerCallbackQuery('📊 Результаты обновлены');
        logger_1.logger.info(`Results shown for poll: ${pollId}`);
    }
    catch (error) {
        logger_1.logger.error('Error in handleShowResults:', error);
        await ctx.answerCallbackQuery('❌ Ошибка при получении результатов');
    }
}
async function handleRunRoulette(ctx, pollId) {
    try {
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll) {
            if ('answerCallbackQuery' in ctx) {
                await ctx.answerCallbackQuery('❌ Голосование не найдено');
            }
            return;
        }
        if (poll.status === 'ACTIVE') {
            if ('answerCallbackQuery' in ctx) {
                await ctx.answerCallbackQuery('⚠️ Сначала завершите голосование');
            }
            return;
        }
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        if (votes.length === 0) {
            if ('answerCallbackQuery' in ctx) {
                await ctx.answerCallbackQuery('❌ Никто не голосовал');
            }
            return;
        }
        const existingResult = await poll_service_1.PollService.getPollResult(pollId);
        if (existingResult?.responsibleUserId) {
            if ('answerCallbackQuery' in ctx) {
                await ctx.answerCallbackQuery('⚠️ Рулетка уже была запущена');
            }
            return;
        }
        if ('answerCallbackQuery' in ctx) {
            await ctx.answerCallbackQuery('🎰 Запускаем рулетку...');
        }
        const rouletteService = new roulette_service_1.RouletteService();
        const result = await rouletteService.runRoulette(pollId);
        await poll_service_1.PollService.savePollResult({
            pollId,
            winnerMenuItemId: result.winnerMenuItemId,
            responsibleUserId: result.responsibleUserId,
            totalVotes: result.totalVotes,
            rouletteData: JSON.stringify(result.animationData),
        });
        await showRouletteAnimation(ctx, result);
        if (process.env.NOTIFICATION_ENABLED === 'true') {
            const notificationService = new notification_service_1.NotificationService();
            await notificationService.notifyResponsible(pollId, result.responsibleUserId);
        }
        logger_1.logger.info(`Roulette completed for poll ${pollId}`, {
            responsibleUserId: result.responsibleUserId,
            winnerItem: result.winnerMenuItemId,
        });
    }
    catch (error) {
        logger_1.logger.error('Error in handleRunRoulette:', error);
        if ('answerCallbackQuery' in ctx) {
            await ctx.answerCallbackQuery('❌ Ошибка при запуске рулетки');
        }
    }
}
async function showRouletteAnimation(ctx, result) {
    try {
        const { animationData, responsibleUserName, winnerMenuItemName } = result;
        let rouletteMessage = await ctx.reply('🎰 **Запуск рулетки...**\n\nВыбираем ответственного за заказ...', {
            parse_mode: 'Markdown',
        });
        for (let i = 0; i < animationData.steps.length; i++) {
            const step = animationData.steps[i];
            await new Promise(resolve => setTimeout(resolve, step.delay));
            try {
                rouletteMessage = await ctx.api.editMessageText(rouletteMessage.chat.id, rouletteMessage.message_id, step.message, { parse_mode: 'Markdown' });
            }
            catch (err) {
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        let finalMessage = `🎉 **Рулетка завершена!**\n\n`;
        finalMessage += `🎯 **Ответственный за заказ:** ${responsibleUserName}\n`;
        if (winnerMenuItemName) {
            finalMessage += `🍽️ **Заказываем:** ${winnerMenuItemName}\n`;
        }
        finalMessage += `\n📞 Ожидаем заказа! 🚀`;
        await ctx.api.editMessageText(rouletteMessage.chat.id, rouletteMessage.message_id, finalMessage, { parse_mode: 'Markdown' });
    }
    catch (error) {
        logger_1.logger.error('Error in showRouletteAnimation:', error);
    }
}
async function handleCancelPoll(ctx, pollId) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
            return;
        }
        const isAdmin = await user_service_1.UserService.isAdmin(BigInt(user.id));
        const chat = ctx.chat;
        if (!isAdmin && chat) {
            const member = await ctx.api.getChatMember(chat.id, user.id);
            const isChatAdmin = ['creator', 'administrator'].includes(member.status);
            if (!isChatAdmin) {
                await ctx.answerCallbackQuery('❌ Только администраторы могут отменять голосование');
                return;
            }
        }
        await poll_service_1.PollService.cancelPoll(pollId);
        await ctx.answerCallbackQuery('🚫 Голосование отменено');
        await ctx.editMessageText('🚫 **Голосование отменено администратором**', { parse_mode: 'Markdown' });
        logger_1.logger.info(`Poll cancelled: ${pollId} by user ${user.id}`);
    }
    catch (error) {
        logger_1.logger.error('Error in handleCancelPoll:', error);
        await ctx.answerCallbackQuery('❌ Ошибка при отмене голосования');
    }
}
async function handleShowResultsWithoutComplete(ctx, pollId) {
    try {
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll) {
            await ctx.answerCallbackQuery('❌ Голосование не найдено');
            return;
        }
        const votes = await vote_service_1.VoteService.getPollVotes(pollId);
        const breakdown = await vote_service_1.VoteService.getVoteBreakdown(pollId);
        let message = `📊 **Промежуточные результаты**\n\n`;
        message += `🎯 "${poll.title || 'Голосование'}"\n`;
        message += `👥 Проголосовало: ${votes.length}\n\n`;
        if (breakdown.length === 0) {
            message += `😔 _Пока никто не проголосовал_`;
        }
        else {
            message += `📋 **Текущие лидеры:**\n\n`;
            breakdown.slice(0, 5).forEach((item, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                message += `${medal} ${item.menuItemName} - ${item.votes} голосов (${item.percentage}%)\n`;
            });
        }
        message += `\n_Голосование продолжается..._`;
        await ctx.reply(message, { parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery('📊 Результаты обновлены');
    }
    catch (error) {
        logger_1.logger.error('Error in handleShowResultsWithoutComplete:', error);
        await ctx.answerCallbackQuery('❌ Ошибка при получении результатов');
    }
}
async function handlePollCallback(ctx) {
    try {
        const callbackData = ctx.callbackQuery.data;
        if (!callbackData)
            return;
        const parts = callbackData.split(':');
        const action = parts[0];
        switch (action) {
            case 'vote':
                if (parts.length === 3) {
                    const pollId = parseInt(parts[1]);
                    const menuItemId = parseInt(parts[2]);
                    await handleVote(ctx, pollId, menuItemId);
                }
                break;
            case 'complete_poll':
                if (parts.length === 2) {
                    const pollId = parseInt(parts[1]);
                    await handleCompletePoll(ctx, pollId);
                }
                break;
            case 'refresh_poll':
                if (parts.length === 2) {
                    const pollId = parseInt(parts[1]);
                    await handleRefreshPoll(ctx, pollId);
                }
                break;
            case 'show_results':
                if (parts.length === 2) {
                    const pollId = parseInt(parts[1]);
                    await handleShowResults(ctx, pollId);
                }
                break;
            case 'run_roulette':
                if (parts.length === 2) {
                    const pollId = parseInt(parts[1]);
                    await handleRunRoulette(ctx, pollId);
                }
                break;
            case 'cancel_poll':
                if (parts.length === 2) {
                    const pollId = parseInt(parts[1]);
                    await handleCancelPoll(ctx, pollId);
                }
                break;
            default:
                logger_1.logger.warn(`Unknown poll callback action: ${action}`);
                await ctx.answerCallbackQuery('❓ Неизвестное действие');
        }
    }
    catch (error) {
        logger_1.logger.error('Error in handlePollCallback:', error);
        if ('answerCallbackQuery' in ctx) {
            await ctx.answerCallbackQuery('❌ Ошибка обработки');
        }
    }
}
async function handleStartPoll(ctx) {
    await ctx.reply('ℹ️ Используйте команду /startpoll для создания голосования');
}
//# sourceMappingURL=poll.handlers.js.map