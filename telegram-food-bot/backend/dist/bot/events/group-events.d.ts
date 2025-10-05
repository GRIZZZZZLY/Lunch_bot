import { BotContext } from '../../types/bot.types';
import { Bot } from 'grammy';
export declare function setupGroupEvents(bot: Bot<BotContext>): void;
export declare function setupMenuButtonForGroup(bot: Bot<BotContext>, chatId: number): Promise<void>;
export declare function setupDefaultMenuButton(bot: Bot<BotContext>): Promise<void>;
//# sourceMappingURL=group-events.d.ts.map