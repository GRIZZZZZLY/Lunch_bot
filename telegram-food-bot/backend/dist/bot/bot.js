"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBot = createBot;
exports.startPolling = startPolling;
exports.setupWebhook = setupWebhook;
exports.stopBot = stopBot;
const grammy_1 = require("grammy");
const bot_config_1 = require("../config/bot.config");
const logger_1 = require("../utils/logger");
const error_1 = require("../utils/error");
const user_service_1 = require("../services/user.service");
const notification_service_1 = require("../services/notification.service");
const userService = new user_service_1.UserService();
const auth_1 = require("./middleware/auth");
const logger_2 = require("./middleware/logger");
const start_1 = require("./commands/start");
const help_1 = require("./commands/help");
const menu_1 = require("./commands/menu");
const startpoll_1 = require("./commands/startpoll");
const poll_handlers_1 = require("./handlers/poll.handlers");
function initial() {
    return {
        step: undefined,
        tempData: undefined,
    };
}
function createBot() {
    const bot = new grammy_1.Bot(bot_config_1.botConfig.token);
    (0, error_1.setupErrorHandlers)();
    notification_service_1.notificationService.initialize(bot);
    bot.use((0, grammy_1.session)({ initial }));
    bot.use(logger_2.loggingMiddleware);
    bot.use(logger_2.errorLoggingMiddleware);
    bot.use(auth_1.authMiddleware);
    bot.use(logger_2.statsMiddleware);
    bot.command('start', start_1.startCommand);
    bot.command('help', help_1.helpCommand);
    bot.command('menu', menu_1.menuCommand);
    bot.command('startpoll', auth_1.groupOnlyMiddleware, (0, auth_1.adminMiddleware)(), startpoll_1.startPollCommand);
    bot.command('history', async (ctx) => {
        await ctx.reply('🚧 История голосований в разработке!');
    });
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        try {
            if (data.startsWith('vote:')) {
                const [, pollIdStr, menuItemIdStr] = data.split(':');
                const pollId = parseInt(pollIdStr);
                const menuItemId = parseInt(menuItemIdStr);
                await (0, poll_handlers_1.handleVote)(ctx, pollId, menuItemId);
                return;
            }
            if (data.startsWith('show_results:')) {
                const pollId = parseInt(data.split(':')[1]);
                await (0, poll_handlers_1.handleShowResults)(ctx, pollId);
                return;
            }
            if (data.startsWith('cancel_poll:')) {
                const pollId = parseInt(data.split(':')[1]);
                await (0, poll_handlers_1.handleCancelPoll)(ctx, pollId);
                return;
            }
            if (data.startsWith('run_roulette:')) {
                const pollId = parseInt(data.split(':')[1]);
                await (0, poll_handlers_1.handleRunRoulette)(ctx, pollId);
                return;
            }
            if (data.startsWith('complete_poll:')) {
                const pollId = parseInt(data.split(':')[1]);
                await (0, poll_handlers_1.handleCompletePoll)(ctx, pollId);
                return;
            }
            if (data.startsWith('refresh_poll:')) {
                const pollId = parseInt(data.split(':')[1]);
                await (0, poll_handlers_1.handleRefreshPoll)(ctx, pollId);
                return;
            }
            switch (data) {
                case 'help':
                    await (0, help_1.helpCommand)(ctx);
                    break;
                case 'start_new_poll':
                    await ctx.answerCallbackQuery('Используйте команду /startpoll для запуска нового голосования');
                    break;
                case 'show_history':
                    await ctx.answerCallbackQuery('🚧 История в разработке!');
                    break;
                case 'show_admins':
                    const admins = await user_service_1.UserService.getAdmins();
                    const adminList = admins.map((admin) => `👑 ${admin.firstName}${admin.lastName ? ` ${admin.lastName}` : ''}${admin.username ? ` (@${admin.username})` : ''}`).join('\n');
                    await ctx.answerCallbackQuery();
                    await ctx.reply('👑 **Администраторы бота:**\n\n' +
                        (adminList || 'Администраторы не назначены'), { parse_mode: 'Markdown' });
                    break;
                case 'about':
                    await ctx.answerCallbackQuery();
                    await ctx.reply('🤖 *Telegram Food Bot*\n\n' +
                        'Бот для организации голосований за еду в коллективе.\n\n' +
                        '✨ *Возможности:*\n' +
                        '• Управление меню блюд\n' +
                        '• Голосование за блюда\n' +
                        '• Рулетка для выбора ответственного\n' +
                        '• Статистика и история\n\n' +
                        '🔧 Версия: 1.0.0\n' +
                        '📅 Создан: 2024', { parse_mode: 'Markdown' });
                    break;
                case 'menu_stats':
                    await ctx.answerCallbackQuery('🚧 Статистика в разработке!');
                    break;
                case 'menu_help':
                    await ctx.answerCallbackQuery();
                    await ctx.reply('❓ *Помощь по меню*\n\n' +
                        '🍽️ *Как добавить блюдо:*\n' +
                        '1. Нажмите "Открыть Mini App"\n' +
                        '2. Используйте кнопку "Добавить блюдо"\n' +
                        '3. Заполните название и описание\n' +
                        '4. Сохраните изменения\n\n' +
                        '⚙️ *Управление блюдами:*\n' +
                        '• Редактирование - нажмите на блюдо\n' +
                        '• Активация/деактивация - переключатель\n' +
                        '• Удаление - кнопка удаления\n\n' +
                        '💡 *Советы:*\n' +
                        '• Активные блюда участвуют в голосовании\n' +
                        '• Используйте категории для группировки\n' +
                        '• Добавляйте цены для удобства', { parse_mode: 'Markdown' });
                    break;
                default:
                    await ctx.answerCallbackQuery('🤷‍♂️ Неизвестная команда');
            }
        }
        catch (error) {
            logger_1.logger.error('Ошибка обработки callback query:', error);
            await ctx.answerCallbackQuery('❌ Произошла ошибка');
        }
    });
    bot.on('message:text', async (ctx) => {
        const text = ctx.message.text;
        if (text.startsWith('/')) {
            await ctx.reply('❓ Неизвестная команда.\n\n' +
                'Используйте /help для получения списка доступных команд.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📖 Показать команды', callback_data: 'help' }]
                    ]
                }
            });
        }
    });
    bot.api.getMe().then((botInfo) => {
        logger_1.logger.info('🤖 Бот инициализирован', {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name,
            canJoinGroups: botInfo.can_join_groups,
            canReadAllGroupMessages: botInfo.can_read_all_group_messages,
            supportsInlineQueries: botInfo.supports_inline_queries,
        });
    });
    return bot;
}
async function startPolling(bot) {
    try {
        await bot.start({
            onStart: (botInfo) => {
                logger_1.logger.info('🚀 Бот запущен в polling режиме', {
                    username: botInfo.username,
                });
            },
        });
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка запуска бота в polling режиме:', error);
        throw error;
    }
}
async function setupWebhook(bot, webhookUrl) {
    try {
        await bot.api.setWebhook(webhookUrl, {
            drop_pending_updates: true,
        });
        logger_1.logger.info('🌐 Webhook установлен', { webhookUrl });
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка установки webhook:', error);
        throw error;
    }
}
async function stopBot(bot) {
    try {
        await bot.stop();
        logger_1.logger.info('🛑 Бот остановлен');
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка остановки бота:', error);
    }
}
//# sourceMappingURL=bot.js.map