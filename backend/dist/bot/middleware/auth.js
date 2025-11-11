"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.adminMiddleware = adminMiddleware;
exports.groupAdminMiddleware = groupAdminMiddleware;
exports.groupOnlyMiddleware = groupOnlyMiddleware;
exports.privateOnlyMiddleware = privateOnlyMiddleware;
exports.activeUserMiddleware = activeUserMiddleware;
exports.registeredUserMiddleware = registeredUserMiddleware;
const user_service_1 = require("../../services/user.service");
const group_service_1 = require("../../services/group.service");
const logger_1 = require("../../utils/logger");
async function authMiddleware(ctx, next) {
    try {
        const user = ctx.from;
        if (!user) {
            return next();
        }
        const dbUser = await user_service_1.UserService.upsertUser({
            telegramId: user.id.toString(),
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
        });
        ctx.dbUser = dbUser;
        if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
            const group = await group_service_1.GroupService.upsertGroup({
                telegramId: ctx.chat.id.toString(),
                title: ('title' in ctx.chat ? ctx.chat.title : undefined) ?? 'Unknown Group',
                type: ctx.chat.type,
            });
            ctx.dbGroup = group;
            await group_service_1.GroupService.addMemberToGroup(group.id, dbUser.id);
        }
        return next();
    }
    catch (error) {
        logger_1.logger.error('Auth middleware error:', error);
        return next();
    }
}
function adminMiddleware() {
    return async function (ctx, next) {
        try {
            const user = ctx.from;
            if (!user) {
                await ctx.reply('❌ Не удалось определить пользователя');
                return;
            }
            const isAdmin = await user_service_1.UserService.isAdmin(BigInt(user.id));
            if (!isAdmin) {
                await ctx.reply('🔒 **Недостаточно прав**\n\n' +
                    'Эта команда доступна только администраторам бота.\n\n' +
                    '💡 Обратитесь к администратору для получения прав.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👑 Список админов', callback_data: 'show_admins' }]
                        ]
                    }
                });
                return;
            }
            return next();
        }
        catch (error) {
            logger_1.logger.error('Admin middleware error:', error);
            await ctx.reply('❌ Ошибка проверки прав администратора');
        }
    };
}
function groupAdminMiddleware() {
    return async function (ctx, next) {
        try {
            const user = ctx.from;
            const chat = ctx.chat;
            if (!user || !chat) {
                await ctx.reply('❌ Не удалось определить контекст');
                return;
            }
            if (!['group', 'supergroup'].includes(chat.type)) {
                return next();
            }
            const member = await ctx.api.getChatMember(chat.id, user.id);
            const isGroupAdmin = ['administrator', 'creator'].includes(member.status);
            if (!isGroupAdmin) {
                await ctx.reply('🔒 **Недостаточно прав в группе**\n\n' +
                    'Для выполнения этой команды вам нужны права администратора группы.', { parse_mode: 'Markdown' });
                return;
            }
            return next();
        }
        catch (error) {
            logger_1.logger.error('Group admin middleware error:', error);
            await ctx.reply('❌ Ошибка проверки прав в группе');
        }
    };
}
async function groupOnlyMiddleware(ctx, next) {
    if (ctx.chat?.type === 'private') {
        await ctx.reply('👥 **Команда только для групп**\n\n' +
            'Эта команда работает только в групповых чатах.\n\n' +
            '💡 Добавьте бота в группу и попробуйте снова.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📖 Инструкция', callback_data: 'group_setup_help' }]
                ]
            }
        });
        return;
    }
    return next();
}
async function privateOnlyMiddleware(ctx, next) {
    if (ctx.chat?.type !== 'private') {
        await ctx.reply('💬 **Команда только для личных сообщений**\n\n' +
            'Эта команда работает только в личной переписке с ботом.\n\n' +
            '💡 Напишите боту в личные сообщения.', { parse_mode: 'Markdown' });
        return;
    }
    return next();
}
async function activeUserMiddleware(ctx, next) {
    try {
        const user = ctx.from;
        if (!user) {
            return next();
        }
        const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser?.isActive) {
            await ctx.reply('🔒 **Аккаунт деактивирован**\n\n' +
                'Ваш аккаунт был деактивирован администратором.\n\n' +
                'Обратитесь к администратору для восстановления доступа.', { parse_mode: 'Markdown' });
            return;
        }
        return next();
    }
    catch (error) {
        logger_1.logger.error('Active user middleware error:', error);
        return next();
    }
}
async function registeredUserMiddleware(ctx, next) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('❌ Не удалось определить пользователя');
            return;
        }
        const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            await ctx.reply('📝 **Требуется регистрация**\n\n' +
                'Для использования этой команды необходимо зарегистрироваться.\n\n' +
                'Используйте команду /start для регистрации.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🚀 Зарегистрироваться', callback_data: 'start' }]
                    ]
                }
            });
            return;
        }
        return next();
    }
    catch (error) {
        logger_1.logger.error('Registered user middleware error:', error);
        await ctx.reply('❌ Ошибка проверки регистрации');
    }
}
//# sourceMappingURL=auth.js.map