"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuCommand = menuCommand;
exports.handleQuickAddItem = handleQuickAddItem;
exports.handleShowMenuList = handleShowMenuList;
const menu_service_1 = require("../../services/menu.service");
const user_service_1 = require("../../services/user.service");
const logger_1 = require("../../utils/logger");
async function menuCommand(ctx) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('❌ Не удалось получить информацию о пользователе');
            return;
        }
        const dbUser = await user_service_1.UserService.getUserByTelegramId(BigInt(user.id));
        if (!dbUser) {
            await ctx.reply('❌ Вы не зарегистрированы в системе.\n\n' +
                'Используйте команду /start для регистрации.');
            return;
        }
        const isAdmin = dbUser.isAdmin;
        const isGroup = ctx.chat?.type !== 'private';
        const menuStats = await menu_service_1.MenuService.getMenuStats();
        const popularItems = await menu_service_1.MenuService.getPopularMenuItems(3);
        let text = '🍽️ **Управление меню**\n\n';
        text += `📊 **Статистика:**\n`;
        text += `• Всего блюд: ${menuStats.total}\n`;
        text += `• Активных: ${menuStats.active}\n`;
        text += `• Категорий: ${menuStats.categories}\n`;
        if (menuStats.averagePrice > 0) {
            text += `• Средняя цена: ${menuStats.averagePrice}₽\n`;
        }
        text += '\n';
        if (popularItems.length > 0) {
            text += '🔥 **Популярные блюда:**\n';
            popularItems.forEach((item, index) => {
                text += `${index + 1}. ${item.name} (${item.voteCount} голосов)\n`;
            });
            text += '\n';
        }
        if (isAdmin) {
            text += '👑 **Права администратора:**\n';
            text += '• Добавление новых блюд\n';
            text += '• Редактирование существующих\n';
            text += '• Активация/деактивация блюд\n';
            text += '• Удаление блюд\n';
            text += '• Просмотр статистики\n\n';
        }
        else {
            text += '👀 **Доступен просмотр:**\n';
            text += '• Список всех блюд\n';
            text += '• Статистика популярности\n';
            text += '• Категории и поиск\n\n';
            text += '💡 *Для редактирования требуются права администратора*\n\n';
        }
        const webappUrl = process.env.WEBAPP_URL || 'https://2072f129141b.ngrok-free.app';
        const botUsername = ctx.me.username;
        const keyboard = {
            inline_keyboard: isGroup ? [
                [
                    {
                        text: '📱 Открыть управление',
                        url: `https://t.me/${botUsername}?start=menu_${ctx.chat?.id || 'unknown'}`
                    }
                ],
                [
                    { text: '📋 Показать список', callback_data: 'show_menu_list' },
                    { text: '🔍 Поиск блюда', callback_data: 'search_menu' }
                ],
                [
                    { text: '📊 Популярные', callback_data: 'show_popular' },
                    { text: '📂 Категории', callback_data: 'show_categories' }
                ]
            ] : [
                [
                    {
                        text: '🚀 Открыть Mini App',
                        web_app: { url: webappUrl }
                    }
                ],
                [
                    { text: '📋 Показать список', callback_data: 'show_menu_list' },
                    { text: '🔍 Поиск блюда', callback_data: 'search_menu' }
                ],
                [
                    { text: '📊 Популярные', callback_data: 'show_popular' },
                    { text: '📂 Категории', callback_data: 'show_categories' }
                ]
            ]
        };
        if (isAdmin) {
            keyboard.inline_keyboard.push([
                { text: '➕ Быстрое добавление', callback_data: 'quick_add_item' },
                { text: '⚙️ Настройки', callback_data: 'menu_settings' }
            ]);
        }
        if (isGroup) {
            text += '\n💡 **Подсказка:** Нажмите кнопку "📱 Открыть управление" для доступа к Mini App.\n';
            text += 'Также доступна кнопка Menu справа от поля ввода! ⬇️\n';
        }
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        logger_1.logger.info('Menu command executed', {
            userId: dbUser.id,
            telegramId: user.id.toString(),
            isAdmin,
            chatType: ctx.chat?.type || 'unknown'
        });
    }
    catch (error) {
        logger_1.logger.error('Error in menu command:', error);
        await ctx.reply('❌ Произошла ошибка при загрузке меню.\n\n' +
            '🔄 Попробуйте еще раз или обратитесь к администратору.');
    }
}
async function handleQuickAddItem(ctx) {
    try {
        const user = ctx.from;
        if (!user)
            return;
        const isAdmin = await user_service_1.UserService.isAdmin(BigInt(user.id));
        if (!isAdmin) {
            await ctx.answerCallbackQuery('❌ Доступно только администраторам');
            return;
        }
        ctx.session.step = 'waiting_menu_item_name';
        ctx.session.tempData = {};
        await ctx.answerCallbackQuery();
        await ctx.reply('➕ **Быстрое добавление блюда**\n\n' +
            '📝 Введите название блюда:', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Отмена', callback_data: 'cancel_add_item' }]
                ]
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in quick add item:', error);
        await ctx.answerCallbackQuery('❌ Произошла ошибка');
    }
}
async function handleShowMenuList(ctx) {
    try {
        const activeItems = await menu_service_1.MenuService.getActiveMenuItems();
        if (activeItems.length === 0) {
            await ctx.answerCallbackQuery();
            await ctx.reply('🍽️ **Меню пусто**\n\n' +
                '➕ Добавьте блюда через Mini App или команду быстрого добавления.', { parse_mode: 'Markdown' });
            return;
        }
        let text = '🍽️ **Список блюд** (активные)\n\n';
        const itemsByCategory = activeItems.reduce((acc, item) => {
            const category = item.category || 'Без категории';
            if (!acc[category])
                acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});
        Object.entries(itemsByCategory).forEach(([category, items]) => {
            text += `📂 **${category}:**\n`;
            items.forEach((item, index) => {
                text += `${index + 1}. ${item.name}`;
                if (item.price)
                    text += ` - ${item.price}₽`;
                if (item.description)
                    text += `\n   _${item.description}_`;
                text += '\n';
            });
            text += '\n';
        });
        await ctx.answerCallbackQuery();
        const isGroup = ctx.chat?.type !== 'private';
        const webappUrl = process.env.WEBAPP_URL || 'https://2072f129141b.ngrok-free.app';
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: isGroup ? [
                    [
                        { text: '🔍 Поиск', callback_data: 'search_menu' },
                        { text: '🔄 Обновить', callback_data: 'show_menu_list' }
                    ]
                ] : [
                    [
                        { text: '🚀 Открыть Mini App', web_app: { url: webappUrl } }
                    ],
                    [
                        { text: '🔍 Поиск', callback_data: 'search_menu' },
                        { text: '🔄 Обновить', callback_data: 'show_menu_list' }
                    ]
                ]
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error showing menu list:', error);
        await ctx.answerCallbackQuery('❌ Ошибка загрузки списка');
    }
}
