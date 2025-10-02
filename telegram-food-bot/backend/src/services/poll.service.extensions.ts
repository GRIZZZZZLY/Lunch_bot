import { MenuItem } from '@prisma/client';
import { PollService } from './poll.service';
import { GroupService } from './group.service';
import { VoteService } from './vote.service';
import { NotificationService } from './notification.service';
import { logger } from '../utils/logger';

/**
 * Создание уведомления о начале голосования для группы
 */
function createPollNotificationMessage(data: {
  title: string;
  duration: number;
  menuItemsCount: number;
  endTime: Date;
}): string {
  const { title, duration, menuItemsCount, endTime } = data;
  
  let message = `🗳️ **${title}**\n\n`;
  message += `⏰ **Время голосования:** ${duration} мин\n`;
  message += `🍽️ **Доступно блюд:** ${menuItemsCount}\n`;
  message += `⏱️ **Завершится:** ${endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\n`;
  message += `👉 Откройте Mini App для голосования!\n`;
  message += `Нажмите кнопку "🗳️ Проголосовать" ниже`;
  
  return message;
}

// Bot instance будет инициализирован из bot.ts
let botInstance: any = null;

export function initializePollServiceBot(bot: any): void {
  botInstance = bot;
  logger.info('PollService bot instance initialized');
}

/**
 * Создание голосования из WebApp с отправкой в группу
 */
export async function createPollFromWebApp(params: {
  groupId: number;
  duration: number;
  createdBy: number;
  title?: string;
  menuItems: MenuItem[];
}): Promise<{ pollId: number; messageId: number }> {
  try {
    if (!botInstance) {
      throw new Error('Bot not initialized in PollService');
    }

    const { groupId, duration, createdBy, title, menuItems } = params;

    // Получаем группу для получения telegramId
    const group = await GroupService.getGroupById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Создаём голосование в БД
    const poll = await PollService.createPoll({
      groupId,
      duration,
      createdBy,
    });

    // Формируем уведомление для группы (БЕЗ inline-кнопок, только кнопка Mini App)
    const endTime = new Date(Date.now() + duration * 60 * 1000);
    const message = createPollNotificationMessage({
      title: title || 'Голосование за обед',
      duration,
      menuItemsCount: menuItems.length,
      endTime,
    });

    // Создаём кнопку для открытия Mini App
    const keyboard = {
      inline_keyboard: [[
        {
          text: '🗳️ Проголосовать',
          web_app: { url: `${process.env.WEBAPP_URL}/vote/${poll.id}` }
        }
      ]]
    };

    // Отправляем сообщение в группу
    const sentMessage = await botInstance.api.sendMessage(
      group.telegramId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );

    logger.info('Poll message sent to group', {
      pollId: poll.id,
      groupId: group.telegramId,
      messageId: sentMessage.message_id,
    });

    // Устанавливаем таймер для автозавершения
    setTimeout(async () => {
      try {
        const currentPoll = await PollService.getPollById(poll.id);
        if (currentPoll?.status === 'ACTIVE') {
          await autoCompletePoll(poll.id, parseInt(group.telegramId.toString()), sentMessage.message_id);
        }
      } catch (error) {
        logger.error('Error in poll auto-completion timeout:', error);
      }
    }, duration * 60 * 1000);

    return {
      pollId: poll.id,
      messageId: sentMessage.message_id,
    };
  } catch (error) {
    logger.error('Error creating poll from WebApp:', error);
    throw error;
  }
}

/**
 * Автоматическое завершение голосования
 */
async function autoCompletePoll(
  pollId: number,
  chatId: number,
  messageId: number
): Promise<void> {
  try {
    if (!botInstance) {
      logger.error('Bot not initialized for auto-complete');
      return;
    }

    logger.info(`Auto-completing poll ${pollId}`);

    // Завершаем голосование
    const result = await PollService.completePoll(pollId);

    // Получаем детальную разбивку голосов
    const breakdown = await PollService.getPollVoteBreakdown(pollId);
    const votes = await VoteService.getPollVotes(pollId);

    // Убираем кнопку голосования
    try {
      await botInstance.api.editMessageReplyMarkup(chatId, messageId, {
        reply_markup: undefined,
      });
    } catch (error) {
      logger.warn('Could not remove poll button:', error);
    }

    // Отправляем результаты в группу
    const resultsMessage = createPollResultsMessage({
      totalVotes: result.totalVotes,
      breakdown,
      winnerItem: breakdown.length > 0 ? breakdown[0] : null,
    });

    await botInstance.api.sendMessage(
      chatId,
      resultsMessage,
      { parse_mode: 'Markdown' }
    );

    // Запускаем рулетку если были голоса
    let responsibleUser = null;
    if (result.totalVotes > 0) {
      if (process.env.AUTO_ROULETTE_ENABLED === 'true') {
        const rouletteResult = await PollService.runRoulette(pollId);
        responsibleUser = rouletteResult.responsibleUser;
        
        // Уведомляем о выборе ответственного
        if (responsibleUser) {
          await botInstance.api.sendMessage(
            chatId,
            `🎲 **Рулетка завершена!**\n\n` +
            `🎯 Ответственный за заказ: [${responsibleUser.firstName}](tg://user?id=${responsibleUser.telegramId})\n\n` +
            `📞 Ожидаем заказа!`,
            { parse_mode: 'Markdown' }
          );
        }
      }

      // Отправляем личные уведомления всем участникам
      await sendPersonalNotifications(pollId, breakdown, responsibleUser);
    }

    logger.info(`Poll ${pollId} completed successfully`);
  } catch (error) {
    logger.error('Error in autoCompletePoll:', error);
  }
}

/**
 * Создание сообщения с результатами голосования для группы
 */
function createPollResultsMessage(data: {
  totalVotes: number;
  breakdown: any[];
  winnerItem: any | null;
}): string {
  const { totalVotes, breakdown, winnerItem } = data;

  let message = `📊 **Голосование завершено!**\n\n`;
  message += `👥 Проголосовало: ${totalVotes}\n\n`;

  if (breakdown.length === 0) {
    message += `😔 Никто не проголосовал`;
    return message;
  }

  if (winnerItem) {
    message += `🏆 **Победитель:** ${winnerItem.menuItemName}\n`;
    message += `   ${winnerItem.votes} голосов (${winnerItem.percentage}%)\n\n`;
  }

  message += `📋 **Топ блюд:**\n\n`;
  
  breakdown.slice(0, 5).forEach((item: any, index: number) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    message += `${medal} ${item.menuItemName} — ${item.votes} ${getVotesWord(item.votes)} (${item.percentage}%)\n`;
  });

  return message;
}

/**
 * Получить правильное склонение слова "голос"
 */
function getVotesWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'голосов';
  }

  if (lastDigit === 1) {
    return 'голос';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'голоса';
  }

  return 'голосов';
}

/**
 * Отправка личных уведомлений всем участникам голосования
 */
async function sendPersonalNotifications(
  pollId: number,
  breakdown: any[],
  responsibleUser: any | null
): Promise<void> {
  try {
    if (!botInstance) {
      logger.error('Bot not initialized for notifications');
      return;
    }

    const votes = await VoteService.getPollVotes(pollId);
    
    if (votes.length === 0) {
      return;
    }

    const winnerItem = breakdown.length > 0 ? breakdown[0] : null;

    logger.info(`Sending personal notifications to ${votes.length} participants`);

    let successCount = 0;
    let failCount = 0;

    // Отправляем уведомления параллельно
    await Promise.all(
      votes.map(async (vote: any) => {
        try {
          const userVote = breakdown.find((b: any) => b.menuItemId === vote.menuItemId);
          
          let message = `🎉 **Голосование завершено!**\n\n`;
          message += `📊 **Результаты:**\n`;
          
          if (winnerItem) {
            message += `🏆 Победитель: **${winnerItem.menuItemName}** (${winnerItem.votes} ${getVotesWord(winnerItem.votes)})\n\n`;
          }

          message += `👤 **Ваш выбор:** ${userVote?.menuItemName || 'Не указан'}\n\n`;

          if (responsibleUser) {
            message += `💰 **Информация для оплаты:**\n`;
            message += `👤 Ответственный: ${responsibleUser.firstName}`;
            if (responsibleUser.username) {
              message += ` (@${responsibleUser.username})`;
            }
            message += `\n`;

            // Добавляем платёжные данные если есть
            if (responsibleUser.paymentCard) {
              message += `💳 Карта: \`${responsibleUser.paymentCard}\`\n`;
            }
            
            if (responsibleUser.paymentPhone) {
              message += `📱 Телефон: ${responsibleUser.paymentPhone}\n`;
            }

            if (responsibleUser.paymentDetails) {
              message += `📝 Детали: ${responsibleUser.paymentDetails}\n`;
            }

            if (!responsibleUser.paymentCard && !responsibleUser.paymentPhone) {
              message += `\n⚠️ Ответственный ещё не указал платёжные данные.\n`;
              message += `📍 Свяжитесь с ним напрямую для уточнения деталей оплаты.`;
            }
          }

          await botInstance.api.sendMessage(
            vote.user.telegramId,
            message,
            { parse_mode: 'Markdown' }
          );

          successCount++;
        } catch (error: any) {
          failCount++;
          logger.warn(`Could not send notification to user ${vote.user.id}:`, error.message);
        }
      })
    );

    logger.info(`Personal notifications sent: ${successCount} success, ${failCount} failed`);
  } catch (error) {
    logger.error('Error sending personal notifications:', error);
  }
}
