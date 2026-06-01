import { CallbackQueryContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { createGroupWelcomeKeyboard } from '../keyboards/webapp.keyboard';
import { logger } from '../../utils/logger';

/**
 * Первая строка приветственного сообщения группы. Константа: ниже неё живёт
 * динамический список обедающих, поэтому greeting должен совпадать при первичной
 * отправке (group-events) и при edit-обновлении (этот хендлер).
 */
export const WELCOME_GREETING =
  '👋 Бот на месте! Жми «Я обедаю» — попадёшь в список на голосования.';

/**
 * Префикс строки со списком обедающих. Состояние списка живёт прямо в тексте
 * сообщения (без БД) — переживает рестарт, естественный дедуп по имени.
 */
const OPTIN_NAMES_PREFIX = '🍽 Обедают: ';

/** Достаёт имена обедающих из текста приветственного сообщения. */
function parseOptedInNames(text: string): string[] {
  const line = text.split('\n').find((l) => l.startsWith(OPTIN_NAMES_PREFIX));
  if (!line) return [];
  return line
    .slice(OPTIN_NAMES_PREFIX.length)
    .split(', ')
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Собирает текст: приветствие + (если есть) строка со списком имён. */
function buildWelcomeText(names: string[]): string {
  if (names.length === 0) return WELCOME_GREETING;
  return `${WELCOME_GREETING}\n\n${OPTIN_NAMES_PREFIX}${names.join(', ')}`;
}

/**
 * Кнопка «✅ Я обедаю» в приветственном сообщении группы.
 * Регистрирует кликнувшего в БД (надёжный fallback к chat_member при включённом
 * privacy mode), ставит participatesInPolls=true и дописывает его имя в список
 * обедающих прямо в тексте сообщения. Идемпотентно: повтор не дублирует
 * (@@unique([groupId, userId]) в БД + дедуп по имени в тексте).
 */
export async function handleOptInButton(
  ctx: CallbackQueryContext<BotContext>
): Promise<void> {
  try {
    const chat = ctx.chat;
    if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
      await ctx.answerCallbackQuery();
      return;
    }

    const from = ctx.callbackQuery.from;

    const group = await GroupService.upsertGroup({
      telegramId: chat.id.toString(),
      title: (chat as any).title || 'Unknown Group',
      type: chat.type,
    });

    const dbUser = await UserService.upsertUser({
      telegramId: from.id.toString(),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    await GroupService.addMemberToGroup(group.id, dbUser.id);
    await UserService.updateUser(dbUser.id, { participatesInPolls: true });

    const name = from.first_name?.trim() || 'Гость';
    const currentText = ctx.callbackQuery.message?.text ?? WELCOME_GREETING;
    const names = parseOptedInNames(currentText);

    if (names.includes(name)) {
      await ctx.answerCallbackQuery({ text: 'Ты уже в списке 👍' });
    } else {
      names.push(name);
      try {
        await ctx.editMessageText(buildWelcomeText(names), {
          reply_markup: createGroupWelcomeKeyboard(chat.id),
        });
      } catch (editError) {
        // «message is not modified» / «message can't be edited» (слишком старое) —
        // не валим callback, регистрация уже прошла.
        logger.warn('Welcome message edit skipped', {
          chatId: chat.id,
          error: editError instanceof Error ? editError.message : String(editError),
        });
      }
      await ctx.answerCallbackQuery({ text: '✅ Готово! Ты в списке обедающих' });
    }

    logger.info('User opted in via group welcome button', {
      chatId: chat.id,
      userId: from.id,
      username: from.username,
    });
  } catch (error) {
    logger.error('Error handling opt-in button:', error);
    await ctx.answerCallbackQuery({ text: 'Не получилось. Попробуй ещё раз.' });
  }
}
