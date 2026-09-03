import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { UserService } from './user.service';
import { GroupService } from './group.service';
import { RouletteService } from './roulette.service';
import { GamificationService } from './gamification.service';
import { getXPReward } from '../constants/xp-constants';
import { now, addMinutesToDate, getTimestamp } from '../utils/date';
import { toNumber, multiply } from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';
import { PollQueryService } from './poll-query.service';
import { escapeMarkdown } from '../utils/telegram-html';

export class ResponsibleService {
  /**
   * Запуск процесса выбора ответственного
   */
  static async startResponsibleSelection(pollId: number): Promise<void> {
    try {
      const poll = await PollQueryService.getPollById(pollId);
      if (!poll) {
        logger.error('Poll not found for responsible selection', { pollId });
        return;
      }

      const settings = await GroupService.getGroupSettings(poll.groupId);
      const mode =
        settings.responsibleSelectionMode || 'volunteer_with_fallback';

      logger.info('Starting responsible selection', { pollId, mode });

      // Создаем запись процесса
      const selection = await prisma.responsibleSelection.create({
        data: {
          pollId,
          mode,
          status: 'WAITING',
          timeoutAt: mode.includes('volunteer')
            ? addMinutesToDate(now(), settings.volunteerTimeoutMinutes || 3)
            : null,
          timeoutMinutes: settings.volunteerTimeoutMinutes || 3,
          chatId: poll.chatId,
        },
      });

      if (mode === 'roulette') {
        // Сразу рулетка
        await this.runRouletteAndProceed(pollId);
      } else {
        // Отправляем кнопку в группу
        await this.sendVolunteerPrompt(pollId, selection);
      }
    } catch (error) {
      logger.error('Error starting responsible selection:', error);
      throw error;
    }
  }

  /**
   * Отправка сообщения с кнопкой "Я оформлю!"
   */
  static async sendVolunteerPrompt(
    pollId: number,
    selection: any
  ): Promise<void> {
    try {
      /* Один вызов, один const. Раннего выхода тут нет намеренно: таймаут
         фолбэка на рулетку и сохранение messageId должны происходить и без
         бота — иначе выбор ответственного встанет насовсем. Прежняя проверка
         `if (!botInstance)` была недостижима (сверялась ссылка на функцию),
         так что до этих шагов код доходил всегда. */
      const bot = getBotInstance();
      if (!bot) {
        logger.error('Bot instance not initialized');
      }

      const poll = (await PollQueryService.getPollById(pollId)) as any;
      if (!poll?.result?.rouletteData) {
        logger.error('Poll result data not found', { pollId });
        return;
      }

      const resultData = JSON.parse(poll.result.rouletteData);

      // Рассчитываем общую сумму
      const totalAmount = resultData.winners.reduce(
        (sum: number, w: any) =>
          sum + multiply(w.menuItemSnapshot.price, w.voteCount),
        0
      );

      const message = `
✅ *Голосование завершено!*

📊 *РЕЗУЛЬТАТЫ:*

${resultData.winners
  .map(
    (w: any, i: number) =>
      `${i + 1}. ${escapeMarkdown(w.menuItemName ?? '')} — ${w.voteCount} чел. (${multiply(w.menuItemSnapshot.price, w.voteCount).toFixed(2)}₽)`
  )
  .join('\n')}

${resultData.bringOwn.count > 0 ? `\n🥪 Принесут своё — ${resultData.bringOwn.count} чел.` : ''}

💰 *Общая сумма: ${totalAmount}₽*
👥 *Участников: ${resultData.winners.reduce((sum: number, w: any) => sum + w.voteCount, 0)}*

🙋‍♂️ *Кто готов оформить заказ и оплатить?*

⏱️ Ожидание: ${selection.timeoutMinutes || 3} минут(ы)
Если никто не откликнется, запустится рулетка.
`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '🙋‍♂️ Я оформлю!', callback_data: `volunteer:${pollId}` }],
        ],
      };

      let messageId = poll.messageId ?? undefined;
      const chatId = poll.chatId ? Number(poll.chatId) : null;

      if (chatId && messageId && bot) {
        await bot.api.editMessageText(chatId, messageId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        logger.info('Volunteer prompt updated in poll message', {
          pollId,
          messageId,
        });
      } else if (chatId && bot) {
        const sentMessage = await bot.api.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        messageId = sentMessage.message_id;
        logger.info('Volunteer prompt sent', { pollId, messageId });
      }

      if (messageId) {
        // Сохраняем messageId
        await prisma.responsibleSelection.update({
          where: { id: selection.id },
          data: { messageId },
        });
      }

      // Устанавливаем таймаут
      setTimeout(
        () => this.handleVolunteerTimeout(pollId),
        (selection.timeoutMinutes || 3) * 60 * 1000
      );
    } catch (error) {
      logger.error('Error sending volunteer prompt:', error);
    }
  }

  /**
   * Обработка отклика добровольца
   */
  static async handleVolunteer(
    pollId: number,
    telegramId: number
  ): Promise<boolean> {
    try {
      const selection = await prisma.responsibleSelection.findUnique({
        where: { pollId },
      });

      if (!selection || selection.status !== 'WAITING') {
        logger.info('Selection not waiting or already completed', {
          pollId,
          status: selection?.status,
        });
        return false;
      }

      const user = await UserService.getUserByTelegramId(BigInt(telegramId));
      if (!user) {
        logger.error('User not found for volunteer action');
        return false;
      }

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: { groupId: true },
      });
      const isEligible =
        poll &&
        (await GroupService.isUserGroupMember(user.id, poll.groupId)) &&
        (await prisma.pollParticipant.count({
          where: {
            pollId,
            userId: user.id,
            status: 'EXPECTED',
          },
        })) === 1;
      if (!isEligible) {
        logger.warn('Volunteer action rejected for ineligible user', {
          pollId,
          userId: user.id,
        });
        return false;
      }

      const claimed = await prisma.responsibleSelection.updateMany({
        where: { id: selection.id, status: 'WAITING' },
        data: {
          status: 'VOLUNTEER_SELECTED',
          selectedUserId: user.id,
          volunteerUserId: user.id,
          completedAt: now(),
        },
      });
      if (claimed.count !== 1) {
        return false;
      }

      logger.info('Volunteer selected', { pollId, userId: user.id });

      // Sprint 6: XP интеграция за волонтёрство
      try {
        const reward = getXPReward('VOLUNTEER_RESPONSIBLE');
        await GamificationService.awardXP(
          user.id,
          reward.amount,
          reward.reason,
          reward.category,
          { pollId, selectionMode: 'volunteer' },
          `poll-volunteer:${pollId}:${user.id}`
        );
        logger.info(
          `XP awarded: ${reward.amount} to user ${user.id} for volunteering`
        );
      } catch (xpError) {
        logger.error('Failed to award XP for volunteer:', xpError);
        // Не прерываем основной процесс
      }

      // Обновляем сообщение в группе (бота может не быть — редактирование
      // сообщения необязательно, переход к фазе 4 идёт всё равно)
      const bot = getBotInstance();
      if (selection.messageId && selection.chatId && bot) {
        try {
          await bot.api.editMessageText(
            Number(selection.chatId),
            selection.messageId,
            `✅ *Голосование завершено!*\n\n🎯 *Ответственный:* ${escapeMarkdown(user.firstName ?? '')}\n\n💰 Детали заказа и реквизиты отправлены всем в личные сообщения.`,
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          logger.error('Error editing volunteer message:', editError);
        }
      }

      // Переход к фазе 4
      const { PollFlowService } = await import('./poll-flow.service.js');
      await PollFlowService.processResponsibleSelected(pollId, user.id);
      return true;
    } catch (error) {
      logger.error('Error handling volunteer:', error);
      return false;
    }
  }

  /**
   * Обработка таймаута (fallback на рулетку)
   */
  static async handleVolunteerTimeout(pollId: number): Promise<void> {
    try {
      const selection = await prisma.responsibleSelection.findUnique({
        where: { pollId },
      });

      if (!selection || selection.status !== 'WAITING') {
        logger.info('Selection not waiting, skipping timeout', { pollId });
        return;
      }

      logger.info('Volunteer timeout reached, falling back to roulette', {
        pollId,
      });

      const timedOut = await prisma.responsibleSelection.updateMany({
        where: { id: selection.id, status: 'WAITING' },
        data: { status: 'TIMEOUT' },
      });
      if (timedOut.count !== 1) {
        return;
      }

      const bot = getBotInstance();
      if (selection.messageId && selection.chatId && bot) {
        try {
          await bot.api.editMessageText(
            Number(selection.chatId),
            selection.messageId,
            `⏰ *Время истекло!*\n\n🎲 Никто не откликнулся, запускаем рулетку...`,
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          logger.error('Error editing timeout message:', editError);
        }
      }

      await this.runRouletteAndProceed(pollId);
    } catch (error) {
      logger.error('Error handling volunteer timeout:', error);
    }
  }

  /**
   * Запуск рулетки и переход к созданию транзакций
   */
  static async runRouletteAndProceed(pollId: number): Promise<void> {
    try {
      logger.info('Running roulette for responsible selection', { pollId });

      const rouletteService = new RouletteService();
      const result = await rouletteService.runRoulette(pollId);

      // Обновляем только ответственного, не перезаписываем rouletteData
      // rouletteData содержит результаты голосования (multi-winner) и нужен для расчета транзакций
      await prisma.pollResult.update({
        where: { pollId },
        data: {
          responsibleUserId: result.responsibleUserId,
        },
      });

      await prisma.responsibleSelection.update({
        where: { pollId },
        data: {
          status: 'ROULETTE_RUN',
          selectedUserId: result.responsibleUserId,
          rouletteWinnerId: result.responsibleUserId,
          completedAt: now(),
        },
      });

      logger.info('Roulette completed', {
        pollId,
        responsibleUserId: result.responsibleUserId,
      });

      // Обновляем сообщение в группе (если было сообщение выбора)
      const selection = await prisma.responsibleSelection.findUnique({
        where: { pollId },
      });

      const bot = getBotInstance();
      if (selection?.messageId && selection.chatId && bot) {
        try {
          await bot.api.editMessageText(
            Number(selection.chatId),
            selection.messageId,
            `🎲 *Рулетка выбрала ответственного!*

🎯 *Ответственный:* ${escapeMarkdown(result.responsibleUserName ?? '')}

💰 Детали заказа и реквизиты отправлены всем в личные сообщения.`,
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          logger.error('Error editing roulette result message:', editError);
        }
      }

      // Sprint 6: XP интеграция за выбор рулеткой
      try {
        const reward = getXPReward('SELECTED_RESPONSIBLE');
        await GamificationService.awardXP(
          result.responsibleUserId,
          reward.amount,
          reward.reason,
          reward.category,
          { pollId, selectionMode: 'roulette' },
          `poll-roulette:${pollId}:${result.responsibleUserId}`
        );
        logger.info(
          `XP awarded: ${reward.amount} to user ${result.responsibleUserId} for being selected by roulette`
        );
      } catch (xpError) {
        logger.error('Failed to award XP for roulette selection:', xpError);
        // Не прерываем основной процесс
      }

      // Переход к фазе 4
      const { PollFlowService } = await import('./poll-flow.service.js');
      await PollFlowService.processResponsibleSelected(
        pollId,
        result.responsibleUserId
      );
    } catch (error) {
      logger.error('Error running roulette:', error);
    }
  }
}
