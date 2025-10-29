"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteCommand = voteCommand;
const poll_service_1 = require("../../services/poll.service");
const user_service_1 = require("../../services/user.service");
const menu_service_1 = require("../../services/menu.service");
const logger_1 = require("../../utils/logger");
async function voteCommand(ctx) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('❌ Не удалось определить пользователя');
            return;
        }
        let dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            dbUser = await user_service_1.UserService.upsertUser({
                telegramId: user.id.toString(),
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
            });
        }
        const args = ctx.match?.toString().trim();
        let pollId = null;
        if (args && args.length > 0) {
            pollId = parseInt(args);
            if (isNaN(pollId)) {
                await ctx.reply('❌ Неверный формат команды\n\n' +
                    'Использование: `/vote <ID голосования>`\n' +
                    'Или просто `/vote` если вы в группе с активным голосованием', { parse_mode: 'Markdown' });
                return;
            }
        }
        else {
            const chat = ctx.chat;
            if (chat && chat.type !== 'private') {
                const groupId = chat.id.toString();
                const group = await Promise.resolve().then(() => __importStar(require('../../services/group.service'))).then(m => m.GroupService.getGroupByTelegramId(groupId));
                if (group) {
                    const activePoll = await poll_service_1.PollService.getActivePollInGroup(group.id);
                    if (activePoll) {
                        pollId = activePoll.id;
                    }
                }
            }
            if (!pollId) {
                await ctx.reply('ℹ️ Укажите ID голосования\n\n' +
                    'Использование: `/vote <ID>`\n\n' +
                    'Пример: `/vote 123`', { parse_mode: 'Markdown' });
                return;
            }
        }
        const poll = await poll_service_1.PollService.getPollById(pollId);
        if (!poll) {
            await ctx.reply('❌ Голосование не найдено');
            return;
        }
        if (poll.status !== 'ACTIVE') {
            await ctx.reply('⚠️ Голосование уже завершено');
            return;
        }
        const activeItems = await menu_service_1.MenuService.getActiveMenuItems();
        if (activeItems.length === 0) {
            await ctx.reply('❌ Нет доступных блюд в меню');
            return;
        }
        const votes = poll.votes || [];
        const voteCount = votes.length;
        let timeRemaining = 'неизвестно';
        if (poll.startedAt && poll.duration) {
            const endTime = new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
            const remaining = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000 / 60));
            timeRemaining = `${remaining} мин`;
        }
        const message = `🗳️ **Голосование активно!**\n\n` +
            `👥 Проголосовало: ${voteCount}\n` +
            `⏰ Осталось: ${timeRemaining}\n\n` +
            `🤖 Для удобного голосования откройте Mini App:\n` +
            `• Фото блюд\n` +
            `• Описания и цены\n` +
            `• Live-результаты\n\n` +
            `👇 Нажмите кнопку ниже:`;
        const webAppUrl = process.env.WEBAPP_URL || 'https://your-domain.com';
        const miniAppKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: '📱 Открыть голосование',
                        web_app: { url: `${webAppUrl}?pollId=${pollId}` }
                    }
                ]
            ]
        };
        await ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: miniAppKeyboard,
        });
        logger_1.logger.info(`Fallback vote command used by user ${dbUser.id} for poll ${pollId}`);
    }
    catch (error) {
        logger_1.logger.error('Error in voteCommand:', error);
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
}
//# sourceMappingURL=vote.js.map