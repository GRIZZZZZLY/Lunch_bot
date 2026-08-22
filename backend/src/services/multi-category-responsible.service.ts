import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CategoryOrderService } from './category-order.service';
import { GroupService } from './group.service';
// SQLite: enum replaced with string constants
const CategorySelectionStatus = {
  VOLUNTEER_OPEN: 'VOLUNTEER_OPEN',
  SELECTED_AUTO: 'SELECTED_AUTO',
  SELECTED_VOLUNTEER: 'SELECTED_VOLUNTEER',
  SELECTED_ROULETTE: 'SELECTED_ROULETTE',
} as const;
import { RouletteService } from './roulette.service';
import { GamificationService } from './gamification.service';
import { getXPReward } from '../constants/xp-constants';
import { now, addMinutesToDate } from '../utils/date';
import { getBotInstance } from '../bot/bot-instance';

/** @deprecated No-op: bot is now accessed via the shared singleton */
export function initializeMultiCategoryResponsibleServiceBot(
  _bot: unknown
): void {}

const pendingCategorySelections = new Map<number, Set<number>>();

export class MultiCategoryResponsibleService {
  private static buildCategorySelectionMessage(
    categoryOrders: any[],
    pendingSelections: Set<number>
  ): { message: string; keyboard: { inline_keyboard: any[][] } } {
    let message = '🍽 *Категории заказа*\n\n';

    categoryOrders.forEach((order: any) => {
      if (order.participantCount <= 1) {
        const responsibleName = order.responsibleUser?.firstName || '—';
        message += `✅ ${order.category} — ${responsibleName} (авто)\n`;
        return;
      }

      if (pendingSelections.has(order.id)) {
        message += `⏳ ${order.category} — ${order.participantCount} участников\n`;
        return;
      }

      const responsibleName = order.responsibleUser?.firstName || '—';
      message += `✅ ${order.category} — ${responsibleName}\n`;
    });

    const keyboardRows: any[][] = [];
    categoryOrders.forEach((order: any) => {
      if (!pendingSelections.has(order.id)) return;

      keyboardRows.push([
        {
          text: `🙋‍♂️ ${order.category}`,
          callback_data: `volunteer_category:${order.id}`,
        },
      ]);
    });

    if (pendingSelections.size === 0) {
      message += '\n✅ Все категории распределены.';
    } else {
      message += '\nНажми кнопку, чтобы стать ответственным.';
    }

    return {
      message,
      keyboard: { inline_keyboard: keyboardRows },
    };
  }

  private static async updateCategorySelectionMessage(
    pollId: number
  ): Promise<void> {
    try {
      // Один вызов, один const: смысл метода — отредактировать сообщение
      // опроса, без бота делать это нечем.
      const bot = getBotInstance();
      if (!bot) {
        return;
      }

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: {
          chatId: true,
          messageId: true,
          duration: true,
          startedAt: true,
          selectedMenuItemIds: true,
        },
      });

      if (!poll?.chatId || !poll.messageId) {
        logger.error('Poll chatId or messageId not found', { pollId });
        return;
      }

      const categoryOrders =
        await CategoryOrderService.getCategoryOrdersForPoll(pollId);
      const pendingSelections =
        pendingCategorySelections.get(pollId) ?? new Set();
      const { message: selectionMessage, keyboard } =
        this.buildCategorySelectionMessage(categoryOrders, pendingSelections);

      if (pendingSelections.size === 0) {
        pendingCategorySelections.delete(pollId);
      }

      const { createCompactPollMessage } = await import(
        '../bot/keyboards/poll.keyboard'
      );
      const { VoteService } = await import('./vote.service');

      const breakdown = await VoteService.getVoteBreakdown(pollId);
      const totalVotes = breakdown.reduce(
        (sum: number, item: any) => sum + item.votes,
        0
      );

      let itemCount = 0;
      if (poll.selectedMenuItemIds) {
        try {
          const menuItemIds = JSON.parse(poll.selectedMenuItemIds);
          itemCount = Array.isArray(menuItemIds) ? menuItemIds.length : 0;
        } catch (error) {
          logger.warn('Failed to parse selectedMenuItemIds', { pollId, error });
        }
      }

      const baseMessage = createCompactPollMessage(
        poll,
        itemCount,
        totalVotes,
        0,
        {
          status: 'completed',
          breakdown,
          suppressResponsiblePrompt: true,
        }
      );

      const combinedMessage = `${baseMessage}\n\n${selectionMessage}`;

      await bot.api.editMessageText(
        Number(poll.chatId),
        poll.messageId,
        combinedMessage,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      logger.error('Error updating category selection message:', error);
    }
  }
  /**
   * Start multi-category responsible selection process
   */
  static async startMultiCategorySelection(pollId: number): Promise<void> {
    try {
      // Get all CategoryOrders for this poll
      const categoryOrders =
        await CategoryOrderService.getCategoryOrdersForPoll(pollId);

      if (categoryOrders.length === 0) {
        logger.warn('No CategoryOrders found for poll', { pollId });
        return;
      }

      logger.info(
        `Starting multi-category selection for poll ${pollId}: ${categoryOrders.length} categories`
      );

      const pendingSelectionIds: number[] = [];
      const pendingSelections = new Set<number>();

      // Process each category
      for (const categoryOrder of categoryOrders) {
        // Skip if already has responsible (single participant auto-assigned)
        if (
          categoryOrder.selectionStatus !==
          CategorySelectionStatus.VOLUNTEER_OPEN
        ) {
          logger.info(
            `Category "${categoryOrder.category}" already resolved, skipping selection`
          );
          if (categoryOrder.responsibleUser) {
            await this.sendResponsibleNotifications(
              categoryOrder,
              categoryOrder.responsibleUser
            );
          }
          continue;
        }

        pendingSelectionIds.push(categoryOrder.id);
        pendingSelections.add(categoryOrder.id);
      }

      if (pendingSelectionIds.length === 0) {
        return;
      }

      pendingCategorySelections.set(pollId, pendingSelections);
      await this.updateCategorySelectionMessage(pollId);

      for (const categoryOrderId of pendingSelectionIds) {
        await this.sendVolunteerPromptForCategory(categoryOrderId);
      }
    } catch (error) {
      logger.error('Error starting multi-category selection:', error);
      throw error;
    }
  }

  /**
   * Send volunteer prompt for a specific category
   */
  static async sendVolunteerPromptForCategory(
    categoryOrderId: number
  ): Promise<void> {
    try {
      /* Guard'а на бота здесь нет намеренно. Метод не отправляет сообщений —
         он только ставит таймаут фолбэка на рулетку, а сама рулетка работает
         с БД. Прежняя проверка `if (!botInstance)` была недостижима (сверялась
         ссылка на функцию), и таймаут ставился всегда; ранний выход отсюда
         оставил бы категорию в VOLUNTEER_OPEN навсегда. */
      const categoryOrder =
        await CategoryOrderService.getCategoryOrder(categoryOrderId);

      if (!categoryOrder) {
        logger.error('CategoryOrder not found', { categoryOrderId });
        return;
      }

      logger.info(
        `Volunteer prompt queued for category "${categoryOrder.category}"`
      );

      // Set timeout for roulette fallback
      setTimeout(
        () => this.handleVolunteerTimeoutForCategory(categoryOrderId),
        3 * 60 * 1000
      );
    } catch (error) {
      logger.error('Error sending volunteer prompt for category:', error);
    }
  }

  /**
   * Handle volunteer for a specific category
   */
  static async handleVolunteerForCategory(
    categoryOrderId: number,
    telegramId: bigint
  ): Promise<boolean> {
    try {
      const categoryOrder =
        await CategoryOrderService.getCategoryOrder(categoryOrderId);

      if (!categoryOrder) {
        logger.error('CategoryOrder not found', { categoryOrderId });
        return false;
      }

      // Check if already assigned
      if (
        categoryOrder.selectionStatus !== CategorySelectionStatus.VOLUNTEER_OPEN
      ) {
        logger.info('Category already has responsible assigned', {
          categoryOrderId,
        });
        return false;
      }

      const user = await prisma.user.findUnique({
        where: { telegramId },
      });

      if (!user) {
        logger.error('User not found for category volunteer action');
        return false;
      }

      if (
        !(await GroupService.isUserGroupMember(
          user.id,
          categoryOrder.poll.groupId
        ))
      ) {
        logger.warn('Inactive group member cannot volunteer for category', {
          userId: user.id,
          categoryOrderId,
        });
        return false;
      }

      // Get participants for this category
      const participants =
        await CategoryOrderService.getParticipants(categoryOrderId);

      // Verify user is a participant
      if (!participants.includes(user.id)) {
        logger.warn('User is not a participant in this category', {
          userId: user.id,
          categoryOrderId,
        });

        const bot = getBotInstance();
        if (bot) {
          await bot.api.sendMessage(
            telegramId.toString(),
            '❌ Ты не участвуешь в этой категории!'
          );
        }
        return false;
      }

      // Check if user is already responsible for another category in this poll
      const existingResponsibility = await prisma.categoryOrder.findFirst({
        where: {
          pollId: categoryOrder.pollId,
          responsibleUserId: user.id,
          id: { not: categoryOrderId },
        },
      });

      if (existingResponsibility) {
        logger.warn('User already responsible for another category', {
          userId: user.id,
          existingCategoryOrderId: existingResponsibility.id,
        });

        const bot = getBotInstance();
        if (bot) {
          await bot.api.sendMessage(
            telegramId.toString(),
            `❌ Ты уже ответственный за "${existingResponsibility.category}"! Один человек = одна категория.`
          );
        }
        return false;
      }

      // Assign responsible
      await CategoryOrderService.setResponsible(
        categoryOrderId,
        user.id,
        'volunteer'
      );

      const pending = pendingCategorySelections.get(categoryOrder.pollId);
      if (pending) {
        pending.delete(categoryOrderId);
      }

      await this.updateCategorySelectionMessage(categoryOrder.pollId);

      // Send notifications
      await this.sendResponsibleNotifications(categoryOrder, user);

      // Award XP for volunteering
      const xpReward = getXPReward('VOLUNTEER_RESPONSIBLE');
      await GamificationService.awardXP(
        user.id,
        xpReward.amount,
        xpReward.reason,
        xpReward.category,
        { categoryOrderId, selectionMode: 'volunteer' },
        `category-volunteer:${categoryOrderId}:${user.id}`
      );

      logger.info(
        `User ${user.id} volunteered as responsible for category "${categoryOrder.category}"`
      );
      return true;
    } catch (error) {
      logger.error('Error handling volunteer for category:', error);
      return false;
    }
  }

  /**
   * Handle volunteer timeout for a category (run roulette)
   */
  static async handleVolunteerTimeoutForCategory(
    categoryOrderId: number
  ): Promise<void> {
    try {
      const categoryOrder =
        await CategoryOrderService.getCategoryOrder(categoryOrderId);

      if (!categoryOrder) {
        logger.error('CategoryOrder not found', { categoryOrderId });
        return;
      }

      // Check if still needs responsible
      if (
        categoryOrder.selectionStatus !== CategorySelectionStatus.VOLUNTEER_OPEN
      ) {
        logger.info('Category already has responsible, skipping timeout', {
          categoryOrderId,
        });
        return;
      }

      logger.info(
        `Volunteer timeout for category "${categoryOrder.category}", running roulette`
      );

      await this.runRouletteForCategory(categoryOrderId);
    } catch (error) {
      logger.error('Error handling volunteer timeout for category:', error);
    }
  }

  /**
   * Run roulette selection for a category
   */
  static async runRouletteForCategory(categoryOrderId: number): Promise<void> {
    try {
      const categoryOrder =
        await CategoryOrderService.getCategoryOrder(categoryOrderId);

      if (!categoryOrder) {
        logger.error('CategoryOrder not found', { categoryOrderId });
        return;
      }

      // Get participants
      const participantIds =
        await CategoryOrderService.getParticipants(categoryOrderId);

      if (participantIds.length === 0) {
        logger.error('No participants found for roulette', { categoryOrderId });
        return;
      }

      // Filter out users who are already responsible for other categories
      const availableUserIds: number[] = [];
      for (const userId of participantIds) {
        const existingResponsibility = await prisma.categoryOrder.findFirst({
          where: {
            pollId: categoryOrder.pollId,
            responsibleUserId: userId,
            id: { not: categoryOrderId },
          },
        });

        if (!existingResponsibility) {
          availableUserIds.push(userId);
        }
      }

      if (availableUserIds.length === 0) {
        // All participants already responsible for other categories
        // Fall back to any participant
        logger.warn(
          'All participants already responsible, using all participants',
          { categoryOrderId }
        );
        availableUserIds.push(...participantIds);
      }

      // Run roulette
      const winnerId =
        availableUserIds[Math.floor(Math.random() * availableUserIds.length)];

      // Assign responsible
      await CategoryOrderService.setResponsible(
        categoryOrderId,
        winnerId,
        'roulette'
      );

      const winner = await prisma.user.findUnique({
        where: { id: winnerId },
      });

      if (!winner) {
        logger.error('Winner not found', { winnerId });
        return;
      }

      // Send notifications
      await this.sendResponsibleNotifications(categoryOrder, winner);

      // Award XP for being selected (less than volunteering)
      const xpReward = getXPReward('ROULETTE_RESPONSIBLE');
      await GamificationService.awardXP(
        winnerId,
        xpReward.amount,
        xpReward.reason,
        xpReward.category,
        { categoryOrderId, selectionMode: 'roulette' },
        `category-roulette:${categoryOrderId}:${winnerId}`
      );

      const pending = pendingCategorySelections.get(categoryOrder.pollId);
      if (pending) {
        pending.delete(categoryOrderId);
      }

      await this.updateCategorySelectionMessage(categoryOrder.pollId);

      logger.info(
        `Roulette selected user ${winnerId} as responsible for category "${categoryOrder.category}"`
      );
    } catch (error) {
      logger.error('Error running roulette for category:', error);
    }
  }

  /**
   * Send notifications to responsible and other participants
   */
  private static async sendResponsibleNotifications(
    categoryOrder: any,
    responsible: any
  ): Promise<void> {
    try {
      const bot = getBotInstance();
      if (!bot) {
        return;
      }

      // Notify responsible
      await bot.api.sendMessage(
        responsible.telegramId.toString(),
        `✅ Ты ответственный за "${categoryOrder.category}" (${categoryOrder.participantCount} чел.)!\n\n` +
          `Открой приложение и нажми "Открыть калькулятор" на главной странице.`
      );

      // Notify other participants and store their message IDs
      const participantIds = await CategoryOrderService.getParticipants(
        categoryOrder.id
      );

      const participantMessages: Record<
        string,
        { messageId: number; chatId: string }
      > = {};

      for (const userId of participantIds) {
        if (userId === responsible.id) {
          continue; // Skip responsible
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          continue;
        }

        const sentMsg = await bot.api.sendMessage(
          user.telegramId.toString(),
          `⏳ Ожидаем расчёт от ${responsible.firstName} для категории "${categoryOrder.category}"`
        );

        // Store message ID so we can edit it later when calculation is done
        participantMessages[userId.toString()] = {
          messageId: sentMsg.message_id,
          chatId: user.telegramId.toString(),
        };
      }

      // Persist participant message IDs to CategoryOrder
      if (Object.keys(participantMessages).length > 0) {
        await prisma.categoryOrder.update({
          where: { id: categoryOrder.id },
          data: { participantMessages: JSON.stringify(participantMessages) },
        });
      }

      logger.info(
        `Sent notifications for category "${categoryOrder.category}" to responsible and ${participantIds.length - 1} participants`
      );
    } catch (error) {
      logger.error('Error sending responsible notifications:', error);
    }
  }
}
