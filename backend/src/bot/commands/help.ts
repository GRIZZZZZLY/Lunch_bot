import { BotContext } from '../../types/bot.types';
import { createWebAppButton } from '../keyboards/webapp.keyboard';
/**
 * Команда /help - показать помощь
 */
export async function helpCommand(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type !== 'private';

  const helpText = isGroup ? getGroupHelpText() : getPrivateHelpText();

  if (isGroup) {
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
    return;
  }

  const appButton = createWebAppButton('🚀 Открыть Mini App');
  await ctx.reply(helpText, {
    parse_mode: 'Markdown',
    ...(appButton ? { reply_markup: { inline_keyboard: [[appButton]] } } : {}),
  });
}

/**
 * Помощь для групповых чатов
 */
function getGroupHelpText(): string {
  return (
    '*Rocket Lunch*\n\n' +
    'Всё управление — в приложении.\n' +
    'Открой его кнопкой *Menu* внизу чата.\n\n' +
    'Команды: /start, /help'
  );
}

/**
 * Помощь для личных сообщений
 */
function getPrivateHelpText(): string {
  return (
    '*Rocket Lunch*\n\n' +
    'Всё управление — в приложении.\n' +
    'Открой его кнопкой *Menu* внизу чата.\n\n' +
    'Команды: /start, /help'
  );
}


