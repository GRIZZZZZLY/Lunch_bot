import { CallbackQueryContext, Context } from 'grammy';
import { BotContext } from '../../types/bot.types';
export declare function handleVote(ctx: CallbackQueryContext<BotContext>, pollId: number, menuItemId: number): Promise<void>;
export declare function handleBringOwnVote(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleSkipVote(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleCompletePoll(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleRefreshPoll(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleShowResults(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleRunRoulette(ctx: CallbackQueryContext<BotContext> | Context, pollId: number): Promise<void>;
export declare function handleCancelPoll(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleShowResultsWithoutComplete(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handleOpenPollButton(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void>;
export declare function handlePollCallback(ctx: CallbackQueryContext<BotContext>): Promise<void>;
export declare function handleStartPoll(ctx: BotContext): Promise<void>;
//# sourceMappingURL=poll.handlers.d.ts.map