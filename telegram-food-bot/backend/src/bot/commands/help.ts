import { BotContext } from '../../types/bot.types';
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

  const webappUrl = process.env.WEBAPP_URL ?? '';
  await ctx.reply(helpText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть Mini App',
            web_app: { url: webappUrl },
          },
        ],
      ],
    },
  });
}

/**
 * Помощь для групповых чатов
 */
function getGroupHelpText(): string {
  return (
    '🤖 **Telegram Food Bot**\n\n' +
    'Все действия выполняются через Mini App.\n\n' +
    '📱 Откройте Mini App через кнопку **Menu** внизу чата\n' +
    'или напишите боту в личные сообщения и откройте Mini App там.\n\n' +
    'Доступные команды: `/start`, `/help`'
  );
}

/**
 * Помощь для личных сообщений
 */
function getPrivateHelpText(): string {
  return (
    '🤖 **Telegram Food Bot**\n\n' +
    'Все действия выполняются через Mini App.\n\n' +
    'Нажмите кнопку ниже, чтобы открыть Mini App.\n\n' +
    'Доступные команды: `/start`, `/help`'
  );
}


