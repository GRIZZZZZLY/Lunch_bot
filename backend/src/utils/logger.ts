import * as winston from 'winston';
import { getRequestContext } from './request-context';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'combined';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Winston format that merges AsyncLocalStorage request context into each log
 * info object. Any logger.info/error/warn called during an HTTP request
 * automatically carries requestId/userId without explicit threading.
 */
const requestContextFormat = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    if (ctx.requestId && !info.requestId) info.requestId = ctx.requestId;
    if (ctx.userId !== undefined && info.userId === undefined) info.userId = ctx.userId;
  }
  return info;
});

const SENSITIVE_LOG_KEY =
  /^(authorization|cookie|set-cookie|.*token.*|.*secret.*|password|initdata.*|telegramid|chatid|username|firstname|lastname|photourl|avatarurl|fileid|filepath|payment(card|phone|details)?|invoicepayload|.*chargeid|callbackdata|fulltext|messagetext|body|query|url|error|stack|description)$/i;

function redactLogValue(value: unknown, depth: number = 0): unknown {
  if (depth > 8) {
    return '[Truncated]';
  }
  if (Array.isArray(value)) {
    return value.map(item => redactLogValue(item, depth + 1));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Error) {
    if (isProduction) {
      return { name: value.name };
    }
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = SENSITIVE_LOG_KEY.test(key)
      ? '[Filtered]'
      : redactLogValue(nested, depth + 1);
  }
  return result;
}

const sensitiveDataFormat = winston.format(info => {
  for (const key of Object.keys(info)) {
    if (key === 'message' || key === 'level' || key === 'timestamp') {
      continue;
    }
    info[key] = SENSITIVE_LOG_KEY.test(key)
      ? '[Filtered]'
      : redactLogValue(info[key]);
  }
  return info;
});

// Кастомный формат для красивых логов в development
const developmentFormat = winston.format.combine(
  requestContextFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  sensitiveDataFormat(),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )}`;
    }
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Сериализатор BigInt для JSON
const bigIntReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value;

// Формат для production
const productionFormat = winston.format.combine(
  requestContextFormat(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format(info => {
    if (info.exception || info.rejection) {
      info.message = info.exception
        ? 'Unhandled process exception'
        : 'Unhandled promise rejection';
      delete info.trace;
      delete info.process;
      delete info.os;
      delete info.date;
    }
    delete info.stack;
    return info;
  })(),
  sensitiveDataFormat(),
  winston.format.printf((info) => JSON.stringify(info, bigIntReplacer))
);

// Выбор формата в зависимости от окружения
const loggerFormat = process.env.NODE_ENV === 'production' 
  ? productionFormat 
  : developmentFormat;

// Транспорты для логов
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: logLevel,
    handleExceptions: true,
    handleRejections: true
  })
];

// В production добавляем файловые логи
if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      handleExceptions: true,
      handleRejections: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      handleExceptions: true,
      handleRejections: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Создание логгера
export const logger = winston.createLogger({
  level: logLevel,
  format: loggerFormat,
  transports,
  // Необработанное исключение означает неизвестное состояние процесса.
  // После записи журнала Winston обязан завершить его, чтобы оркестратор
  // мог безопасно перезапустить экземпляр.
  exitOnError: true,
});

// Тестовые логи при запуске
logger.info('🔍 Logger инициализирован', {
  level: logLevel,
  environment: process.env.NODE_ENV || 'development',
  transports: transports.length
});
