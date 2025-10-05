/**
 * Клавиатуры с WebApp кнопками
 */
import { botConfig } from '../../config/bot.config';

const WEBAPP_URL = botConfig.webappUrl || process.env.WEBAPP_URL || 'http://localhost:5173';

/**
 * Создать inline кнопку для открытия WebApp
 */
export function createWebAppButton(text: string, path: string = '') {
  const url = path ? `${WEBAPP_URL}${path}` : WEBAPP_URL;
  
  return {
    text,
    web_app: { url }
  };
}

/**
 * Клавиатура для голосования (открывает бота в личке через deep link)
 * ВАЖНО: web_app кнопки НЕ работают в групповых чатах!
 * Используем обычную URL кнопку с deep link
 */
export function createVoteWebAppKeyboard(pollId: number) {
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

/**
 * Клавиатура для просмотра меню (открывает WebApp)
 */
export function createMenuWebAppKeyboard() {
  return {
    inline_keyboard: [[
      createWebAppButton('📋 Открыть меню', '/menu')
    ]]
  };
}

/**
 * Клавиатура для создания голосования (открывает WebApp)
 */
export function createPollWebAppKeyboard() {
  return {
    inline_keyboard: [[
      createWebAppButton('➕ Создать голосование', '/poll/create')
    ]]
  };
}

/**
 * Клавиатура для результатов (открывает WebApp)
 */
export function createResultsWebAppKeyboard(pollId: number) {
  return {
    inline_keyboard: [[
      createWebAppButton('📊 Посмотреть результаты', `/poll/${pollId}/results`)
    ]]
  };
}

/**
 * Универсальная клавиатура с несколькими действиями
 */
export function createPollActionsKeyboard(pollId: number, showResults: boolean = false) {
  const buttons = [];
  
  // Кнопка голосования
  buttons.push([
    createWebAppButton('🗳️ Проголосовать', `/poll/${pollId}`)
  ]);
  
  // Кнопка результатов (если голосование завершено)
  if (showResults) {
    buttons.push([
      createWebAppButton('📊 Результаты', `/poll/${pollId}/results`)
    ]);
  }
  
  return {
    inline_keyboard: buttons
  };
}

/**
 * Клавиатура для ответственного за заказ
 */
export function createResponsibleKeyboard(pollId: number) {
  return {
    inline_keyboard: [
      [createWebAppButton('📋 Детали заказа', `/poll/${pollId}/order`)],
      [createWebAppButton('💰 Информация о платежах', '/payments')]
    ]
  };
}
