import { CallbackQueryContext, Context } from 'grammy';
import { BotContext } from '../types';
import { PollService } from '../../services/poll.service';
import { VoteService } from '../../services/vote.service';
import { MenuService } from '../../services/menu.service';
import { UserService } from '../../services/user.service';
import { RouletteService } from '../../services/roulette.service';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { createPollKeyboard, createPollMessage, createResultsMessage, createCompletedPollKeyboard } from '../keyboards/poll.keyboard';

/**
 * Обработка голосования пользователя
 */
export async function handleVote(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number,
  menuItemId: number
): Promise<void> {
  try {
    const user = ctx.from;
    if (!user) {
      await ctx.answerCallbackQuery('❌ Не удалось определить пользователя');
      return;
    }

    // Получаем пользователя из БД
    let dbUser = await UserService.getUserByTelegramId(BigInt(user.id));
    if (!dbUser) {
      // Регистрируем нового пользователя
      dbUser = await UserService.createUser({
        telegramId: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    }

    // Получаем голосование
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      await ctx.answerCallbackQuery('❌ Голосование не найдено');
      return;
    }

    // Проверяем статус голосования
    if (poll.status !== 'ACTIVE') {
      await ctx.answerCallbackQuery('⚠️ Голосование уже завершено');
      return;
    }

    // Проверяем блюдо
    const menuItem = await MenuService.getMenuItemById(menuItemId);
    if (!menuItem || !menuItem.isActive) {
      await ctx.answerCallbackQuery('❌ Блюдо недоступно');
      return;
    }

    // Проверяем существующий голос
    const existingVote = await VoteService.getUserVoteInPoll(pollId, dbUser.id);
    
    if (existingVote) {
      if (existingVote.menuItemId === menuItemId) {
        await ctx.answerCallbackQuery(`✅ Вы уже проголосовали за "${menuItem.name}"`);
        return;
      }
      
      // Обновляем голос
      await VoteService.updateVote(existingVote.id, menuItemId);
      await ctx.answerCallbackQuery(`🔄 Голос изменен на "${menuItem.name}"`);
      logger.info(`Vote updated: user ${dbUser.id} changed to item ${menuItemId} in poll ${pollId}`);
    } else {
      // Создаем новый голос
      await VoteService.createVote({
        pollId,
        userId: dbUser.id,
        menuItemId,
      });
      await ctx.answerCallbackQuery(`✅ Вы проголосовали за "${menuItem.name}"`);
      logger.info(`Vote created: user ${dbUser.id} voted for item ${menuItemId} in poll ${pollId}`);
    }

    // Обновляем сообщение с голосованием
    await updatePollMessage(ctx, pollId);

  } catch (error) {
    logger.error('Error in handleVote:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при голосовании');
  }
}

/**
 * Обновление сообщения с голосованием
 */
async function updatePollMessage(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void> {
  try {
    const poll = await PollService.getPollById(pollId);
    if (!poll) return;

    const votes = await VoteService.getPollVotes(pollId);
    const menuItems = await MenuService.getActiveMenuItems();

    // Группируем голоса по блюдам
    const votesByItem = new Map();
    votes.forEach(vote => {
      const itemVotes = votesByItem.get(vote.menuItemId) || [];
      itemVotes.push(vote);
      votesByItem.set(vote.menuItemId, itemVotes);
    });

    // Создаем обновленное сообщение
    const message = createPollMessage({
      poll,
      menuItems,
      votes: votesByItem,
      totalVotes: votes.length,
    });

    const keyboard = createPollKeyboard(pollId, menuItems, votesByItem);

    // Обновляем сообщение
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

  } catch (error) {
    logger.error('Error updating poll message:', error);
  }
}

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
    
    const resultsMessage = createResultsMessage({
      poll: result,
      result,
      breakdown,
      totalVotes: votes.length,
    });

    const keyboard = createCompletedPollKeyboard(pollId, votes.length > 0, false);
    
    await ctx.editMessageText(resultsMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
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
 * Обработка обновления голосования
 */
export async function handleRefreshPoll(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number
): Promise<void> {
  try {
    await ctx.answerCallbackQuery('🔄 Обновление...');
    await updatePollMessage(ctx, pollId);
    logger.info(`Poll refreshed: ${pollId}`);
  } catch (error) {
    logger.error('Error in handleRefreshPoll:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при обновлении');
  }
}

/**
 * Показать результаты голосования
 */
export async function handleShowResults(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number
): Promise<void> {
  try {
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      await ctx.answerCallbackQuery('❌ Голосование не найдено');
      return;
    }

    const votes = await VoteService.getPollVotes(pollId);
    const breakdown = await VoteService.getVoteBreakdown(pollId);
    const result = await PollService.getPollResult(pollId);

    const resultsMessage = createResultsMessage({
      poll,
      result,
      breakdown,
      totalVotes: votes.length,
    });

    const keyboard = createCompletedPollKeyboard(
      pollId, 
      votes.length > 0, 
      !!result?.responsibleUserId
    );

    await ctx.editMessageText(resultsMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    await ctx.answerCallbackQuery('📊 Результаты обновлены');
    logger.info(`Results shown for poll: ${pollId}`);

  } catch (error) {
    logger.error('Error in handleShowResults:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при получении результатов');
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

    // Отправляем начальное сообщение
    let rouletteMessage = await ctx.reply('🎰 **Запуск рулетки...**\n\nВыбираем ответственного за заказ...', {
      parse_mode: 'Markdown',
    });

    // Анимация "прокрутки" участников
    for (let i = 0; i < animationData.steps.length; i++) {
      const step = animationData.steps[i];
      
      await new Promise(resolve => setTimeout(resolve, step.delay));
      
      try {
        rouletteMessage = await ctx.api.editMessageText(
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

    // Отменяем голосование
    await PollService.cancelPoll(pollId);
    
    await ctx.answerCallbackQuery('🚫 Голосование отменено');
    
    await ctx.editMessageText(
      '🚫 **Голосование отменено администратором**',
      { parse_mode: 'Markdown' }
    );

    logger.info(`Poll cancelled: ${pollId} by user ${user.id}`);

  } catch (error) {
    logger.error('Error in handleCancelPoll:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при отмене голосования');
  }
}

/**
 * Обработчик для показа промежуточных результатов без завершения
 */
export async function handleShowResultsWithoutComplete(
  ctx: CallbackQueryContext<BotContext>,
  pollId: number
): Promise<void> {
  try {
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      await ctx.answerCallbackQuery('❌ Голосование не найдено');
      return;
    }

    const votes = await VoteService.getPollVotes(pollId);
    const breakdown = await VoteService.getVoteBreakdown(pollId);

    let message = `📊 **Промежуточные результаты**\n\n`;
    message += `🎯 "${poll.title || 'Голосование'}"\n`;
    message += `👥 Проголосовало: ${votes.length}\n\n`;

    if (breakdown.length === 0) {
      message += `😔 _Пока никто не проголосовал_`;
    } else {
      message += `📋 **Текущие лидеры:**\n\n`;
      
      breakdown.slice(0, 5).forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${item.menuItemName} - ${item.votes} голосов (${item.percentage}%)\n`;
      });
    }

    message += `\n_Голосование продолжается..._`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery('📊 Результаты обновлены');

  } catch (error) {
    logger.error('Error in handleShowResultsWithoutComplete:', error);
    await ctx.answerCallbackQuery('❌ Ошибка при получении результатов');
  }
}

/**
 * Экспорт функции для обработки callback queries в роутере
 */
export async function handlePollCallback(ctx: CallbackQueryContext<BotContext>): Promise<void> {
  try {
    const callbackData = ctx.callbackQuery.data;
    if (!callbackData) return;

    const parts = callbackData.split(':');
    const action = parts[0];

    switch (action) {
      case 'vote':
        if (parts.length === 3) {
          const pollId = parseInt(parts[1]);
          const menuItemId = parseInt(parts[2]);
          await handleVote(ctx, pollId, menuItemId);
        }
        break;

      case 'complete_poll':
        if (parts.length === 2) {
          const pollId = parseInt(parts[1]);
          await handleCompletePoll(ctx, pollId);
        }
        break;

      case 'refresh_poll':
        if (parts.length === 2) {
          const pollId = parseInt(parts[1]);
          await handleRefreshPoll(ctx, pollId);
        }
        break;

      case 'show_results':
        if (parts.length === 2) {
          const pollId = parseInt(parts[1]);
          await handleShowResults(ctx, pollId);
        }
        break;

      case 'run_roulette':
        if (parts.length === 2) {
          const pollId = parseInt(parts[1]);
          await handleRunRoulette(ctx, pollId);
        }
        break;

      case 'cancel_poll':
        if (parts.length === 2) {
          const pollId = parseInt(parts[1]);
          await handleCancelPoll(ctx, pollId);
        }
        break;

      default:
        logger.warn(`Unknown poll callback action: ${action}`);
        await ctx.answerCallbackQuery('❓ Неизвестное действие');
    }

  } catch (error) {
    logger.error('Error in handlePollCallback:', error);
    if ('answerCallbackQuery' in ctx) {
      await ctx.answerCallbackQuery('❌ Ошибка обработки');
    }
  }
}

/**
 * Placeholder для handleStartPoll (экспортируется для совместимости)
 */
export async function handleStartPoll(ctx: BotContext): Promise<void> {
  await ctx.reply('ℹ️ Используйте команду /startpoll для создания голосования');
}
