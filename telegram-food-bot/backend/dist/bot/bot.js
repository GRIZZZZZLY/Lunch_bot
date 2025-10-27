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
exports.createBot = createBot;
exports.startPolling = startPolling;
exports.setupWebhook = setupWebhook;
exports.stopBot = stopBot;
exports.getBotInstance = getBotInstance;
const grammy_1 = require("grammy");
const bot_config_1 = require("../config/bot.config");
const logger_1 = require("../utils/logger");
const error_1 = require("../utils/error");
const user_service_1 = require("../services/user.service");
const notification_service_1 = require("../services/notification.service");
const poll_reminder_service_1 = require("../services/poll-reminder.service");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const userService = new user_service_1.UserService();
let botInstance = null;
const auth_1 = require("./middleware/auth");
const logger_2 = require("./middleware/logger");
const start_1 = require("./commands/start");
const help_1 = require("./commands/help");
const menu_1 = require("./commands/menu");
const startpoll_1 = require("./commands/startpoll");
const vote_1 = require("./commands/vote");
const quick_1 = require("./commands/quick");
const poll_handlers_1 = require("./handlers/poll.handlers");
const group_events_1 = require("./events/group-events");
function initial() {
    return {
        step: undefined,
        tempData: undefined,
    };
}
function createBot() {
    let gramBotConfig;
    if (bot_config_1.botConfig.localApi.enabled) {
        logger_1.logger.info('🔧 Используется локальный Telegram Bot API сервер', {
            url: bot_config_1.botConfig.localApi.url,
        });
        gramBotConfig = {
            client: {
                apiRoot: bot_config_1.botConfig.localApi.url,
            },
        };
    }
    else if (bot_config_1.botConfig.proxy.enabled && bot_config_1.botConfig.proxy.url) {
        logger_1.logger.info('🔧 Используется прокси для подключения к Telegram API', {
            proxy: bot_config_1.botConfig.proxy.url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
        });
        try {
            const proxyUrl = bot_config_1.botConfig.proxy.url;
            let agent;
            if (proxyUrl.startsWith('socks')) {
                agent = new socks_proxy_agent_1.SocksProxyAgent(proxyUrl);
            }
            else {
                agent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
            }
            gramBotConfig = {
                client: {
                    baseFetchConfig: {
                        agent,
                        compress: true,
                    },
                },
            };
        }
        catch (error) {
            logger_1.logger.error('❌ Ошибка настройки прокси:', error);
            logger_1.logger.warn('⚠️  Продолжаем без прокси...');
        }
    }
    botInstance = new grammy_1.Bot(bot_config_1.botConfig.token, gramBotConfig);
    const bot = botInstance;
    (0, error_1.setupErrorHandlers)();
    notification_service_1.notificationService.initialize(bot);
    poll_reminder_service_1.PollReminderService.initialize(bot);
    const { initializeResponsibleServiceBot } = require('../services/responsible.service');
    const { initializeBudgetServiceBot } = require('../services/budget.service');
    initializeResponsibleServiceBot(bot);
    initializeBudgetServiceBot(bot);
    bot.use((0, grammy_1.session)({ initial }));
    bot.use(logger_2.loggingMiddleware);
    bot.use(logger_2.errorLoggingMiddleware);
    bot.use(auth_1.authMiddleware);
    bot.use(logger_2.statsMiddleware);
    bot.command('start', start_1.startCommand);
    bot.command('help', help_1.helpCommand);
    bot.command('menu', menu_1.menuCommand);
    bot.command('vote', vote_1.voteCommand);
    bot.command('startpoll', auth_1.groupOnlyMiddleware, (0, auth_1.adminMiddleware)(), startpoll_1.startPollCommand);
    bot.command('q', auth_1.groupOnlyMiddleware, quick_1.quickVoteCommand);
    bot.command('r', auth_1.groupOnlyMiddleware, quick_1.resultsCommand);
    bot.command('history', async (ctx) => {
        await ctx.reply('🚧 История голосований в разработке!');
    });
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        try {
            if (data.startsWith('openpoll:')) {
                const pollId = parseInt(data.split(':')[1]);
                await (0, poll_handlers_1.handleOpenPollButton)(ctx, pollId);
                return;
            }
            if (data.startsWith('vote_fallback:')) {
                const pollId = parseInt(data.split(':')[1]);
                await ctx.answerCallbackQuery();
                await ctx.reply('💡 **Альтернативные способы голосования:**\n\n' +
                    `1️⃣ Используйте команду: \`/vote ${pollId}\`\n\n` +
                    `2️⃣ Откройте бота в личных сообщениях и нажмите на кнопку Web App\n\n` +
                    '📱 Выберите удобный для вас способ!', { parse_mode: 'Markdown' });
                return;
            }
            if (data.startsWith('vote:')) {
                const parts = data.split(':');
                if (parts[1] === 'bring_own') {
                    const pollId = parseInt(parts[2]);
                    await (0, poll_handlers_1.handleBringOwnVote)(ctx, pollId);
                    return;
                }
                else if (parts[1] === 'skip') {
                    const pollId = parseInt(parts[2]);
                    await (0, poll_handlers_1.handleSkipVote)(ctx, pollId);
                    return;
                }
                else {
                    const pollId = parseInt(parts[1]);
                    const menuItemId = parseInt(parts[2]);
                    await (0, poll_handlers_1.handleVote)(ctx, pollId, menuItemId);
                    return;
                }
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
            if (data.startsWith('volunteer:')) {
                const pollId = parseInt(data.split(':')[1]);
                const { ResponsibleService } = await Promise.resolve().then(() => __importStar(require('../services/responsible.service.js')));
                await ResponsibleService.handleVolunteer(pollId, ctx.from.id);
                await ctx.answerCallbackQuery('✅ Спасибо! Вы выбраны ответственным');
                return;
            }
            if (data.startsWith('budget:mark_paid:')) {
                const txId = parseInt(data.split(':')[2]);
                const { BudgetService } = await Promise.resolve().then(() => __importStar(require('../services/budget.service.js')));
                await BudgetService.markAsPaid(txId, ctx.from.id);
                await ctx.answerCallbackQuery('✅ Отмечено как оплачено');
                try {
                    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
                }
                catch (e) { }
                return;
            }
            if (data.startsWith('budget:confirm:')) {
                const txId = parseInt(data.split(':')[2]);
                const { BudgetService } = await Promise.resolve().then(() => __importStar(require('../services/budget.service.js')));
                await BudgetService.confirmPayment(txId);
                await ctx.answerCallbackQuery('✅ Оплата подтверждена');
                try {
                    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
                }
                catch (e) { }
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
                    await ctx.reply('👑 *Администраторы бота:*\n\n' +
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
    (0, group_events_1.setupGroupEvents)(bot);
    bot.api.getMe().then((botInfo) => {
        logger_1.logger.info('🤖 Бот инициализирован', {
            id: botInfo.id,
            username: botInfo.username,
            firstName: botInfo.first_name,
            canJoinGroups: botInfo.can_join_groups,
            canReadAllGroupMessages: botInfo.can_read_all_group_messages,
            supportsInlineQueries: botInfo.supports_inline_queries,
        });
        (0, group_events_1.setupDefaultMenuButton)(bot).catch(err => {
            logger_1.logger.error('Failed to setup default menu button:', err);
        });
    });
    return bot;
}
async function startPolling(bot) {
    try {
        logger_1.logger.info('🔄 Удаление webhook перед запуском polling...');
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        logger_1.logger.info('✅ Webhook удален');
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
        poll_reminder_service_1.PollReminderService.cancelAllReminders();
        await bot.stop();
        logger_1.logger.info('🛑 Бот остановлен');
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка остановки бота:', error);
    }
}
function getBotInstance() {
    return botInstance;
}
//# sourceMappingURL=bot.js.map