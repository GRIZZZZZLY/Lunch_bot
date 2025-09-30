"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIME = exports.REGEX = exports.DB_CONSTANTS = exports.API_CONSTANTS = exports.BOT_CONSTANTS = void 0;
exports.BOT_CONSTANTS = {
    COMMANDS: {
        START: 'start',
        HELP: 'help',
        MENU: 'menu',
        START_POLL: 'startpoll',
        HISTORY: 'history',
        SETTINGS: 'settings',
    },
    CALLBACK_ACTIONS: {
        VOTE: 'vote',
        END_POLL: 'end_poll',
        CANCEL_POLL: 'cancel_poll',
        VIEW_RESULTS: 'view_results',
        ROULETTE: 'roulette',
    },
    LIMITS: {
        MAX_POLL_DURATION: 120,
        MIN_POLL_DURATION: 1,
        MAX_MENU_ITEMS: 20,
        MIN_MENU_ITEMS: 2,
        MAX_MESSAGE_LENGTH: 4096,
        RATE_LIMIT_REQUESTS: 30,
    },
    DEFAULTS: {
        POLL_DURATION: 30,
        PAGE_SIZE: 10,
        AUTO_ROULETTE: true,
        NOTIFICATION_DELAY: 5,
    },
    MESSAGES: {
        WELCOME: '🍽️ Добро пожаловать в Food Bot!\n\nЯ помогу вам выбрать еду для заказа с помощью голосования и рулетки.',
        HELP: `🤖 *Доступные команды:*

/start - Начать работу с ботом
/help - Показать эту справку  
/menu - Открыть меню управления блюдами
/startpoll - Запустить голосование за еду (только админы)
/history - Показать историю голосований

🎲 *Как это работает:*
1. Админы добавляют блюда в меню через Mini App
2. Запускают голосование командой /startpoll
3. Участники голосуют за понравившиеся блюда
4. После окончания рулетка выбирает ответственного за заказ`,
        NOT_ADMIN: '❌ Эта команда доступна только администраторам группы.',
        GROUP_ONLY: '❌ Эта команда работает только в группах.',
        PRIVATE_ONLY: '❌ Эта команда работает только в личных сообщениях.',
        MENU_EMPTY: '📝 Меню пусто! Сначала добавьте блюда через команду /menu',
        POLL_ALREADY_ACTIVE: '⏰ В этой группе уже идет голосование!',
        POLL_NOT_FOUND: '❌ Активное голосование не найдено.',
        USER_ALREADY_VOTED: '✅ Вы уже проголосовали в этом голосовании!',
        POLL_STARTED: '🗳️ *Голосование началось!*\n\nВыберите блюдо, за которое хотите проголосовать:',
        POLL_ENDED: '⏱️ *Голосование завершено!*',
        POLL_CANCELLED: '❌ *Голосование отменено администратором.*',
        ROULETTE_START: '🎲 *Запускаем рулетку...*\n\nОпределяем ответственного за заказ...',
        ROULETTE_RESULT: '🎉 *Результаты голосования:*\n\n🥇 **Победитель:** {winner}\n👤 **Ответственный за заказ:** {responsible}',
        ERROR_GENERIC: '❌ Произошла ошибка. Попробуйте позже.',
        ERROR_DATABASE: '💾 Ошибка базы данных. Обратитесь к администратору.',
        ERROR_RATE_LIMIT: '⏳ Слишком много запросов. Подождите немного.',
    },
    EMOJIS: {
        FOOD: '🍽️',
        VOTE: '🗳️',
        ROULETTE: '🎲',
        WINNER: '🏆',
        RESPONSIBLE: '👤',
        TIME: '⏰',
        SUCCESS: '✅',
        ERROR: '❌',
        WARNING: '⚠️',
        INFO: 'ℹ️',
        LOADING: '⏳',
        FIRE: '🔥',
        STAR: '⭐',
        PIZZA: '🍕',
        BURGER: '🍔',
        PASTA: '🍝',
        SALAD: '🥗',
        COFFEE: '☕',
    },
    COLORS: {
        SUCCESS: '\x1b[32m',
        ERROR: '\x1b[31m',
        WARNING: '\x1b[33m',
        INFO: '\x1b[36m',
        RESET: '\x1b[0m',
    },
};
exports.API_CONSTANTS = {
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE_ENTITY: 422,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500,
    },
    VERSIONS: {
        V1: 'v1',
    },
    ENDPOINTS: {
        HEALTH: '/health',
        AUTH: '/auth',
        MENU: '/menu',
        POLLS: '/polls',
        STATS: '/stats',
        WEBHOOK: '/webhook',
    },
    HEADERS: {
        AUTHORIZATION: 'Authorization',
        CONTENT_TYPE: 'Content-Type',
        USER_AGENT: 'User-Agent',
        X_TELEGRAM_BOT_API_SECRET_TOKEN: 'X-Telegram-Bot-Api-Secret-Token',
    },
    CONTENT_TYPES: {
        JSON: 'application/json',
        FORM_DATA: 'multipart/form-data',
        URL_ENCODED: 'application/x-www-form-urlencoded',
    },
};
exports.DB_CONSTANTS = {
    TABLES: {
        USERS: 'users',
        GROUPS: 'groups',
        MENU_ITEMS: 'menu_items',
        POLLS: 'polls',
        VOTES: 'votes',
        POLL_RESULTS: 'poll_results',
    },
    POLL_STATUS: {
        ACTIVE: 'ACTIVE',
        COMPLETED: 'COMPLETED',
        CANCELLED: 'CANCELLED',
    },
    GROUP_TYPES: {
        GROUP: 'group',
        SUPERGROUP: 'supergroup',
        CHANNEL: 'channel',
    },
};
exports.REGEX = {
    TELEGRAM_ID: /^-?\d{1,15}$/,
    USERNAME: /^[a-zA-Z0-9_]{5,32}$/,
    CALLBACK_DATA: /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]*$/,
    PRICE: /^\d+(\.\d{1,2})?$/,
    URL: /^https?:\/\/.+/,
};
exports.TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
};
//# sourceMappingURL=constants.js.map