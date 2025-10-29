"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebAppButton = createWebAppButton;
exports.createVoteWebAppKeyboard = createVoteWebAppKeyboard;
exports.createMenuWebAppKeyboard = createMenuWebAppKeyboard;
exports.createPollWebAppKeyboard = createPollWebAppKeyboard;
exports.createResultsWebAppKeyboard = createResultsWebAppKeyboard;
exports.createPollActionsKeyboard = createPollActionsKeyboard;
exports.createResponsibleKeyboard = createResponsibleKeyboard;
const bot_config_1 = require("../../config/bot.config");
const WEBAPP_URL = bot_config_1.botConfig.webappUrl || process.env.WEBAPP_URL || 'http://localhost:5173';
function createWebAppButton(text, path = '') {
    const url = path ? `${WEBAPP_URL}${path}` : WEBAPP_URL;
    return {
        text,
        web_app: { url }
    };
}
function createVoteWebAppKeyboard(pollId) {
    const botUsername = process.env.BOT_USERNAME || 'rocket_lunch_bot';
    return {
        inline_keyboard: [[
                {
                    text: '🗳️ Проголосовать',
                    url: `https://t.me/${botUsername}?start=vote_${pollId}`
                }
            ]]
    };
}
function createMenuWebAppKeyboard() {
    return {
        inline_keyboard: [[
                createWebAppButton('📋 Открыть меню', '/menu')
            ]]
    };
}
function createPollWebAppKeyboard() {
    return {
        inline_keyboard: [[
                createWebAppButton('➕ Создать голосование', '/poll/create')
            ]]
    };
}
function createResultsWebAppKeyboard(pollId) {
    return {
        inline_keyboard: [[
                createWebAppButton('📊 Посмотреть результаты', `/poll/${pollId}/results`)
            ]]
    };
}
function createPollActionsKeyboard(pollId, showResults = false) {
    const buttons = [];
    buttons.push([
        createWebAppButton('🗳️ Проголосовать', `/poll/${pollId}`)
    ]);
    if (showResults) {
        buttons.push([
            createWebAppButton('📊 Результаты', `/poll/${pollId}/results`)
        ]);
    }
    return {
        inline_keyboard: buttons
    };
}
function createResponsibleKeyboard(pollId) {
    return {
        inline_keyboard: [
            [createWebAppButton('📋 Детали заказа', `/poll/${pollId}/order`)],
            [createWebAppButton('💰 Информация о платежах', '/payments')]
        ]
    };
}
//# sourceMappingURL=webapp.keyboard.js.map