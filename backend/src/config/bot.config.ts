import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

export const botConfig = {
  // Telegram Bot Token (обязательный)
  token: process.env.BOT_TOKEN || '',
  
  // Webhook URL для production
  webhookUrl: process.env.BOT_WEBHOOK_URL || '',

  // Секрет проверяется в заголовке каждого запроса от Telegram
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  
  // Секретный ключ для валидации Telegram данных
  secretKey: process.env.TELEGRAM_SECRET_KEY || process.env.BOT_TOKEN || '',
  
  // Прокси настройки (для обхода блокировок)
  proxy: {
    enabled: process.env.USE_PROXY === 'true',
    url: process.env.PROXY_URL || '', // http://user:pass@host:port или socks5://host:port
  },
  
  // Локальный Telegram Bot API сервер
  localApi: {
    enabled: process.env.USE_LOCAL_API === 'true',
    url: process.env.LOCAL_API_URL || 'http://localhost:8081',
  },
  
  // Режим работы: ВСЕГДА используем BOT_MODE, по умолчанию polling
  // ⛔ ВАЖНО: webhook отключен, используем только polling!
  mode: (process.env.BOT_MODE as 'webhook' | 'polling') || 'polling',
  
  // Настройки polling
  polling: {
    // Интервал между запросами (мс)
    interval: parseInt(process.env.POLLING_INTERVAL || '1000'),
    
    // Таймаут для long polling (секунды)
    timeout: parseInt(process.env.POLLING_TIMEOUT || '30'),
    
    // Максимальное количество обновлений за запрос
    limit: parseInt(process.env.POLLING_LIMIT || '100'),
  },
  
  // Настройки webhook
  webhook: {
    // Порт для webhook сервера
    port: parseInt(process.env.WEBHOOK_PORT || '8443'),
    
    // Стабильный путь без токена и других секретов
    path: '/webhook',
    
    // SSL настройки (если нужны)
    ssl: {
      enabled: process.env.WEBHOOK_SSL_ENABLED === 'true',
      cert: process.env.WEBHOOK_SSL_CERT || '',
      key: process.env.WEBHOOK_SSL_KEY || '',
    },
  },
  
  // Ограничения
  limits: {
    // Максимальное количество запросов от пользователя в минуту
    userRequestsPerMinute: parseInt(process.env.USER_RATE_LIMIT || '30'),
    
    // Максимальная длина сообщения
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '4096'),
    
    // Максимальное количество участников в голосовании
    maxPollParticipants: parseInt(process.env.MAX_POLL_PARTICIPANTS || '100'),
    
    // Время жизни голосования по умолчанию (минуты)
    defaultPollDuration: parseInt(process.env.DEFAULT_POLL_DURATION || '30'),
  },
  
  // Настройки команд
  commands: {
    // Включить команды в групповых чатах
    enableInGroups: process.env.ENABLE_COMMANDS_IN_GROUPS !== 'false',
    
    // Включить команды в личных сообщениях
    enableInPrivate: process.env.ENABLE_COMMANDS_IN_PRIVATE !== 'false',
    
    // Префикс для команд (по умолчанию '/')
    prefix: process.env.COMMAND_PREFIX || '/',
  },
  
  // Логирование
  logging: {
    // Уровень логирования для бота
    level: process.env.BOT_LOG_LEVEL || 'info',
    
    // Логировать все сообщения
    logAllMessages: process.env.LOG_ALL_MESSAGES === 'true',
    
    // Логировать callback queries
    logCallbacks: process.env.LOG_CALLBACKS === 'true',
  },
  
  // Администраторы по умолчанию (Telegram User IDs)
  defaultAdmins: process.env.DEFAULT_ADMINS?.split(',').map(id => id.trim()).filter(Boolean) || [],
  
  // Mini App настройки
  miniApp: {
    url: process.env.VITE_APP_URL || 'https://your-domain.com/miniapp',
    shortName: process.env.MINI_APP_SHORT_NAME || 'app',
  },
  
  // WebApp URL
  webappUrl: process.env.WEBAPP_URL || 'http://localhost:5173',
  
  // Функции
  features: {
    // Включить систему голосований
    enablePolls: process.env.ENABLE_POLLS !== 'false',
    
    // Включить рулетку
    enableRoulette: process.env.ENABLE_ROULETTE !== 'false',
    
    // Включить статистику
    enableStats: process.env.ENABLE_STATS !== 'false',
    
    // Включить уведомления
    enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
  },
  
  // Тексты и сообщения
  messages: {
    // Приветственное сообщение
    welcome: process.env.WELCOME_MESSAGE || 'Добро пожаловать в Telegram Food Bot! 🤖',
    
    // Сообщение о недостатке прав
    noPermission: process.env.NO_PERMISSION_MESSAGE || 'У вас недостаточно прав для выполнения этой команды.',
    
    // Сообщение об ошибке
    error: process.env.ERROR_MESSAGE || 'Произошла ошибка. Попробуйте позже.',
  },
};

// Валидация конфигурации
function validateConfig() {
  const errors: string[] = [];
  
  if (!botConfig.token) {
    errors.push('BOT_TOKEN is required');
  }
  
  if (botConfig.mode === 'webhook' && !botConfig.webhookUrl) {
    errors.push('BOT_WEBHOOK_URL is required for webhook mode');
  }

  if (
    botConfig.mode === 'webhook' &&
    !/^[A-Za-z0-9_-]{32,256}$/.test(botConfig.webhookSecret)
  ) {
    errors.push(
      'TELEGRAM_WEBHOOK_SECRET must contain 32-256 letters, digits, underscores or hyphens in webhook mode'
    );
  }
  
  if (botConfig.polling.interval < 100) {
    errors.push('POLLING_INTERVAL must be at least 100ms');
  }
  
  if (botConfig.limits.userRequestsPerMinute < 1) {
    errors.push('USER_RATE_LIMIT must be at least 1');
  }
  
  if (errors.length > 0) {
    throw new Error(`Bot configuration errors:\n${errors.join('\n')}`);
  }
}

// Валидируем конфигурацию при загрузке
validateConfig();

export default botConfig;
