import { CommandContext } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { PollService } from '../../services/poll.service';
import { MenuService } from '../../services/menu.service';
import { GroupService } from '../../services/group.service';
import { UserService } from '../../services/user.service';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';
import { createPollKeyboard, createPollMessage } from '../keyboards/poll.keyboard';

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

    // Создаём сообщение и клавиатуру
    const pollData = {
      poll,
      menuItems: activeItems,
      votes: new Map(),
      totalVotes: 0
    };
    const keyboard = createPollKeyboard(poll.id, activeItems, new Map());
    const pollMessage = createPollMessage(pollData);

    const sentMessage = await ctx.reply(pollMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    logger.info('Poll started via bot command', {
      pollId: poll.id,
      groupId: group.id,
      startedBy: dbUser.id,
      durationMinutes,
    });

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
