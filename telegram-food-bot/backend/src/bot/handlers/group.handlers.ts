import { CallbackQueryContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { UserService } from '../../services/user.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

/**
 * Кнопка «✅ Я обедаю» в приветственном сообщении группы.
 * Регистрирует кликнувшего в БД (надёжный fallback к chat_member при
 * включённом privacy mode) и ставит постоянный флаг participatesInPolls=true.
 * Идемпотентно: повторный клик безопасен (@@unique([groupId, userId])).
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

    await ctx.answerCallbackQuery({ text: '✅ Готово! Ты в списке обедающих' });

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
