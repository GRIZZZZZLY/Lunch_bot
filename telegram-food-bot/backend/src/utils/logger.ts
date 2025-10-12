import * as winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'combined';

// Кастомный формат для красивых логов в development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Формат для production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
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
  exitOnError: false,
});

// Логирование необработанных исключений
logger.exceptions.handle(
  new winston.transports.Console({
    format: loggerFormat
  })
);

logger.rejections.handle(
  new winston.transports.Console({
    format: loggerFormat
  })
);

// Тестовые логи при запуске
logger.info('🔍 Logger инициализирован', {
  level: logLevel,
  environment: process.env.NODE_ENV || 'development',
  transports: transports.length
});
