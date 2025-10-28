import { BotContext } from '../../types/bot.types';
import { PollService } from '../../services/poll.service';
import { UserService } from '../../services/user.service';
import { MenuService } from '../../services/menu.service';
import { logger } from '../../utils/logger';
// UX UPGRADE: Убраны неиспользуемые импорты (VoteService, createPollKeyboard)

/**
 * Команда /vote - fallback для голосования без web_app
 * Использование: /vote <pollId> или просто /vote (если есть активное голосование в группе)
 */
export async function voteCommand(ctx: BotContext): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('❌ Не удалось определить пользователя');
      return;
    }

    // Получаем или создаём пользователя
    let dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      dbUser = await UserService.upsertUser({
        telegramId: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    }

    // Парсим pollId из аргументов команды
    const args = ctx.match?.toString().trim();
    let pollId: number | null = null;

    if (args && args.length > 0) {
      pollId = parseInt(args);
      if (isNaN(pollId)) {
        await ctx.reply(
          '❌ Неверный формат команды\n\n' +
          'Использование: `/vote <ID голосования>`\n' +
          'Или просто `/vote` если вы в группе с активным голосованием',
          { parse_mode: 'Markdown' }
        );
        return;
      }
    } else {
      // Если pollId не указан, пытаемся найти активное голосование в группе
      const chat = ctx.chat;
      if (chat && chat.type !== 'private') {
        const groupId = chat.id.toString();
        const group = await import('../../services/group.service').then(m => 
          m.GroupService.getGroupByTelegramId(groupId)
        );
        
        if (group) {
          const activePoll = await PollService.getActivePollInGroup(group.id);
          if (activePoll) {
            pollId = activePoll.id;
          }
        }
      }

      if (!pollId) {
        await ctx.reply(
          'ℹ️ Укажите ID голосования\n\n' +
          'Использование: `/vote <ID>`\n\n' +
          'Пример: `/vote 123`',
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Получаем голосование
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      await ctx.reply('❌ Голосование не найдено');
      return;
    }

    // Проверяем статус
    if (poll.status !== 'ACTIVE') {
      await ctx.reply('⚠️ Голосование уже завершено');
      return;
    }

    // Получаем активные блюда
    const activeItems = await MenuService.getActiveMenuItems();
    if (activeItems.length === 0) {
      await ctx.reply('❌ Нет доступных блюд в меню');
      return;
    }

    // UX UPGRADE (Фаза 1.6): Вместо inline-кнопок → направляем в Mini App
    // Поддержка двух интерфейсов сложна, лучше единый UX
    
    const votes = poll.votes || [];
    const voteCount = votes.length;
    
    // Считаем оставшееся время
    let timeRemaining = 'неизвестно';
    if (poll.startedAt && poll.duration) {
      const endTime = new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
      const remaining = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000 / 60));
      timeRemaining = `${remaining} мин`;
    }

    // Формируем сообщение с призывом использовать Mini App
    const message = 
      `🗳️ **Голосование активно!**\n\n` +
      `👥 Проголосовало: ${voteCount}\n` +
      `⏰ Осталось: ${timeRemaining}\n\n` +
      `🤖 Для удобного голосования откройте Mini App:\n` +
      `• Фото блюд\n` +
      `• Описания и цены\n` +
      `• Live-результаты\n\n` +
      `👇 Нажмите кнопку ниже:`;

    // Создаём клавиатуру только с кнопкой Mini App
    const webAppUrl = process.env.WEBAPP_URL || 'https://your-domain.com';
    const miniAppKeyboard = {
      inline_keyboard: [
        [
          {
            text: '📱 Открыть голосование',
            web_app: { url: `${webAppUrl}?pollId=${pollId}` }
          }
        ]
      ]
    };

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: miniAppKeyboard,
    });

    logger.info(`Fallback vote command used by user ${dbUser.id} for poll ${pollId}`);

  } catch (error) {
    logger.error('Error in voteCommand:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
}
