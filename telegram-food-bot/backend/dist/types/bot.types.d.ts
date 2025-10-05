import { Context, SessionFlavor } from 'grammy';
import { User, Group } from './database.types';
export interface SessionData {
    user?: User;
    step?: string;
    tempData?: any;
}
export interface BotContextExtension {
    dbUser?: User;
    dbGroup?: Group;
    chatId?: string;
}
export type BotContext = Context & SessionFlavor<SessionData> & BotContextExtension;
export interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
}
export interface TelegramChat {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    all_members_are_administrators?: boolean;
}
export interface InlineKeyboardButton {
    text: string;
    callback_data?: string;
    url?: string;
    web_app?: {
        url: string;
    };
}
export interface CallbackData {
    action: string;
    data?: any;
}
export type BotCommand = 'start' | 'help' | 'menu' | 'startpoll' | 'history' | 'settings';
export interface BotMiddleware {
    name: string;
    handler: (ctx: BotContext, next: () => Promise<void>) => Promise<void>;
}
export type CommandHandler = (ctx: BotContext) => Promise<void>;
export type CallbackHandler = (ctx: BotContext) => Promise<void>;
export interface BotCommandConfig {
    command: string;
    description: string;
    adminOnly?: boolean;
    groupOnly?: boolean;
    privateOnly?: boolean;
}
export declare enum BotPollStatus {
    WAITING = "waiting",
    ACTIVE = "active",
    ENDED = "ended",
    CANCELLED = "cancelled"
}
export interface PollData {
    id: number;
    groupId: number;
    messageId?: number;
    status: BotPollStatus;
    items: Array<{
        id: number;
        name: string;
        votes: number;
    }>;
    totalVotes: number;
    startedAt: Date;
    endsAt: Date;
    createdBy: number;
}
export interface RouletteResult {
    winner: {
        id: number;
        name: string;
        votes: number;
    };
    responsible: {
        id: number;
        firstName: string;
        username?: string;
    };
    animation: string[];
}
export declare class BotError extends Error {
    readonly code: string;
    readonly isPublic: boolean;
    constructor(message: string, code: string, isPublic?: boolean);
}
export declare enum BotErrorCodes {
    USER_NOT_FOUND = "USER_NOT_FOUND",
    GROUP_NOT_FOUND = "GROUP_NOT_FOUND",
    POLL_NOT_FOUND = "POLL_NOT_FOUND",
    MENU_EMPTY = "MENU_EMPTY",
    POLL_ALREADY_ACTIVE = "POLL_ALREADY_ACTIVE",
    POLL_NOT_ACTIVE = "POLL_NOT_ACTIVE",
    USER_ALREADY_VOTED = "USER_ALREADY_VOTED",
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
    INVALID_CALLBACK_DATA = "INVALID_CALLBACK_DATA",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    DATABASE_ERROR = "DATABASE_ERROR"
}
//# sourceMappingURL=bot.types.d.ts.map