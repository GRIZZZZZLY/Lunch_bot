"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotErrorCodes = exports.BotError = exports.BotPollStatus = void 0;
var BotPollStatus;
(function (BotPollStatus) {
    BotPollStatus["WAITING"] = "waiting";
    BotPollStatus["ACTIVE"] = "active";
    BotPollStatus["ENDED"] = "ended";
    BotPollStatus["CANCELLED"] = "cancelled";
})(BotPollStatus || (exports.BotPollStatus = BotPollStatus = {}));
class BotError extends Error {
    code;
    isPublic;
    constructor(message, code, isPublic = true) {
        super(message);
        this.name = 'BotError';
        this.code = code;
        this.isPublic = isPublic;
    }
}
exports.BotError = BotError;
var BotErrorCodes;
(function (BotErrorCodes) {
    BotErrorCodes["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    BotErrorCodes["GROUP_NOT_FOUND"] = "GROUP_NOT_FOUND";
    BotErrorCodes["POLL_NOT_FOUND"] = "POLL_NOT_FOUND";
    BotErrorCodes["MENU_EMPTY"] = "MENU_EMPTY";
    BotErrorCodes["POLL_ALREADY_ACTIVE"] = "POLL_ALREADY_ACTIVE";
    BotErrorCodes["POLL_NOT_ACTIVE"] = "POLL_NOT_ACTIVE";
    BotErrorCodes["USER_ALREADY_VOTED"] = "USER_ALREADY_VOTED";
    BotErrorCodes["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    BotErrorCodes["INVALID_CALLBACK_DATA"] = "INVALID_CALLBACK_DATA";
    BotErrorCodes["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    BotErrorCodes["DATABASE_ERROR"] = "DATABASE_ERROR";
})(BotErrorCodes || (exports.BotErrorCodes = BotErrorCodes = {}));
