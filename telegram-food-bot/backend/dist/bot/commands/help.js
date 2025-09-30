"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helpCommand = helpCommand;
const user_service_1 = require("../../services/user.service");
async function helpCommand(ctx) {
    const isGroup = ctx.chat.type !== 'private';
    const user = ctx.from;
    let isAdmin = false;
    if (user) {
        isAdmin = await user_service_1.UserService.isAdmin(BigInt(user.id));
    }
    const helpText = isGroup
        ? await getGroupHelpText(isAdmin)
        : await getPrivateHelpText(isAdmin);
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🍽️ Управление меню', callback_data: 'menu' },
                { text: '📊 Статистика', callback_data: 'menu_stats' }
            ],
            [
                { text: '❓ Помощь по меню', callback_data: 'menu_help' },
                { text: '👥 О боте', callback_data: 'about' }
            ]
        ]
    };
    await ctx.reply(helpText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}
async function getGroupHelpText(isAdmin) {
    let text = '🤖 **Команды Telegram Food Bot**\n\n';
    text += '👥 **Для всех участников:**\n';
    text += '• `/start` - регистрация в системе\n';
    text += '• `/help` - показать эту справку\n';
    text += '• `/menu` - управление меню (Mini App)\n\n';
    if (isAdmin) {
        text += '👑 **Для администраторов:**\n';
        text += '• `/startpoll` - запустить голосование\n';
        text += '• `/history` - история голосований\n\n';
    }
    text += '🗳️ **Как проходит голосование:**\n';
    text += '1. Админ запускает голосование командой `/startpoll`\n';
    text += '2. Участники голосуют нажатием кнопок\n';
    text += '3. По завершении определяется победитель\n';
    text += '4. Рулетка выбирает ответственного за заказ\n\n';
    text += '🍽️ **Управление меню:**\n';
    text += '• Используйте команду `/menu` для открытия Mini App\n';
    text += '• Добавляйте, редактируйте и удаляйте блюда\n';
    text += '• Только активные блюда участвуют в голосовании\n\n';
    if (!isAdmin) {
        text += '💡 **Подсказка:** Обратитесь к администратору для получения прав на управление голосованиями.';
    }
    return text;
}
async function getPrivateHelpText(isAdmin) {
    let text = '🤖 **Telegram Food Bot - Личные команды**\n\n';
    text += '👤 **Доступные команды:**\n';
    text += '• `/start` - начать работу с ботом\n';
    text += '• `/help` - показать эту справку\n';
    text += '• `/menu` - управление меню (Mini App)\n\n';
    if (isAdmin) {
        text += '👑 **Права администратора:**\n';
        text += '• Управление меню блюд\n';
        text += '• Запуск голосований в группах\n';
        text += '• Просмотр статистики\n\n';
    }
    text += '🍽️ **Управление меню:**\n';
    text += '• Нажмите на кнопку "Управление меню" ниже\n';
    text += '• Или используйте команду `/menu`\n';
    text += '• Добавляйте блюда, которые будут участвовать в голосованиях\n\n';
    text += '👥 **Для использования в группах:**\n';
    text += '1. Добавьте бота в группу\n';
    text += '2. Дайте боту права администратора\n';
    text += '3. Используйте `/startpoll` для запуска голосования\n\n';
    text += '📱 **Mini App:**\n';
    text += '• Удобный интерфейс для управления меню\n';
    text += '• Добавление, редактирование, удаление блюд\n';
    text += '• Категоризация и поиск\n';
    text += '• Статистика популярности\n\n';
    if (!isAdmin) {
        text += '💡 **Хотите стать администратором?** Обратитесь к текущим админам бота.';
    }
    else {
        text += '⚡ **Вы администратор!** У вас есть доступ ко всем функциям бота.';
    }
    return text;
}
//# sourceMappingURL=help.js.map