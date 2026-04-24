import { CallbackQueryContext, Context } from 'grammy';
import { BotContext } from '../../types/bot.types';
import { PollService } from '../../services/poll.service';
import { VoteService } from '../../services/vote.service';
import { UserService } from '../../services/user.service';
import { RouletteService, RouletteResult } from '../../services/roulette.service';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { createResultsMessage } from '../keyboards/poll.keyboard';

/**
 * Обработка завершения голосования
 */
export async function handleCompletePoll(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number
): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
      return;
    }

    // Проверяем права администратора
    const isAdmin = await UserService.isAdmin(BigInt(user.id));
    const chat = ctx.chat;

    if (!isAdmin && chat) {
      const member = await ctx.api.getChatMember(chat.id, user.id);
      const isChatAdmin = ['creator', 'administrator'].includes(member.status);
      
      if (!isChatAdmin) {
        await ctx.answerCallbackQuery('❌ Только администраторы могут завершать голосование');
        return;
      }
    }

    // Завершаем голосование
    const result = await PollService.completePoll(pollId);
    
    await ctx.answerCallbackQuery('✅ Голосование завершено');
    
    // Обновляем сообщение
    const votes = await VoteService.getPollVotes(pollId);
    const breakdown = await VoteService.getVoteBreakdown(pollId);
    const voteTypeStats = await VoteService.getVoteTypeStats(pollId);
    
    const resultsMessage = createResultsMessage({
      poll: result,
      result,
      breakdown,
      totalVotes: votes.length,
      voteTypeStats,
    });

    await ctx.editMessageText(resultsMessage, {
      parse_mode: 'Markdown',
    });

    logger.info(`Poll completed: ${pollId} by user ${user.id}`);

    // Автоматически запускаем рулетку если включено
    if (process.env.AUTO_ROULETTE_ENABLED === 'true' && votes.length > 0) {
      setTimeout(() => handleRunRoulette(ctx, pollId), 2000);
    }

  } catch (error) {
    logger.error('Error in handleCompletePoll:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при завершении голосования');
  }
}

/**
 * Запуск рулетки
 */
export async function handleRunRoulette(
  ctx: CallbackQueryContext<BotContext> | Context,
  pollId: number
): Promise<void> {
  try {
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      if ('answerCallbackQuery' in ctx) {
        await ctx.answerCallbackQuery('❌ Голосование не найдено');
      }
      return;
    }

    // Проверяем, что голосование завершено
    if (poll.status === 'ACTIVE') {
      if ('answerCallbackQuery' in ctx) {
        await ctx.answerCallbackQuery('⚠️ Сначала завершите голосование');
      }
      return;
    }

    const votes = await VoteService.getPollVotes(pollId);
    if (votes.length === 0) {
      if ('answerCallbackQuery' in ctx) {
        await ctx.answerCallbackQuery('❌ Никто не голосовал');
      }
      return;
    }

    // Проверяем, не запускалась ли рулетка уже
    const existingResult = await PollService.getPollResult(pollId);
    if (existingResult?.responsibleUserId) {
      if ('answerCallbackQuery' in ctx) {
        await ctx.answerCallbackQuery('⚠️ Рулетка уже была запущена');
      }
      return;
    }

    if ('answerCallbackQuery' in ctx) {
      await ctx.answerCallbackQuery('🎰 Запускаем рулетку...');
    }

    // Запускаем рулетку
    const rouletteService = new RouletteService();
    const result = await rouletteService.runRoulette(pollId);

    // Сохраняем результат
    await PollService.savePollResult({
      pollId,
      winnerMenuItemId: result.winnerMenuItemId,
      responsibleUserId: result.responsibleUserId,
      totalVotes: result.totalVotes,
      rouletteData: JSON.stringify(result.animationData),
    });

    // Показываем анимацию
    await showRouletteAnimation(ctx, result);

    // Отправляем уведомление ответственному
    if (process.env.NOTIFICATION_ENABLED === 'true') {
      const notificationService = new NotificationService();
      await notificationService.notifyResponsible(pollId, result.responsibleUserId);
    }

    logger.info(`Roulette completed for poll ${pollId}`, {
      responsibleUserId: result.responsibleUserId,
      winnerItem: result.winnerMenuItemId,
    });

  } catch (error) {
    logger.error('Error in handleRunRoulette:', error);
    if ('answerCallbackQuery' in ctx) {
      await ctx.answerCallbackQuery('❌ Ошибка при запуске рулетки');
    }
  }
}

/**
 * Показать анимацию рулетки
 */
async function showRouletteAnimation(
  ctx: CallbackQueryContext<BotContext> | Context,
  result: RouletteResult
): Promise<void> {
  try {
    const { animationData, responsibleUserName, winnerMenuItemName } = result;

    const initialText =
      '🎰 **Запуск рулетки...**\n\nВыбираем ответственного за заказ...';
    let rouletteMessage: any = null;

    if ('callbackQuery' in ctx && ctx.callbackQuery?.message) {
      rouletteMessage = ctx.callbackQuery.message;
      try {
        await ctx.api.editMessageText(
          rouletteMessage.chat.id,
          rouletteMessage.message_id,
          initialText,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        rouletteMessage = await ctx.reply(initialText, { parse_mode: 'Markdown' });
      }
    } else {
      rouletteMessage = await ctx.reply(initialText, { parse_mode: 'Markdown' });
    }

    // Анимация "прокрутки" участников
    for (let i = 0; i < animationData.steps.length; i++) {
      const step = animationData.steps[i];
      
      await new Promise(resolve => setTimeout(resolve, step.delay));
      
      try {
        await ctx.api.editMessageText(
          rouletteMessage.chat.id,
          rouletteMessage.message_id,
          step.message,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        // Игнорируем ошибки редактирования (rate limits)
      }
    }

    // Финальное сообщение
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let finalMessage = `🎉 **Рулетка завершена!**\n\n`;
    finalMessage += `🎯 **Ответственный за заказ:** ${responsibleUserName}\n`;
    
    if (winnerMenuItemName) {
      finalMessage += `🍽️ **Заказываем:** ${winnerMenuItemName}\n`;
    }
    
    finalMessage += `\n📞 Ожидаем заказа! 🚀`;

    await ctx.api.editMessageText(
      rouletteMessage.chat.id,
      rouletteMessage.message_id,
      finalMessage,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    logger.error('Error in showRouletteAnimation:', error);
  }
}

/**
 * Обработка отмены голосования
 */
export async function handleCancelPoll(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number
): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
      return;
    }

    // Проверяем права администратора
    const isAdmin = await UserService.isAdmin(BigInt(user.id));
    const chat = ctx.chat;

    if (!isAdmin && chat) {
      const member = await ctx.api.getChatMember(chat.id, user.id);
      const isChatAdmin = ['creator', 'administrator'].includes(member.status);
      
      if (!isChatAdmin) {
        await ctx.answerCallbackQuery('❌ Только администраторы могут отменять голосование');
        return;
      }
    }

    // Получаем пользователя из БД
    let dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      dbUser = await UserService.createUser({
        telegramId: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    }

    // Отменяем голосование с уведомлениями
    await PollService.cancelPoll(pollId, dbUser.id, 'Отменено администратором');
    
    await ctx.answerCallbackQuery('🚫 Голосование отменено');
    
    await ctx.editMessageText(
      '🚫 **Голосование отменено администратором**\n\n' +
      '📬 Уведомления отправлены всем участникам.',
      { parse_mode: 'Markdown' }
    );

    logger.info(`Poll cancelled: ${pollId} by user ${user.id} (${dbUser.id})`);

  } catch (error) {
    logger.error('Error in handleCancelPoll:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при отмене голосования');
  }
}

/**
 * Обработка нажатия кнопки "Проголосовать" (Deep Linking)
 * ОБНОВЛЕНО: Убраны fallback сообщения, прямое открытие Mini App
 */
export async function handleOpenPollButton(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number
): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
      return;
    }

    // Проверяем, что голосование существует и активно
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      await ctx.answerCallbackQuery('❌ Голосование не найдено');
      return;
    }

    if (poll.status !== 'ACTIVE') {
      await ctx.answerCallbackQuery('⚠️ Голосование уже завершено');
      return;
    }

    // Получаем имя бота для deep link
    const botInfo = await ctx.api.getMe();
    const botUsername = botInfo.username;

    // Генерируем deep link URL для перехода в личный чат с ботом
    // Формат: t.me/<bot_username>?start=vote_<poll_id>
    const deepLinkUrl = `https://t.me/${botUsername}?start=vote_${pollId}`;

    // Отправляем ответ с URL (открывает личный чат с ботом)
    // Бот молча откроет Mini App благодаря логике в start.ts
    await ctx.answerCallbackQuery({
      text: '📱 Открываю голосование...',
      url: deepLinkUrl,
    });

    logger.info(`Deep link generated for poll ${pollId}, user ${user.id}`);
  } catch (error) {
    logger.error('Error in handleOpenPollButton:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при открытии голосования');
  }
}

