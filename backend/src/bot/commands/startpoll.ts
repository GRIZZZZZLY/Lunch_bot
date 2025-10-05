import { CommandContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { PollService } from '../../services/poll.service';
import { MenuService } from '../../services/menu.service';
import { GroupService } from '../../services/group.service';
import { UserService } from '../../services/user.service';
import { PollReminderService } from '../../services/poll-reminder.service';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';
import { 
  createPollKeyboard, 
  createPollMessage, 
  createCompactPollMessage, 
  createCompactPollKeyboard 
} from '../keyboards/poll.keyboard';

// Хранилище интервалов обновления для активных голосований
const pollUpdateIntervals = new Map<number, NodeJS.Timeout>();

/**
 * Периодическое обновление сообщения голосования
 */
async function updatePollMessage(
  ctx: any,
  pollId: number,
  messageId: number,
  chatId: number,
  itemCount: number
): Promise<void> {
  try {
    const poll = await PollService.getPollById(pollId);
    if (!poll || poll.status !== 'ACTIVE') {
      // Голосование завершено, останавливаем обновления
      const interval = pollUpdateIntervals.get(pollId);
      if (interval) {
        clearInterval(interval);
        pollUpdateIntervals.delete(pollId);
      }
      return;
    }

    const currentVotes = poll.votes.length;
    const updatedMessage = createCompactPollMessage(poll, itemCount, currentVotes);
    const keyboard = createCompactPollKeyboard(pollId);

    await ctx.api.editMessageText(chatId, messageId, updatedMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    logger.info(`Poll message updated: ${pollId}, votes: ${currentVotes}`);
  } catch (error: any) {
    // Игнорируем ошибку, если сообщение не изменилось
    if (error?.description?.includes('message is not modified')) {
      return;
    }
    logger.error('Error updating poll message:', error);
  }
}

/**
 * Команда /startpoll - запуск голосования (только для админов в группах)
 */
export async function startPollCommand(ctx: CommandContext<BotContext>): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.reply('Не удалось определить пользователя');
      return;
    }

    const chat = ctx.chat;
    if (!chat || chat.type === 'private') {
      await ctx.reply('Эта команда доступна только в группах');
      return;
    }

    // Получаем или создаём группу
    let group = await GroupService.getGroupByTelegramId(chat.id.toString());
    if (!group) {
      group = await GroupService.upsertGroup({
        telegramId: chat.id.toString(),
        title: chat.title || 'Unknown',
        type: chat.type,
      });
    }

    // Проверяем активное голосование
    const existingPoll = await PollService.getActivePollInGroup(group.id);
    if (existingPoll) {
      await ctx.reply('В этой группе уже есть активное голосование!');
      return;
    }

    // Парсим длительность
    const durationMinutes = ctx.match ? parseInt(ctx.match.toString()) : 30;
    if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      await ctx.reply('Неверная длительность. Укажите число от 1 до 1440 минут.');
      return;
    }

    // Получаем активные блюда
    const activeItems = await MenuService.getActiveMenuItems();
    if (activeItems.length === 0) {
      await ctx.reply('Меню пусто! Сначала добавьте блюда через Mini App.');
      return;
    }

    // Получаем пользователя из БД
    const dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      await ctx.reply('Пользователь не найден в системе');
      return;
    }

    // Создаём голосование
    const poll = await PollService.createPoll({
      groupId: group.id,
      duration: durationMinutes,
      createdBy: dbUser.id,
    });

    // Создаём компактное сообщение и клавиатуру (Deep Linking flow)
    const keyboard = createCompactPollKeyboard(poll.id);
    const pollMessage = createCompactPollMessage(poll, activeItems.length, 0);

    const sentMessage = await ctx.reply(pollMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    // Сохраняем message_id и chat_id для последующих обновлений счётчика
    await PollService.updatePoll(poll.id, { 
      messageId: sentMessage.message_id,
      chatId: BigInt(chat.id)
    });

    logger.info('Poll started via bot command', {
      pollId: poll.id,
      groupId: group.id,
      startedBy: dbUser.id,
      durationMinutes,
    });

    // Запускаем периодическое обновление счётчика (каждую минуту)
    const updateInterval = setInterval(() => {
      updatePollMessage(ctx as any, poll.id, sentMessage.message_id, chat.id, activeItems.length);
    }, 60 * 1000); // 60 секунд
    
    pollUpdateIntervals.set(poll.id, updateInterval);

    // Планируем напоминания о голосовании (10 мин, 2 мин, финал)
    PollReminderService.scheduleReminders(poll.id, durationMinutes, BigInt(chat.id));

    // Устанавливаем таймер для автозавершения
    setTimeout(async () => {
      try {
        const currentPoll = await PollService.getPollById(poll.id);
        if (currentPoll?.status === 'ACTIVE') {
          await autoCompletePoll(ctx as any, poll.id, sentMessage.message_id);
        }
      } catch (error) {
        logger.error('Error in poll auto-completion timeout:', error);
      }
    }, durationMinutes * 60 * 1000);

    await ctx.reply(
      `✅ Голосование запущено на ${durationMinutes} минут!\n` +
      `Голосуйте, нажимая на кнопки выше.`
    );
  } catch (error) {
    logger.error('Error in startPollCommand:', error);
    await ctx.reply('Произошла ошибка при создании голосования');
  }
}

/**
 * Автоматическое завершение голосования по таймауту
 */
async function autoCompletePoll(ctx: any, pollId: number, messageId: number): Promise<void> {
  try {
    // Останавливаем периодическое обновление
    const updateInterval = pollUpdateIntervals.get(pollId);
    if (updateInterval) {
      clearInterval(updateInterval);
      pollUpdateIntervals.delete(pollId);
    }

    // Отменяем все запланированные напоминания
    PollReminderService.cancelReminders(pollId);

    const result = await PollService.completePoll(pollId);
    
    // Убираем кнопки голосования
    await ctx.api.editMessageReplyMarkup(ctx.chat.id, messageId, { 
      reply_markup: undefined 
    });
    
    // Уведомляем о завершении
    await ctx.reply('⏰ Время голосования истекло!');
    
    // Запускаем рулетку если были голоса
    if (result.totalVotes > 0) {
      await autoRunRoulette(ctx, pollId);
    }
  } catch (error) {
    logger.error('Error in autoCompletePoll:', error);
  }
}

/**
 * Автоматический запуск рулетки после завершения голосования
 */
async function autoRunRoulette(ctx: any, pollId: number): Promise<void> {
  try {
    const result = await PollService.runRoulette(pollId);
    
    if (result.responsibleUserId) {
      const responsibleUser = await UserService.getUserById(result.responsibleUserId);
      if (!responsibleUser) return;
      
      const winnerMention = `[${responsibleUser.firstName}](tg://user?id=${responsibleUser.telegramId})`;
      let winnerItem = 'выбранное блюдо';
      
      if (result.winnerMenuItemId) {
        const menuItem = await prisma.menuItem.findUnique({ 
          where: { id: result.winnerMenuItemId } 
        });
        winnerItem = menuItem?.name || winnerItem;
      }
      
      await ctx.reply(
        `🎲 **Рулетка завершена!**\n\n` +
        `🎯 **Ответственный за заказ:** ${winnerMention}\n` +
        `🍽️ **Блюдо-победитель:** ${winnerItem}\n\n` +
        `📞 ${responsibleUser.firstName}, ожидаем вашего заказа! 😊`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    logger.error('Error in auto-run roulette:', error);
  }
}
