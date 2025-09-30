export declare abstract class BaseError extends Error {
    readonly isOperational: boolean;
    readonly statusCode: number;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean);
}
export declare class ValidationError extends BaseError {
    readonly field?: string;
    readonly value?: any;
    constructor(message: string, field?: string, value?: any);
}
export declare class AuthenticationError extends BaseError {
    constructor(message?: string);
}
export declare class AuthorizationError extends BaseError {
    constructor(message?: string);
}
export declare class NotFoundError extends BaseError {
    constructor(resource?: string);
}
export declare class ConflictError extends BaseError {
    constructor(message?: string);
}
export declare class RateLimitError extends BaseError {
    readonly retryAfter: number;
    constructor(retryAfter?: number);
}
export declare class DatabaseError extends BaseError {
    constructor(message?: string, originalError?: Error);
}
export declare class BotError extends BaseError {
    readonly isPublic: boolean;
    readonly telegramId?: number;
    constructor(message: string, code?: string, isPublic?: boolean, telegramId?: number);
}
export declare class UserNotFoundError extends BotError {
    constructor(telegramId?: number);
}
export declare class GroupNotFoundError extends BotError {
    constructor(telegramId?: number);
}
export declare class MenuEmptyError extends BotError {
    constructor();
}
export declare class PollNotFoundError extends BotError {
    constructor();
}
export declare class PollAlreadyActiveError extends BotError {
    constructor();
}
export declare class UserAlreadyVotedError extends BotError {
    constructor();
}
export declare class InsufficientPermissionsError extends BotError {
    constructor();
}
export declare class InvalidCallbackDataError extends BotError {
    constructor();
}
export declare function isOperationalError(error: Error): boolean;
export declare function formatErrorForLogging(error: Error, context?: any): {
    name: string;
    message: string;
    stack: string | undefined;
    context: any;
} | {
    statusCode: number;
    code: string;
    isOperational: boolean;
    name: string;
    message: string;
    stack: string | undefined;
    context: any;
} | {
    isPublic: boolean;
    telegramId: number | undefined;
    name: string;
    message: string;
    stack: string | undefined;
    context: any;
};
export declare function setupErrorHandlers(): void;
export declare function errorHandler(err: Error, req: any, res: any, next: any): void;
//# sourceMappingURL=error.d.ts.map