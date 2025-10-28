"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston = __importStar(require("winston"));
const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'combined';
const developmentFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.colorize(), winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
        logMessage += `\n${stack}`;
    }
    return logMessage;
}));
const productionFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());
const loggerFormat = process.env.NODE_ENV === 'production'
    ? productionFormat
    : developmentFormat;
const transports = [
    new winston.transports.Console({
        level: logLevel,
        handleExceptions: true,
        handleRejections: true
    })
];
if (process.env.NODE_ENV === 'production') {
    transports.push(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        handleExceptions: true,
        handleRejections: true,
        maxsize: 5242880,
        maxFiles: 5,
    }), new winston.transports.File({
        filename: 'logs/combined.log',
        handleExceptions: true,
        handleRejections: true,
        maxsize: 5242880,
        maxFiles: 5,
    }));
}
exports.logger = winston.createLogger({
    level: logLevel,
    format: loggerFormat,
    transports,
    exitOnError: false,
});
exports.logger.exceptions.handle(new winston.transports.Console({
    format: loggerFormat
}));
exports.logger.rejections.handle(new winston.transports.Console({
    format: loggerFormat
}));
exports.logger.info('🔍 Logger инициализирован', {
    level: logLevel,
    environment: process.env.NODE_ENV || 'development',
    transports: transports.length
});
