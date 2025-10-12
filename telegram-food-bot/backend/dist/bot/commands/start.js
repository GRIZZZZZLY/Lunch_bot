"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCommand = startCommand;
const user_service_1 = require("../../services/user.service");
const poll_service_1 = require("../../services/poll.service");
const logger_1 = require("../../utils/logger");
async function startCommand(ctx) {
    try {
        const user = ctx.from;
        if (!user) {
            await ctx.reply('❌ Не удалось получить информацию о пользователе');
            return;
        }
        const dbUser = await user_service_1.UserService.upsertUser({
            telegramId: user.id.toString(),
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
        });
        const isNewUser = ctx.session?.step !== 'registered';
        ctx.session.step = 'registered';
        const startParam = ctx.match;
        const webappUrl = process.env.WEBAPP_URL || 'https://2072f129141b.ngrok-free.app';
        if (startParam && startParam.toString().startsWith('menu_')) {
            const groupId = startParam.toString().replace('menu_', '');
            await ctx.reply('🍽 *Открываю управление меню...*\n\n' +
                'Нажмите кнопку ниже чтобы открыть Mini App:', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            {
                                text: '📱 Открыть меню группы',
                                web_app: { url: `${webappUrl}?groupId=${groupId}` }
                            }
                        ]]
                }
            });
            return;
        }
        if (startParam && startParam.toString().startsWith('add_')) {
            const groupId = startParam.toString().replace('add_', '');
            await ctx.reply('➕ *Добавление блюда в меню*\n\n' +
                'Нажмите кнопку ниже чтобы открыть Mini App:', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            {
                                text: '➕ Добавить блюдо',
                                web_app: { url: `${webappUrl}?groupId=${groupId}&action=add` }
                            }
                        ]]
                }
            });
            return;
        }
        if (startParam && startParam.toString().startsWith('vote_')) {
            const pollIdStr = startParam.toString().replace('vote_', '');
            const pollId = parseInt(pollIdStr);
            if (isNaN(pollId)) {
                await ctx.reply('❌ **Неверная ссылка на голосование**\n\n' +
                    '💡 Попробуйте использовать команду `/vote` в группе с активным голосованием', { parse_mode: 'Markdown' });
                return;
            }
            const poll = await poll_service_1.PollService.getPollById(pollId);
            if (!poll) {
                await ctx.reply('❌ **Голосование не найдено**\n\n' +
                    `ID голосования: \`${pollId}\`\n\n` +
                    '💡 Возможно, голосование было удалено или ссылка устарела', { parse_mode: 'Markdown' });
                return;
            }
            if (poll.status !== 'ACTIVE') {
                await ctx.reply('⚠️ **Голосование завершено**\n\n' +
                    `ID: \`${pollId}\`\n` +
                    `Статус: ${poll.status}\n\n` +
                    '📊 Результаты были отправлены в группу', { parse_mode: 'Markdown' });
                return;
            }
            const timeRemaining = poll.startedAt && poll.duration
                ? Math.max(0, Math.floor((new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000).getTime() - Date.now()) / 1000 / 60))
                : null;
            const voteCount = poll.votes?.length || 0;
            await ctx.reply(`🗳️ **Голосование активно!**\n\n` +
                `👥 Проголосовало: ${voteCount}\n` +
                (timeRemaining !== null ? `⏰ Осталось: ${timeRemaining} мин\n` : '') +
                `\n📱 Нажмите кнопку ниже, чтобы проголосовать:`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '📱 Открыть голосование',
                                web_app: { url: webappUrl }
                            }
                        ],
                        [
                            {
                                text: '💡 Альтернативный способ',
                                callback_data: `vote_fallback:${pollId}`
                            }
                        ]
                    ]
                }
            });
            logger_1.logger.info(`Deep link processed: vote_${pollId} for user ${user.id}`);
            return;
        }
        if (startParam && startParam.toString().startsWith('poll_')) {
            const groupId = startParam.toString().replace('poll_', '');
            await ctx.reply('🗳 *Быстрое голосование*\n\n' +
                'Нажмите кнопку ниже чтобы открыть Mini App и настроить голосование:', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            {
                                text: '🗳 Создать голосование',
                                web_app: { url: `${webappUrl}?groupId=${groupId}&action=poll` }
                            }
                        ]]
                }
            });
            return;
        }
        const welcomeText = isNewUser
            ? `🎉 Добро пожаловать, ${user.first_name}!\n\n` +
                '🤖 Я помогу вашей команде выбирать еду для заказа.\n\n' +
                '✨ **Что я умею:**\n' +
                '• 🗳️ Организовывать голосования за блюда\n' +
                '• 🎲 Выбирать ответственного за заказ\n' +
                '• 🍽️ Управлять меню блюд\n' +
                '• 📊 Показывать статистику\n\n' +
                '💡 **Для начала:**\n' +
                '1. Добавьте меня в группу\n' +
                '2. Дайте мне права администратора\n' +
                '3. Используйте /help для списка команд'
            : `👋 С возвращением, ${user.first_name}!`;
        const isGroup = ctx.chat?.type !== 'private';
        const keyboard = {
            inline_keyboard: isGroup ? [
                [
                    { text: '🍽️ Меню', callback_data: 'menu' },
                    { text: '📖 Команды', callback_data: 'help' }
                ],
                [
                    { text: '👥 О боте', callback_data: 'about' },
                    { text: '👑 Админы', callback_data: 'show_admins' }
                ]
            ] : [
                [
                    {
                        text: '🚀 Открыть Mini App',
                        web_app: { url: webappUrl }
                    }
                ],
                [
                    { text: '🍽️ Меню', callback_data: 'menu' },
                    { text: '📖 Команды', callback_data: 'help' }
                ],
                [
                    { text: '👥 О боте', callback_data: 'about' },
                    { text: '👑 Админы', callback_data: 'show_admins' }
                ]
            ]
        };
        await ctx.reply(welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        logger_1.logger.info('User started bot', {
            userId: dbUser.id,
            telegramId: user.id.toString(),
            username: user.username,
            firstName: user.first_name,
            isNewUser
        });
        if (isGroup) {
            setTimeout(async () => {
                await ctx.reply('👥 **Групповой режим активирован!**\n\n' +
                    '🔧 **Для полного функционала:**\n' +
                    '1. Сделайте меня администратором группы\n' +
                    '2. Используйте /startpoll для запуска голосования\n' +
                    '3. Участники смогут голосовать за блюда\n\n' +
                    '📱 **Для управления меню:**\n' +
                    '• Откройте бота [@rocket_lunch_bot](https://t.me/rocket_lunch_bot) в личных сообщениях\n' +
                    '• Нажмите на кнопку Menu внизу экрана\n' +
                    '• Или используйте команду /menu в личке\n\n' +
                    '⚡ Попробуйте /help для списка команд', { parse_mode: 'Markdown' });
            }, 1000);
        }
    }
    catch (error) {
        logger_1.logger.error('Error in start command:', error);
        await ctx.reply('❌ Произошла ошибка при регистрации. Попробуйте позже.');
    }
}
//# sourceMappingURL=start.js.map