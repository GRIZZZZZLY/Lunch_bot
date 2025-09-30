"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("./database/client");
const logger_1 = require("./utils/logger");
const bot_config_1 = require("./config/bot.config");
const bot_1 = require("./bot/bot");
const server_1 = require("./api/server");
dotenv_1.default.config();
const bot = (0, bot_1.createBot)();
const app = (0, server_1.createApiServer)();
process.on('SIGINT', async () => {
    logger_1.logger.info('Получен сигнал SIGINT, завершаем приложение...');
    try {
        await (0, bot_1.stopBot)(bot);
        await (0, client_1.disconnect)();
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Ошибка при завершении приложения:', error);
        process.exit(1);
    }
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('Получен сигнал SIGTERM, завершаем приложение...');
    try {
        await (0, bot_1.stopBot)(bot);
        await (0, client_1.disconnect)();
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Ошибка при завершении приложения:', error);
        process.exit(1);
    }
});
async function startApplication() {
    try {
        logger_1.logger.info('Запуск Telegram Food Bot...');
        const dbConnected = await (0, client_1.testConnection)();
        if (!dbConnected) {
            throw new Error('Не удалось подключиться к базе данных');
        }
        if (process.env.NODE_ENV === 'production' && bot_config_1.botConfig.webhookUrl) {
            await (0, bot_1.setupWebhook)(bot, bot_config_1.botConfig.webhookUrl);
            app.use(`/webhook`, async (req, res) => {
                try {
                    await bot.handleUpdate(req.body);
                    res.sendStatus(200);
                }
                catch (error) {
                    logger_1.logger.error('Ошибка обработки webhook:', error);
                    res.sendStatus(500);
                }
            });
        }
        else {
            await (0, bot_1.startPolling)(bot);
        }
        (0, server_1.startApiServer)(app);
        logger_1.logger.info('✅ Приложение успешно запущено');
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка при запуске приложения:', error);
        process.exit(1);
    }
}
startApplication();
//# sourceMappingURL=index.js.map