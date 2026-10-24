/**
 * Клавиатуры с WebApp кнопками
 */
import { botConfig } from '../../config/bot.config';

/**
 * Адрес Mini App с хвостом `path` или `null`, если WEBAPP_URL для web_app не
 * годится. Telegram принимает только https, а на сообщение с негодным адресом
 * кнопки отвечает BUTTON_URL_INVALID и не доставляет его целиком — вместе с
 * текстом. Localhost тоже отсекается: снаружи он недоступен. Переменная
 * читается при каждом вызове, а не при загрузке модуля.
 */
export function getWebAppUrl(path: string = ''): string | null {
  const base = process.env.WEBAPP_URL ?? '';
  try {
    const { protocol, hostname } = new URL(base);
    if (protocol !== 'https:' || hostname === 'localhost') return null;
  } catch {
    return null;
  }
  return `${base}${path}`;
}

/**
 * Inline-кнопка, открывающая Mini App, или `null`, когда адреса нет. Все
 * web_app-кнопки собираются здесь: без адреса кнопка пропадает, а сообщение
 * уходит без неё.
 */
export function createWebAppButton(text: string, path: string = '') {
  const url = getWebAppUrl(path);
  return url ? { text, web_app: { url } } : null;
}

/**
 * Кнопка в ЛС получателю денег, у которого нет реквизитов: открывает профиль
 * сразу с формой реквизитов. Только для личных чатов — web_app в группе не
 * работает.
 */
export function createPaymentInfoButton() {
  return createWebAppButton('💳 Указать реквизиты', '/profile?edit=payment');
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
