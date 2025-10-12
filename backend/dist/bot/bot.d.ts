import { Bot } from 'grammy';
import { BotContext } from '../types/bot.types';
export declare function createBot(): Bot<BotContext>;
export declare function startPolling(bot: Bot<BotContext>): Promise<void>;
export declare function setupWebhook(bot: Bot<BotContext>, webhookUrl: string): Promise<void>;
export declare function stopBot(bot: Bot<BotContext>): Promise<void>;
export declare function getBotInstance(): Bot<BotContext> | null;
//# sourceMappingURL=bot.d.ts.map