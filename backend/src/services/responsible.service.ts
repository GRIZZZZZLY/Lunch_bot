import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { GroupService } from './group.service';
import { RouletteService } from './roulette.service';

let botInstance: any = null;

export function initializeResponsibleServiceBot(bot: any): void {
  botInstance = bot;
  logger.info('ResponsibleService bot instance initialized');
}

export class ResponsibleService {
  /**
   * Запуск процесса выбора ответственного
   */
  static async startResponsibleSelection(pollId: number): Promise<void> {
    try {
      const poll = await PollService.getPollById(pollId);
      if (!poll) {
        logger.error('Poll not found for responsible selection', { pollId });
        return;
      }

      const settings = await GroupService.getGroupSettings(poll.groupId);
      const mode = settings.responsibleSelectionMode || 'volunteer_with_fallback';

      logger.info('Starting responsible selection', { pollId, mode });

      // Создаем запись процесса
      const selection = await prisma.responsibleSelection.create({
        data: {
          pollId,
          mode,
          status: 'WAITING',
          timeoutAt: mode.includes('volunteer')
            ? new Date(Date.now() + (settings.volunteerTimeoutMinutes || 3) * 60 * 1000)
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
  static async sendVolunteerPrompt(pollId: number, selection: any): Promise<void> {
    try {
      if (!botInstance) {
        logger.error('Bot instance not initialized');
        return;
      }

      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) {
        logger.error('Poll result data not found', { pollId });
        return;
      }

      const resultData = JSON.parse(poll.result.rouletteData);

      // Рассчитываем общую сумму
      const totalAmount = resultData.winners.reduce(
        (sum: number, w: any) => sum + (w.menuItemSnapshot.price || 0) * w.voteCount,
        0
      );

      const message = `
✅ *Голосование завершено!*

📊 *РЕЗУЛЬТАТЫ:*

${resultData.winners
  .map(
    (w: any, i: number) =>
      `${i + 1}. ${w.menuItemName} — ${w.voteCount} чел. (${(w.menuItemSnapshot.price || 0) * w.voteCount}₽)`
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
        inline_keyboard: [[{ text: '🙋‍♂️ Я оформлю!', callback_data: `volunteer:${pollId}` }]],
      };

      const sentMessage = await botInstance.api.sendMessage(Number(poll.chatId), message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      // Сохраняем messageId
      await prisma.responsibleSelection.update({
        where: { id: selection.id },
        data: { messageId: sentMessage.message_id },
      });

      logger.info('Volunteer prompt sent', { pollId, messageId: sentMessage.message_id });

      // Устанавливаем таймаут
      setTimeout(() => this.handleVolunteerTimeout(pollId), (selection.timeoutMinutes || 3) * 60 * 1000);
    } catch (error) {
      logger.error('Error sending volunteer prompt:', error);
    }
  }

  /**
   * Обработка отклика добровольца
   */
  static async handleVolunteer(pollId: number, telegramId: number): Promise<void> {
    try {
      const selection = await prisma.responsibleSelection.findUnique({
        where: { pollId },
      });

      if (!selection || selection.status !== 'WAITING') {
        logger.info('Selection not waiting or already completed', { pollId, status: selection?.status });
        return;
      }

      const user = await UserService.getUserByTelegramId(BigInt(telegramId));
      if (!user) {
        logger.error('User not found', { telegramId });
        return;
      }

      // Обновляем selection
      await prisma.responsibleSelection.update({
        where: { id: selection.id },
        data: {
          status: 'VOLUNTEER_SELECTED',
          selectedUserId: user.id,
          volunteerUserId: user.id,
          completedAt: new Date(),
        },
      });

      logger.info('Volunteer selected', { pollId, userId: user.id, firstName: user.firstName });

      // Обновляем сообщение в группе
      if (selection.messageId && selection.chatId && botInstance) {
        try {
          await botInstance.api.editMessageText(
            Number(selection.chatId),
            selection.messageId,
            `✅ *Голосование завершено!*\n\n🎯 *Ответственный:* ${user.firstName}\n\n💰 Детали заказа и реквизиты отправлены всем в личные сообщения.`,
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          logger.error('Error editing volunteer message:', editError);
        }
      }

      // Переход к фазе 4
      const { BudgetService } = await import('./budget.service.js');
      await BudgetService.processResponsibleSelected(pollId, user.id);
    } catch (error) {
      logger.error('Error handling volunteer:', error);
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

      logger.info('Volunteer timeout reached, falling back to roulette', { pollId });

      await prisma.responsibleSelection.update({
        where: { id: selection.id },
        data: { status: 'TIMEOUT' },
      });

      if (selection.messageId && selection.chatId && botInstance) {
        try {
          await botInstance.api.editMessageText(
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

      // Сохраняем результат (существующая логика)
      await PollService.savePollResult({
        pollId,
        winnerMenuItemId: result.winnerMenuItemId,
        responsibleUserId: result.responsibleUserId,
        totalVotes: result.totalVotes,
        rouletteData: JSON.stringify(result.animationData),
      });

      await prisma.responsibleSelection.update({
        where: { pollId },
        data: {
          status: 'ROULETTE_RUN',
          selectedUserId: result.responsibleUserId,
          rouletteWinnerId: result.responsibleUserId,
          completedAt: new Date(),
        },
      });

      logger.info('Roulette completed', { pollId, responsibleUserId: result.responsibleUserId });

      // Переход к фазе 4
      const { BudgetService } = await import('./budget.service.js');
      await BudgetService.processResponsibleSelected(pollId, result.responsibleUserId);
    } catch (error) {
      logger.error('Error running roulette:', error);
    }
  }
}
