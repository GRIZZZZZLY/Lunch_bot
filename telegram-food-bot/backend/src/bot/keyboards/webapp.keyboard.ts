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
 * Прямая ссылка на Mini App (Direct Link).
 * web_app кнопки НЕ работают в групповых чатах, но ссылка t.me/<bot>/<app>?startapp=...
 * открывает Mini App напрямую из группы, минуя промежуточный шаг в личке.
 * startParam прилетает во фронт как initDataUnsafe.start_param.
 */
export function createDirectLinkMiniAppUrl(startParam: string): string {
  const botUsername = process.env.BOT_USERNAME || 'rocket_lunch_bot';
  const shortName = botConfig.miniApp.shortName;
  return `https://t.me/${botUsername}/${shortName}?startapp=${startParam}`;
}

/**
 * Клавиатура приветственного сообщения группы: callback opt-in + Direct Link «Открыть Mini App».
 * Используется и при первичной отправке, и при edit-обновлении (editMessageText сбрасывает
 * клавиатуру, поэтому её надо передавать заново).
 */
export function createGroupWelcomeKeyboard(chatId: number | string) {
  return {
    inline_keyboard: [
      [{ text: '✅ Я обедаю', callback_data: `optin_${chatId}` }],
      [{ text: '🍽 Открыть Mini App', url: createDirectLinkMiniAppUrl(`menu_${chatId}`) }],
    ],
  };
}

/**
 * Клавиатура для голосования (Direct Link Mini App)
 * Параметр прилетает во фронт как initDataUnsafe.start_param = "vote_<pollId>".
 */
export function createVoteWebAppKeyboard(pollId: number) {
  return {
    inline_keyboard: [[
      {
        text: '🗳️ Проголосовать',
        url: createDirectLinkMiniAppUrl(`vote_${pollId}`)
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
 * ИЗМЕНЕНО: голосование теперь на главной странице (?pollId=X вместо /poll/:id)
 */
export function createPollActionsKeyboard(pollId: number, showResults: boolean = false) {
  const buttons = [];
  
  // Кнопка голосования - ИЗМЕНЕНО: открывает главную с параметром pollId
  buttons.push([
    createWebAppButton('🗳️ Проголосовать', `/?pollId=${pollId}`)
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
 * ИЗМЕНЕНО: убрана кнопка "Детали заказа", так как /poll/:id/order больше не существует
 */
export function createResponsibleKeyboard(pollId: number) {
  return {
    inline_keyboard: [
      [createWebAppButton('🏠 Главная', '/')],
      [createWebAppButton('💰 Информация о платежах', '/profile')]
    ]
  };
}
