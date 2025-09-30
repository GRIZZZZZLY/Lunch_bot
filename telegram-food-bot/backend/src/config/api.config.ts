import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные окружения
dotenv.config();

export const apiConfig = {
  // Сервер
  host: process.env.API_HOST || '0.0.0.0',
  port: parseInt(process.env.API_PORT || '3001'),
  
  // Базовый URL API
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  
  // CORS настройки
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    optionsSuccessStatus: 200,
  },
  
  // Легаси поле для обратной совместимости
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173',
  
  // Безопасность
  security: {
    // Включить helmet middleware
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    
    // Включить rate limiting
    enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
    
    // Максимальное количество запросов в минуту на IP
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    
    // Окно для rate limiting (минуты)
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
    
    // JWT настройки
    jwt: {
      secret: process.env.JWT_SECRET || process.env.BOT_TOKEN || 'fallback-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
  },
  
  // Загрузка файлов
  upload: {
    // Максимальный размер файла в MB
    maxSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5'),
    
    // Разрешенные типы файлов
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
    
    // Путь для сохранения файлов
    path: path.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads'),
  },
  
  // Легаси поля для обратной совместимости
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5'),
  uploadPath: path.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads'),
  
  // Логирование
  logging: {
    // Уровень логирования для API
    level: process.env.API_LOG_LEVEL || 'info',
    
    // Логировать все запросы
    logRequests: process.env.LOG_REQUESTS !== 'false',
    
    // Логировать тела запросов
    logRequestBodies: process.env.LOG_REQUEST_BODIES === 'true',
    
    // Логировать заголовки
    logHeaders: process.env.LOG_HEADERS === 'true',
  },
  
  // Пагинация
  pagination: {
    // Размер страницы по умолчанию
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '20'),
    
    // Максимальный размер страницы
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100'),
  },
  
  // Кеширование
  cache: {
    // Включить кеширование
    enabled: process.env.ENABLE_CACHE === 'true',
    
    // TTL по умолчанию (секунды)
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
    
    // Redis настройки (если используется)
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB || '0'),
    },
  },
  
  // База данных
  database: {
    url: process.env.DATABASE_URL || '',
    
    // Настройки подключения
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
    },
    
    // Таймауты
    timeouts: {
      query: parseInt(process.env.DB_QUERY_TIMEOUT || '10000'),
      transaction: parseInt(process.env.DB_TRANSACTION_TIMEOUT || '30000'),
    },
  },
  
  // Валидация
  validation: {
    // Строгая валидация (отклонять дополнительные поля)
    strict: process.env.VALIDATION_STRICT === 'true',
    
    // Максимальная глубина вложенности объектов
    maxDepth: parseInt(process.env.VALIDATION_MAX_DEPTH || '5'),
  },
  
  // Мониторинг и метрики
  monitoring: {
    // Включить метрики Prometheus
    enablePrometheus: process.env.ENABLE_PROMETHEUS === 'true',
    
    // Путь для метрик
    metricsPath: process.env.METRICS_PATH || '/metrics',
    
    // Включить health checks
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
    
    // Путь для health check
    healthPath: process.env.HEALTH_PATH || '/health',
  },
  
  // Swagger/OpenAPI документация
  swagger: {
    // Включить Swagger UI
    enabled: process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV === 'development',
    
    // Путь для Swagger UI
    path: process.env.SWAGGER_PATH || '/api-docs',
    
    // Информация об API
    info: {
      title: 'Telegram Food Bot API',
      version: '1.0.0',
      description: 'API для управления меню и голосованиями в Telegram Food Bot',
    },
  },
  
  // Внешние сервисы
  external: {
    // Telegram Bot API
    telegram: {
      apiUrl: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
      timeout: parseInt(process.env.TELEGRAM_TIMEOUT || '10000'),
    },
    
    // Webhook для уведомлений
    webhooks: {
      enabled: process.env.ENABLE_WEBHOOKS === 'true',
      urls: process.env.WEBHOOK_URLS?.split(',').map(u => u.trim()).filter(Boolean) || [],
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000'),
      retries: parseInt(process.env.WEBHOOK_RETRIES || '3'),
    },
  },
};

// Валидация конфигурации
function validateApiConfig() {
  const errors: string[] = [];
  
  if (apiConfig.port < 1 || apiConfig.port > 65535) {
    errors.push('API_PORT must be between 1 and 65535');
  }
  
  if (!apiConfig.database.url) {
    errors.push('DATABASE_URL is required');
  }
  
  if (apiConfig.upload.maxSizeMB < 1) {
    errors.push('MAX_FILE_SIZE_MB must be at least 1');
  }
  
  if (apiConfig.pagination.defaultLimit > apiConfig.pagination.maxLimit) {
    errors.push('DEFAULT_PAGE_LIMIT cannot be greater than MAX_PAGE_LIMIT');
  }
  
  if (!apiConfig.security.jwt.secret || apiConfig.security.jwt.secret === 'fallback-secret') {
    console.warn('Warning: Using fallback JWT secret. Set JWT_SECRET in production.');
  }
  
  if (errors.length > 0) {
    throw new Error(`API configuration errors:\n${errors.join('\n')}`);
  }
}

// Валидируем конфигурацию при загрузке
validateApiConfig();

export default apiConfig;
