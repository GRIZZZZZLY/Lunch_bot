import { NextFunction } from 'grammy';
import { BotContext } from '../../types/bot.types';
export declare function loggingMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function statsMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function errorLoggingMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function rateLimitMiddleware(maxRequests?: number, windowMs?: number): (ctx: BotContext, next: NextFunction) => Promise<void>;
export declare function commandLoggingMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
//# sourceMappingURL=logger.d.ts.map