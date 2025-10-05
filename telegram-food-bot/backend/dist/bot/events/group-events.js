"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGroupEvents = setupGroupEvents;
exports.setupMenuButtonForGroup = setupMenuButtonForGroup;
exports.setupDefaultMenuButton = setupDefaultMenuButton;
const logger_1 = require("../../utils/logger");
const group_service_1 = require("../../services/group.service");
function setupGroupEvents(bot) {
    bot.on('my_chat_member', async (ctx) => {
        try {
            const oldStatus = ctx.myChatMember.old_chat_member.status;
            const newStatus = ctx.myChatMember.new_chat_member.status;
            const chat = ctx.chat;
            if ((oldStatus === 'left' || oldStatus === 'kicked') &&
                (newStatus === 'member' || newStatus === 'administrator')) {
                logger_1.logger.info('Bot added to group', {
                    chatId: chat.id,
                    title: chat.title,
                    type: chat.type,
                });
                if (chat.type === 'group' || chat.type === 'supergroup') {
                    await group_service_1.GroupService.createGroup({
                        telegramId: BigInt(chat.id),
                        title: chat.title || 'Unknown Group',
                        type: chat.type,
                    });
                    await setupMenuButtonForGroup(bot, chat.id);
                    const deepLink = `https://t.me/${ctx.me.username}?start=menu_${chat.id}`;
                    await ctx.reply('👋 *Привет! Я Rocket Lunch Bot*\n\n' +
                        'Я помогу организовать обед для вашей команды:\n' +
                        '• 🗳 Голосование за блюда\n' +
                        '• 🎲 Рулетка для выбора ответственного\n' +
                        '• 📊 Статистика и история\n\n' +
                        '🚀 Настройте меню один раз и пользуйтесь!', {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: '🍽 Настроить меню',
                                        url: deepLink,
                                    },
                                ],
                            ],
                        },
                    });
                }
            }
            if ((oldStatus === 'member' || oldStatus === 'administrator') &&
                (newStatus === 'left' || newStatus === 'kicked')) {
                logger_1.logger.info('Bot removed from group', {
                    chatId: chat.id,
                    title: chat.title,
                });
                if (chat.type === 'group' || chat.type === 'supergroup') {
                    await group_service_1.GroupService.deactivateGroup(BigInt(chat.id));
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling my_chat_member event:', error);
        }
    });
    bot.on('chat_member', async (ctx) => {
        try {
            const chat = ctx.chat;
            if (chat.type === 'group' || chat.type === 'supergroup') {
                await group_service_1.GroupService.updateGroup(BigInt(chat.id), {
                    title: chat.title,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling chat_member event:', error);
        }
    });
}
async function setupMenuButtonForGroup(bot, chatId) {
    try {
        const webappUrl = process.env.WEBAPP_URL || 'http://localhost:5173';
        await bot.api.setChatMenuButton({
            chat_id: chatId,
            menu_button: {
                type: 'web_app',
                text: '🍽 Меню',
                web_app: {
                    url: `${webappUrl}?groupId=${chatId}`,
                },
            },
        });
        logger_1.logger.info('Menu button set for group', { chatId });
    }
    catch (error) {
        logger_1.logger.error('Error setting menu button for group:', error);
    }
}
async function setupDefaultMenuButton(bot) {
    try {
        const webappUrl = process.env.WEBAPP_URL || 'http://localhost:5173';
        if (!webappUrl.startsWith('https://')) {
            logger_1.logger.warn('Menu button не установлен: WebApp URL должен использовать HTTPS', { webappUrl });
            return;
        }
        await bot.api.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '📋 Мои группы',
                web_app: {
                    url: webappUrl,
                },
            },
        });
        logger_1.logger.info('Default menu button set for private chats', { webappUrl });
    }
    catch (error) {
        logger_1.logger.error('Error setting default menu button:', error);
    }
}
//# sourceMappingURL=group-events.js.map