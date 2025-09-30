import { NextFunction } from 'grammy';
import { BotContext } from '../../types/bot.types';
export declare function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function adminMiddleware(): (ctx: BotContext, next: NextFunction) => Promise<void>;
export declare function groupAdminMiddleware(): (ctx: BotContext, next: NextFunction) => Promise<void>;
export declare function groupOnlyMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function privateOnlyMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function activeUserMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
export declare function registeredUserMiddleware(ctx: BotContext, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map