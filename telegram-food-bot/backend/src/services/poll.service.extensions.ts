import { MenuItem } from '@prisma/client';
import { PollService } from './poll.service';
import { GroupService } from './group.service';
import { VoteService } from './vote.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';
import { logger } from '../utils/logger';
import { createVoteWebAppKeyboard, createResultsWebAppKeyboard, createResponsibleKeyboard } from '../bot/keyboards/webapp.keyboard';

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

import { getBotInstance } from '../bot/bot-instance';

/** @deprecated No-op: bot is now accessed via the shared singleton */
export function initializePollServiceBot(_bot: unknown): void {}

function botInstance() { return getBotInstance(); }

/**
 * Создание голосования из WebApp с отправкой в группу
 */
export async function createPollFromWebApp(params: {
  groupId: number;
  duration: number;
  createdBy: number;
  title?: string;
  menuItems: MenuItem[];
  selectedMenuItemIds?: number[];
  isMultiSelect?: boolean;
  maxSelections?: number;
}): Promise<{ pollId: number; messageId: number }> {
  try {
    logger.info('🎬 Starting createPollFromWebApp', { groupId: params.groupId, menuItemsCount: params.menuItems.length });
    
    if (!botInstance) {
      logger.error('❌ Bot not initialized in PollService');
      throw new Error('Bot not initialized in PollService');
    }
    
    logger.info('✅ Bot instance confirmed');

    const {
      groupId,
      duration,
      createdBy,
      title,
      menuItems,
      selectedMenuItemIds,
      isMultiSelect,
      maxSelections,
    } = params;

    // Получаем группу для получения telegramId
    logger.info('🔍 Fetching group data', { groupId });
    const group = await GroupService.getGroupById(groupId);
    if (!group) {
      logger.error('❌ Group not found', { groupId });
      throw new Error('Group not found');
    }
    logger.info('✅ Group found', { telegramId: group.telegramId.toString(), title: group.title });

    // Создаём голосование в БД с сохранением выбранных блюд
    logger.info('💾 Creating poll in database', { selectedMenuItemIds });
    const poll = await PollService.createPoll({
      groupId,
      duration,
      createdBy,
      isMultiSelect: isMultiSelect ?? true,
      maxSelections: maxSelections ?? 3,
    });
    logger.info('✅ Poll created in DB', { pollId: poll.id });
    
    // Сохраняем выбранные блюда в БД
    if (selectedMenuItemIds && selectedMenuItemIds.length > 0) {
      await PollService.updatePoll(poll.id, {
        selectedMenuItemIds: JSON.stringify(selectedMenuItemIds),
      });
      logger.info('✅ Selected menu items saved', { pollId: poll.id, count: selectedMenuItemIds.length });
    }

    // 🔄 Обновляем expectedParticipants при создании голосования (Вариант 5)
    try {
      const realCount = await GroupService.getRealMemberCount(
        group.telegramId.toString(),
        botInstance
      );
      
      if (realCount && realCount > 0) {
        const currentSettings = await GroupService.getGroupSettings(poll.groupId);
        await GroupService.updateGroupSettings(poll.groupId, {
          ...currentSettings,
          expectedParticipants: realCount
        });
        logger.info(`✅ Set expectedParticipants for new poll ${poll.id}: ${realCount} members`);
      } else {
        logger.warn(`⚠️ Could not get real member count for group ${group.id}, using fallback`);
      }
    } catch (error) {
      logger.error('Error updating expectedParticipants on poll creation:', error);
      // Не критично - продолжаем работу
    }

    // Формируем уведомление для группы (БЕЗ inline-кнопок, только кнопка Mini App)
    const endTime = new Date(Date.now() + duration * 60 * 1000);
    const message = createPollNotificationMessage({
      title: title || 'Голосование за обед',
      duration,
      menuItemsCount: menuItems.length,
      endTime,
    });

    // Создаём кнопку для открытия Mini App
    logger.info('⌨️ Creating keyboard');
    const keyboard = createVoteWebAppKeyboard(poll.id);
    logger.info('✅ Keyboard created', { keyboard });

    // Отправляем сообщение в группу
    // ВАЖНО: Преобразуем BigInt в число для совместимости с Grammy API
    const chatId = typeof group.telegramId === 'bigint' 
      ? Number(group.telegramId) 
      : group.telegramId;
    
    logger.info('📤 Sending message to group', { chatId, messageLength: message.length });
    
    const sentMessage = await botInstance()!.api.sendMessage(
      chatId,
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );

    logger.info('✅ Poll message sent to group', {
      pollId: poll.id,
      groupId: group.telegramId.toString(),
      messageId: sentMessage.message_id,
    });

    // Сохраняем chatId и messageId в БД для последующих уведомлений
    await PollService.updatePoll(poll.id, {
      chatId: BigInt(chatId),
      messageId: sentMessage.message_id,
    });
    logger.info('✅ Poll updated with chatId and messageId');

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

    logger.info('🎉 Poll created successfully!', { pollId: poll.id, messageId: sentMessage.message_id });
    
    return {
      pollId: poll.id,
      messageId: sentMessage.message_id,
    };
  } catch (error) {
    logger.error('❌ Error creating poll from WebApp:', error);
    throw error;
  }
}

/**
 * Автоматическое завершение голосования
 * UX UPGRADE (Фаза 2.0): Редактирование одного сообщения вместо создания новых
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

    logger.info(`[UX 2.0] Auto-completing poll ${pollId} - editing existing message`);

    // Завершаем голосование
    const result = await PollService.completePoll(pollId);

    // Получаем детальную разбивку голосов
    const breakdown = await PollService.getPollVoteBreakdown(pollId);
    const votes = await VoteService.getPollVotes(pollId);

    // Получаем информацию о голосовании для сообщения
    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      logger.error(`Poll ${pollId} not found`);
      return;
    }

    // Получаем количество блюд
    const menuItems = JSON.parse(poll.selectedMenuItemIds || '[]');
    const itemCount = menuItems.length || 0;

    // ФАЗА 1: Редактируем сообщение - добавляем результаты (БЕЗ ответственного)
    try {
      const { createCompactPollMessage, createCompactPollKeyboard } = await import('../bot/keyboards/poll.keyboard');

      const completedMessage = createCompactPollMessage(
        poll,
        itemCount,
        votes.length,
        0,
        {
          status: 'completed',
          breakdown
        }
      );

      const completedKeyboard = createCompactPollKeyboard(pollId, 'completed');

      await botInstance()!.api.editMessageText(
        chatId,
        messageId,
        completedMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: completedKeyboard
        }
      );

      logger.info(`[UX 2.0] Poll message updated with results (phase 1)`);
    } catch (error) {
      logger.error('Could not edit poll message with results:', error);
    }

    if (result.totalVotes > 0) {
      try {
        const { CategoryOrderService } = await import('./category-order.service');
        const { MultiCategoryResponsibleService } = await import('./multi-category-responsible.service');

        const categoryOrders = await CategoryOrderService.createCategoryOrders(pollId);
        logger.info(`[UX 2.0] Created ${categoryOrders.length} category orders for poll ${pollId}`);

        await MultiCategoryResponsibleService.startMultiCategorySelection(pollId);
        logger.info(`[UX 2.0] Started multi-category responsible selection for poll ${pollId}`);
      } catch (multiCategoryError) {
        logger.error('Failed to start multi-category flow in auto-complete, fallback to legacy flow:', multiCategoryError);

        // Legacy fallback to keep auto-complete resilient
        let responsibleUser = null;
        if (process.env.AUTO_ROULETTE_ENABLED === 'true') {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const rouletteResult = await PollService.runRoulette(pollId);
          responsibleUser = (rouletteResult as any).responsibleUser;
        }
        await sendPersonalNotifications(pollId, breakdown, responsibleUser);
      }
    }

    logger.info(`[UX 2.0] Poll ${pollId} completed successfully - 1 message instead of 3-4!`);
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
  const responsiblePaymentInfo = responsibleUser
    ? await UserService.getPaymentInfo(responsibleUser.id)
    : null;
  if (responsibleUser && !responsiblePaymentInfo?.paymentCard && !responsiblePaymentInfo?.paymentPhone) {
    logger.warn('Responsible has no payment details', {
      responsibleId: responsibleUser.id,
      pollId,
    });
  }

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

            const usernameTag = responsibleUser.username
              ? `@${responsibleUser.username}`
              : 'тега нет(('
            message += `📱 Тег в Telegram: ${usernameTag}\n`;

            // Добавляем платёжные данные если есть
            if (responsiblePaymentInfo?.paymentCard) {
              message += `💳 Карта: \`${responsiblePaymentInfo.paymentCard}\`\n`;
            }
            
            if (responsiblePaymentInfo?.paymentPhone) {
              message += `📱 Телефон: ${responsiblePaymentInfo.paymentPhone}\n`;
            }

            if (responsiblePaymentInfo?.paymentDetails) {
              message += `📝 Детали: ${responsiblePaymentInfo.paymentDetails}\n`;
            }

            if (!responsiblePaymentInfo?.paymentCard && !responsiblePaymentInfo?.paymentPhone) {
              message += `\n⚠️ Ответственный ещё не указал платёжные данные.\n`;
              message += `📍 Свяжитесь с ним напрямую для уточнения деталей оплаты.`;
            }
          }

          await botInstance()!.api.sendMessage(
            Number(vote.user.telegramId),
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
