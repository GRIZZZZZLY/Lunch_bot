"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'combined';
const developmentFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
        logMessage += `\n${stack}`;
    }
    return logMessage;
}));
const productionFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const loggerFormat = process.env.NODE_ENV === 'production'
    ? productionFormat
    : developmentFormat;
const transports = [
    new winston_1.default.transports.Console({
        level: logLevel,
        handleExceptions: true,
        handleRejections: true
    })
];
if (process.env.NODE_ENV === 'production') {
    transports.push(new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        handleExceptions: true,
        handleRejections: true,
        maxsize: 5242880,
        maxFiles: 5,
    }), new winston_1.default.transports.File({
        filename: 'logs/combined.log',
        handleExceptions: true,
        handleRejections: true,
        maxsize: 5242880,
        maxFiles: 5,
    }));
}
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: loggerFormat,
    transports,
    exitOnError: false,
});
exports.logger.exceptions.handle(new winston_1.default.transports.Console({
    format: loggerFormat
}));
exports.logger.rejections.handle(new winston_1.default.transports.Console({
    format: loggerFormat
}));
exports.logger.info('🔍 Logger инициализирован', {
    level: logLevel,
    environment: process.env.NODE_ENV || 'development',
    transports: transports.length
});
//# sourceMappingURL=logger.js.map