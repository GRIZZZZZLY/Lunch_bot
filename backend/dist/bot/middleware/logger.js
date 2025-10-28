"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = loggingMiddleware;
exports.statsMiddleware = statsMiddleware;
exports.errorLoggingMiddleware = errorLoggingMiddleware;
exports.rateLimitMiddleware = rateLimitMiddleware;
exports.commandLoggingMiddleware = commandLoggingMiddleware;
const logger_1 = require("../../utils/logger");
async function loggingMiddleware(ctx, next) {
    const start = Date.now();
    logger_1.logger.info('Incoming update', {
        updateId: ctx.update.update_id,
        type: getUpdateType(ctx),
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        ...(ctx.message && { messageId: ctx.message.message_id }),
        ...(ctx.callbackQuery && { callbackData: ctx.callbackQuery.data }),
    });
    try {
        await next();
    }
    catch (error) {
        logger_1.logger.error('Error processing update', {
            updateId: ctx.update.update_id,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
    finally {
        const duration = Date.now() - start;
        logger_1.logger.info('Update processed', {
            updateId: ctx.update.update_id,
            duration: `${duration}ms`,
        });
    }
}
async function statsMiddleware(ctx, next) {
    try {
        const updateType = getUpdateType(ctx);
        const chatType = ctx.chat?.type || 'unknown';
        const userId = ctx.from?.id;
        logger_1.logger.debug('Stats collected', {
            updateType,
            chatType,
            userId,
            timestamp: new Date().toISOString(),
        });
        await next();
    }
    catch (error) {
        logger_1.logger.error('Stats middleware error:', error);
        await next();
    }
}
async function errorLoggingMiddleware(ctx, next) {
    try {
        await next();
    }
    catch (error) {
        logger_1.logger.error('Bot error occurred', {
            updateId: ctx.update.update_id,
            chatId: ctx.chat?.id,
            chatType: ctx.chat?.type,
            userId: ctx.from?.id,
            username: ctx.from?.username,
            error: {
                name: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
                stack: error instanceof Error ? error.stack : undefined,
            },
            context: {
                message: ctx.message?.text,
                callbackData: ctx.callbackQuery?.data,
                updateType: getUpdateType(ctx),
            },
        });
        try {
            await ctx.reply('❌ Произошла ошибка при обработке команды.\n\n' +
                'Мы уже знаем о проблеме и работаем над её устранением.', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔄 Попробовать снова', callback_data: 'retry' },
                            { text: '📞 Поддержка', callback_data: 'support' }
                        ]
                    ]
                }
            });
        }
        catch (replyError) {
            logger_1.logger.error('Failed to send error message to user:', replyError);
        }
        throw error;
    }
}
function rateLimitMiddleware(maxRequests = 30, windowMs = 60000) {
    const userRequests = new Map();
    return async function (ctx, next) {
        const userId = ctx.from?.id;
        if (!userId) {
            return next();
        }
        const now = Date.now();
        const userLimit = userRequests.get(userId);
        if (!userLimit || now > userLimit.resetTime) {
            userRequests.set(userId, {
                count: 1,
                resetTime: now + windowMs,
            });
            return next();
        }
        if (userLimit.count >= maxRequests) {
            logger_1.logger.warn('Rate limit exceeded', {
                userId,
                count: userLimit.count,
                maxRequests,
                windowMs,
            });
            await ctx.reply('⚠️ **Слишком много запросов**\n\n' +
                'Вы отправляете команды слишком часто. ' +
                'Пожалуйста, подождите немного перед следующим запросом.', { parse_mode: 'Markdown' });
            return;
        }
        userLimit.count++;
        return next();
    };
}
async function commandLoggingMiddleware(ctx, next) {
    const message = ctx.message;
    if (message?.text?.startsWith('/')) {
        const command = message.text.split(' ')[0];
        logger_1.logger.info('Command executed', {
            command,
            userId: ctx.from?.id,
            username: ctx.from?.username,
            chatId: ctx.chat?.id,
            chatType: ctx.chat?.type,
            messageId: message.message_id,
            fullText: message.text,
        });
    }
    return next();
}
function getUpdateType(ctx) {
    if (ctx.message)
        return 'message';
    if (ctx.editedMessage)
        return 'edited_message';
    if (ctx.channelPost)
        return 'channel_post';
    if (ctx.editedChannelPost)
        return 'edited_channel_post';
    if (ctx.inlineQuery)
        return 'inline_query';
    if (ctx.chosenInlineResult)
        return 'chosen_inline_result';
    if (ctx.callbackQuery)
        return 'callback_query';
    if (ctx.shippingQuery)
        return 'shipping_query';
    if (ctx.preCheckoutQuery)
        return 'pre_checkout_query';
    if (ctx.poll)
        return 'poll';
    if (ctx.pollAnswer)
        return 'poll_answer';
    if (ctx.myChatMember)
        return 'my_chat_member';
    if (ctx.chatMember)
        return 'chat_member';
    if (ctx.chatJoinRequest)
        return 'chat_join_request';
    return 'unknown';
}
