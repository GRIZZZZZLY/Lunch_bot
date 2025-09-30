export declare const BOT_CONSTANTS: {
    readonly COMMANDS: {
        readonly START: "start";
        readonly HELP: "help";
        readonly MENU: "menu";
        readonly START_POLL: "startpoll";
        readonly HISTORY: "history";
        readonly SETTINGS: "settings";
    };
    readonly CALLBACK_ACTIONS: {
        readonly VOTE: "vote";
        readonly END_POLL: "end_poll";
        readonly CANCEL_POLL: "cancel_poll";
        readonly VIEW_RESULTS: "view_results";
        readonly ROULETTE: "roulette";
    };
    readonly LIMITS: {
        readonly MAX_POLL_DURATION: 120;
        readonly MIN_POLL_DURATION: 1;
        readonly MAX_MENU_ITEMS: 20;
        readonly MIN_MENU_ITEMS: 2;
        readonly MAX_MESSAGE_LENGTH: 4096;
        readonly RATE_LIMIT_REQUESTS: 30;
    };
    readonly DEFAULTS: {
        readonly POLL_DURATION: 30;
        readonly PAGE_SIZE: 10;
        readonly AUTO_ROULETTE: true;
        readonly NOTIFICATION_DELAY: 5;
    };
    readonly MESSAGES: {
        readonly WELCOME: "🍽️ Добро пожаловать в Food Bot!\n\nЯ помогу вам выбрать еду для заказа с помощью голосования и рулетки.";
        readonly HELP: "🤖 *Доступные команды:*\n\n/start - Начать работу с ботом\n/help - Показать эту справку  \n/menu - Открыть меню управления блюдами\n/startpoll - Запустить голосование за еду (только админы)\n/history - Показать историю голосований\n\n🎲 *Как это работает:*\n1. Админы добавляют блюда в меню через Mini App\n2. Запускают голосование командой /startpoll\n3. Участники голосуют за понравившиеся блюда\n4. После окончания рулетка выбирает ответственного за заказ";
        readonly NOT_ADMIN: "❌ Эта команда доступна только администраторам группы.";
        readonly GROUP_ONLY: "❌ Эта команда работает только в группах.";
        readonly PRIVATE_ONLY: "❌ Эта команда работает только в личных сообщениях.";
        readonly MENU_EMPTY: "📝 Меню пусто! Сначала добавьте блюда через команду /menu";
        readonly POLL_ALREADY_ACTIVE: "⏰ В этой группе уже идет голосование!";
        readonly POLL_NOT_FOUND: "❌ Активное голосование не найдено.";
        readonly USER_ALREADY_VOTED: "✅ Вы уже проголосовали в этом голосовании!";
        readonly POLL_STARTED: "🗳️ *Голосование началось!*\n\nВыберите блюдо, за которое хотите проголосовать:";
        readonly POLL_ENDED: "⏱️ *Голосование завершено!*";
        readonly POLL_CANCELLED: "❌ *Голосование отменено администратором.*";
        readonly ROULETTE_START: "🎲 *Запускаем рулетку...*\n\nОпределяем ответственного за заказ...";
        readonly ROULETTE_RESULT: "🎉 *Результаты голосования:*\n\n🥇 **Победитель:** {winner}\n👤 **Ответственный за заказ:** {responsible}";
        readonly ERROR_GENERIC: "❌ Произошла ошибка. Попробуйте позже.";
        readonly ERROR_DATABASE: "💾 Ошибка базы данных. Обратитесь к администратору.";
        readonly ERROR_RATE_LIMIT: "⏳ Слишком много запросов. Подождите немного.";
    };
    readonly EMOJIS: {
        readonly FOOD: "🍽️";
        readonly VOTE: "🗳️";
        readonly ROULETTE: "🎲";
        readonly WINNER: "🏆";
        readonly RESPONSIBLE: "👤";
        readonly TIME: "⏰";
        readonly SUCCESS: "✅";
        readonly ERROR: "❌";
        readonly WARNING: "⚠️";
        readonly INFO: "ℹ️";
        readonly LOADING: "⏳";
        readonly FIRE: "🔥";
        readonly STAR: "⭐";
        readonly PIZZA: "🍕";
        readonly BURGER: "🍔";
        readonly PASTA: "🍝";
        readonly SALAD: "🥗";
        readonly COFFEE: "☕";
    };
    readonly COLORS: {
        readonly SUCCESS: "\u001B[32m";
        readonly ERROR: "\u001B[31m";
        readonly WARNING: "\u001B[33m";
        readonly INFO: "\u001B[36m";
        readonly RESET: "\u001B[0m";
    };
};
export declare const API_CONSTANTS: {
    readonly STATUS_CODES: {
        readonly OK: 200;
        readonly CREATED: 201;
        readonly NO_CONTENT: 204;
        readonly BAD_REQUEST: 400;
        readonly UNAUTHORIZED: 401;
        readonly FORBIDDEN: 403;
        readonly NOT_FOUND: 404;
        readonly CONFLICT: 409;
        readonly UNPROCESSABLE_ENTITY: 422;
        readonly TOO_MANY_REQUESTS: 429;
        readonly INTERNAL_SERVER_ERROR: 500;
    };
    readonly VERSIONS: {
        readonly V1: "v1";
    };
    readonly ENDPOINTS: {
        readonly HEALTH: "/health";
        readonly AUTH: "/auth";
        readonly MENU: "/menu";
        readonly POLLS: "/polls";
        readonly STATS: "/stats";
        readonly WEBHOOK: "/webhook";
    };
    readonly HEADERS: {
        readonly AUTHORIZATION: "Authorization";
        readonly CONTENT_TYPE: "Content-Type";
        readonly USER_AGENT: "User-Agent";
        readonly X_TELEGRAM_BOT_API_SECRET_TOKEN: "X-Telegram-Bot-Api-Secret-Token";
    };
    readonly CONTENT_TYPES: {
        readonly JSON: "application/json";
        readonly FORM_DATA: "multipart/form-data";
        readonly URL_ENCODED: "application/x-www-form-urlencoded";
    };
};
export declare const DB_CONSTANTS: {
    readonly TABLES: {
        readonly USERS: "users";
        readonly GROUPS: "groups";
        readonly MENU_ITEMS: "menu_items";
        readonly POLLS: "polls";
        readonly VOTES: "votes";
        readonly POLL_RESULTS: "poll_results";
    };
    readonly POLL_STATUS: {
        readonly ACTIVE: "ACTIVE";
        readonly COMPLETED: "COMPLETED";
        readonly CANCELLED: "CANCELLED";
    };
    readonly GROUP_TYPES: {
        readonly GROUP: "group";
        readonly SUPERGROUP: "supergroup";
        readonly CHANNEL: "channel";
    };
};
export declare const REGEX: {
    readonly TELEGRAM_ID: RegExp;
    readonly USERNAME: RegExp;
    readonly CALLBACK_DATA: RegExp;
    readonly PRICE: RegExp;
    readonly URL: RegExp;
};
export declare const TIME: {
    readonly SECOND: 1000;
    readonly MINUTE: number;
    readonly HOUR: number;
    readonly DAY: number;
    readonly WEEK: number;
    readonly MONTH: number;
};
//# sourceMappingURL=constants.d.ts.map