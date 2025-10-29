"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickVoteCommand = quickVoteCommand;
exports.resultsCommand = resultsCommand;
const poll_service_1 = require("../../services/poll.service");
const vote_service_1 = require("../../services/vote.service");
const user_service_1 = require("../../services/user.service");
const menu_service_1 = require("../../services/menu.service");
const logger_1 = require("../../utils/logger");
async function quickVoteCommand(ctx) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('❌ Не удалось определить пользователя');
            return;
        }
        if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
            await ctx.reply('⚠️ Команда /q доступна только в группах');
            return;
        }
        const groupId = ctx.chat.id;
        let dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            await ctx.reply('⚠️ Сначала нужно проголосовать обычным способом');
            return;
        }
        const activePoll = await poll_service_1.PollService.getActivePollInGroup(groupId);
        if (!activePoll) {
            await ctx.reply('⚠️ В этой группе нет активных голосований');
            return;
        }
        const poll = activePoll;
        const userVote = await vote_service_1.VoteService.getUserVoteInPoll(poll.id, dbUser.id);
        if (!userVote || !userVote.menuItemId) {
            await ctx.reply('⚠️ У вас нет предыдущего голоса. Выберите блюдо через обычное голосование');
            return;
        }
        const menuItem = await menu_service_1.MenuService.getMenuItemById(userVote.menuItemId);
        if (!menuItem || !menuItem.isActive) {
            await ctx.reply('⚠️ Ваше предыдущее блюдо больше недоступно');
            return;
        }
        await vote_service_1.VoteService.upsertVote({
            pollId: poll.id,
            userId: dbUser.id,
            menuItemId: userVote.menuItemId,
        });
        await ctx.reply(`✅ Ваш голос за "${menuItem.name}" подтвержден!`, {
            reply_to_message_id: ctx.message?.message_id,
        });
        logger_1.logger.info(`Quick vote: user ${dbUser.id} voted for ${menuItem.id} in poll ${poll.id}`);
    }
    catch (error) {
        logger_1.logger.error('Error in quickVoteCommand:', error);
        await ctx.reply('❌ Ошибка при быстром голосовании');
    }
}
async function resultsCommand(ctx) {
    try {
        if (ctx.chat?.type !== 'group' && ctx.chat?.type !== 'supergroup') {
            await ctx.reply('⚠️ Команда /r доступна только в группах');
            return;
        }
        const groupId = ctx.chat.id;
        const activePoll = await poll_service_1.PollService.getActivePollInGroup(groupId);
        if (!activePoll) {
            await ctx.reply('⚠️ В этой группе нет активных голосований');
            return;
        }
        const poll = activePoll;
        const votes = await vote_service_1.VoteService.getPollVotes(poll.id);
        const breakdown = await vote_service_1.VoteService.getVoteBreakdown(poll.id);
        const voteTypeStats = await vote_service_1.VoteService.getVoteTypeStats(poll.id);
        let message = `📊 **Текущие результаты**\n\n`;
        message += `🎯 Голосование\n`;
        message += `👥 Проголосовало: ${votes.length}\n`;
        if (poll.endedAt) {
            const timeLeft = Math.max(0, Math.floor((new Date(poll.endedAt).getTime() - Date.now()) / 1000 / 60));
            message += `⏰ Осталось: ${timeLeft} мин\n`;
        }
        if (voteTypeStats.total > 0) {
            message += `\n📈 **Статистика:**\n`;
            message += `🍽️ Заказывают: ${voteTypeStats.menuItemVotes}\n`;
            if (voteTypeStats.bringOwnVotes > 0) {
                message += `🏠 Принесут из дома: ${voteTypeStats.bringOwnVotes}\n`;
            }
            if (voteTypeStats.skipVotes > 0) {
                message += `⏭️ Не обедают: ${voteTypeStats.skipVotes}\n`;
            }
        }
        if (breakdown.length === 0) {
            message += `\n😔 _Пока никто не проголосовал_`;
        }
        else {
            message += `\n📋 **Топ-5:**\n`;
            breakdown.slice(0, 5).forEach((item, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                message += `${medal} ${item.menuItemName} - ${item.votes} (${item.percentage}%)\n`;
            });
        }
        message += `\n_Используйте кнопки голосования для выбора блюда_`;
        await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_to_message_id: ctx.message?.message_id,
        });
        logger_1.logger.info(`Results shown via /r command in group ${groupId}`);
    }
    catch (error) {
        logger_1.logger.error('Error in resultsCommand:', error);
        await ctx.reply('❌ Ошибка при получении результатов');
    }
}
//# sourceMappingURL=quick.js.map