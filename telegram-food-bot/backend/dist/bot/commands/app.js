"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appCommand = appCommand;
const user_service_1 = require("../../services/user.service");
const logger_1 = require("../../utils/logger");
async function appCommand(ctx) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('❌ Не удалось получить информацию о пользователе');
            return;
        }
        const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            await ctx.reply('❌ Вы не зарегистрированы в системе.\n\n' +
                'Используйте команду /start для регистрации.', {
                reply_markup: {
                    inline_keyboard: [[
                            { text: '▶️ Начать', callback_data: 'start' }
                        ]]
                }
            });
            return;
        }
        const webappUrl = process.env.WEBAPP_URL || 'https://2072f129141b.ngrok-free.app';
        const isGroup = ctx.chat?.type !== 'private';
        const isAdmin = dbUser.isAdmin;
        let text = '🚀 **Telegram Food Bot - Mini App**\n\n';
        if (isGroup) {
            text += '👥 **Групповой режим**\n\n';
            text += '⚠️ В группах Mini App кнопки не поддерживаются Telegram.\n\n';
            text += '📱 **Для управления меню:**\n';
            text += '1. Откройте бота [@rocket_lunch_bot](https://t.me/rocket_lunch_bot) в личных сообщениях\n';
            text += '2. Нажмите на кнопку **Menu** внизу экрана\n';
            text += '3. Или используйте команду `/menu` в личке\n\n';
            text += '✨ **Доступные функции:**\n';
            text += '• 📋 Просмотр меню блюд\n';
            text += '• 🔍 Поиск и фильтрация\n';
            text += '• 📊 Статистика популярности\n';
            if (isAdmin) {
                text += '• ➕ Добавление новых блюд\n';
                text += '• ✏️ Редактирование меню\n';
                text += '• 🗳️ Создание голосований\n';
            }
        }
        else {
            text += '👤 **Личный режим**\n\n';
            text += '🎯 Откройте Mini App для управления меню:\n\n';
            if (isAdmin) {
                text += '👑 **У вас есть права администратора:**\n';
                text += '• ➕ Добавляйте новые блюда\n';
                text += '• ✏️ Редактируйте существующие\n';
                text += '• 🗑️ Удаляйте ненужные\n';
                text += '• 📊 Просматривайте статистику\n';
                text += '• 🗳️ Создавайте голосования\n';
            }
            else {
                text += '👀 **Доступен просмотр:**\n';
                text += '• 📋 Список всех блюд\n';
                text += '• 🔍 Поиск и фильтры\n';
                text += '• 📊 Статистика\n';
            }
        }
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: isGroup ? [
                    [
                        { text: '📖 Команды', callback_data: 'help' },
                        { text: '🍽️ Меню', callback_data: 'menu' }
                    ]
                ] : [
                    [
                        {
                            text: '🚀 Открыть Mini App',
                            web_app: { url: webappUrl }
                        }
                    ],
                    [
                        { text: '📖 Команды', callback_data: 'help' },
                        { text: '🍽️ Меню', callback_data: 'menu' }
                    ]
                ]
            }
        });
        logger_1.logger.info('App command executed', {
            userId: dbUser.id,
            telegramId: user.id.toString(),
            isAdmin,
            chatType: ctx.chat?.type || 'unknown',
            isGroup
        });
    }
    catch (error) {
        logger_1.logger.error('Error in app command:', error);
        await ctx.reply('❌ Произошла ошибка.\n\n' +
            '🔄 Попробуйте еще раз или обратитесь к администратору.');
    }
}
//# sourceMappingURL=app.js.map