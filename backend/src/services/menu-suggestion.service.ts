import { MenuSuggestion, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { toNumber } from '../utils/decimal';
import { GroupAccessError, GroupService } from './group.service';

export interface CreateSuggestionDTO {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  suggestedBy: number;
  groupId: number;
}

export interface SuggestionFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  suggestedBy?: number;
  groupId?: number;
  limit?: number;
  offset?: number;
}

/**
 * Сервис для работы с предложениями блюд от пользователей
 */
export class MenuSuggestionService {
  private static assertSuggestionGroup(
    suggestion: { groupId: number },
    groupId?: number
  ): void {
    if (groupId && suggestion.groupId !== groupId) {
      throw new GroupAccessError(
        'NOT_ADMIN',
        'Suggestion does not belong to the selected group'
      );
    }
  }

  /**
   * Создать новое предложение
   */
  static async createSuggestion(data: CreateSuggestionDTO): Promise<MenuSuggestion> {
    logger.info('Creating menu suggestion', { userId: data.suggestedBy });

    await GroupService.assertMember(data.suggestedBy, data.groupId);

    const suggestion = await prisma.menuSuggestion.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        suggestedBy: data.suggestedBy,
        groupId: data.groupId,
        status: 'PENDING',
      },
      include: {
        suggester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    logger.info(`Suggestion created with ID: ${suggestion.id}`);
    return suggestion;
  }

  /**
   * Получить все предложения с фильтрами
   */
  static async getSuggestions(filters: SuggestionFilters = {}) {
    const where: Prisma.MenuSuggestionWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.suggestedBy) {
      where.suggestedBy = filters.suggestedBy;
    }

    if (filters.groupId) {
      where.groupId = filters.groupId;
    }

    const suggestions = await prisma.menuSuggestion.findMany({
      where,
      include: {
        suggester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit,
      skip: filters.offset,
    });

    return suggestions;
  }

  /**
   * Получить предложение по ID
   */
  static async getSuggestionById(id: number) {
    const suggestion = await prisma.menuSuggestion.findUnique({
      where: { id },
      include: {
        suggester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    return suggestion;
  }

  /**
   * Одобрить предложение и создать блюдо в меню
   */
  static async approveSuggestion(
    suggestionId: number,
    reviewerId: number,
    groupId?: number
  ): Promise<{ suggestion: MenuSuggestion; menuItem: any }> {
    logger.info('Approving menu suggestion', {
      suggestionId,
      userId: reviewerId,
    });

    const suggestion = await prisma.menuSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion already processed');
    }

    // Создаём блюдо в меню той же группы, что и предложение
    this.assertSuggestionGroup(suggestion, groupId);

    const menuItem = await prisma.menuItem.create({
      data: {
        name: suggestion.name,
        description: suggestion.description,
        price: suggestion.price ? toNumber(suggestion.price) : null,
        imageUrl: suggestion.imageUrl,
        createdBy: reviewerId, // Админ становится создателем
        groupId: suggestion.groupId,
        isActive: true,
      },
    });

    // Обновляем статус предложения
    const updatedSuggestion = await prisma.menuSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        createdMenuItemId: menuItem.id,
      },
      include: {
        suggester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    logger.info(
      `Suggestion ${suggestionId} approved, created menu item ${menuItem.id}`
    );

    await this.notifySuggester(
      suggestionId,
      suggestion.suggestedBy,
      `✅ Твоё блюдо «${suggestion.name}» добавлено в меню!\n\nМожно голосовать за него в следующем заказе.`
    );

    return { suggestion: updatedSuggestion, menuItem };
  }

  /**
   * Отклонить предложение
   */
  static async rejectSuggestion(
    suggestionId: number,
    reviewerId: number,
    reason?: string,
    groupId?: number
  ): Promise<MenuSuggestion> {
    logger.info(`Rejecting suggestion ${suggestionId} by admin ${reviewerId}`);

    const suggestion = await prisma.menuSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion already processed');
    }

    this.assertSuggestionGroup(suggestion, groupId);

    const updatedSuggestion = await prisma.menuSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        suggester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    logger.info(`Suggestion ${suggestionId} rejected`);

    const explanation = reason
      ? `\n\nПричина: ${reason}`
      : '\n\nПричину администратор не указал — уточни в группе.';
    await this.notifySuggester(
      suggestionId,
      suggestion.suggestedBy,
      `❌ Блюдо «${suggestion.name}» не добавили в меню.${explanation}`
    );

    return updatedSuggestion;
  }

  /**
   * Сообщить автору предложения о решении администратора.
   *
   * Best-effort: решение уже записано в базу, и недоставленное сообщение не
   * должно превращать успешный запрос в ошибку. Раньше здесь стоял TODO, и
   * автор предложения не узнавал о судьбе своего блюда вообще никак —
   * endpoint работал, статус менялся, обратной связи не было.
   *
   * telegramId берём ОТДЕЛЬНЫМ запросом, а не через `include` в approve/reject:
   * результат тех методов уходит в ответ API, и добавление поля в `select`
   * означало бы, что Telegram-id автора начинает отдаваться наружу.
   */
  private static async notifySuggester(
    suggestionId: number,
    suggestedBy: number,
    message: string
  ): Promise<void> {
    try {
      const author = await prisma.user.findUnique({
        where: { id: suggestedBy },
        select: { telegramId: true },
      });

      if (author?.telegramId == null) {
        logger.warn(
          'Suggestion author has no telegramId, skipping notification',
          { suggestionId }
        );
        return;
      }

      /* Отправляем ОБЫЧНЫМ ТЕКСТОМ, без parse_mode. В сообщении нет
         форматирования, зато есть подставленные название блюда и причина
         отказа — то есть пользовательский ввод. С Markdown блюдо вида
         `Плов *акция*` или `Соус_1` даёт от Telegram 400 «can't parse
         entities», send() эту ошибку глотает, и автор молча не получает
         решение — ровно тот сбой, который эта правка и убирает. */
      const { notificationService } = await import('./notification.service');
      const { NotificationType } = await import('../types/notification.types');
      const result = await notificationService.send({
        userId: Number(author.telegramId),
        type: NotificationType.CUSTOM,
        message,
      });

      if (!result.success) {
        logger.warn('Suggestion decision was not delivered to the author', {
          suggestionId,
          error: result.error,
        });
      }
    } catch (error) {
      logger.warn('Could not notify suggestion author', {
        suggestionId,
        error,
      });
    }
  }

  /**
   * Получить количество ожидающих предложений
   */
  static async getPendingCount(groupId?: number): Promise<number> {
    const count = await prisma.menuSuggestion.count({
      where: {
        status: 'PENDING',
        ...(groupId ? { groupId } : {}),
      },
    });

    return count;
  }

  /**
   * Получить статистику предложений
   */
  static async getStats(groupId?: number) {
    const groupWhere = groupId ? { groupId } : {};
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.menuSuggestion.count({ where: groupWhere }),
      prisma.menuSuggestion.count({ where: { status: 'PENDING', ...groupWhere } }),
      prisma.menuSuggestion.count({ where: { status: 'APPROVED', ...groupWhere } }),
      prisma.menuSuggestion.count({ where: { status: 'REJECTED', ...groupWhere } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }

  /**
   * Удалить предложение.
   *
   * Два разных права на одну операцию:
   *  - автор отзывает СВОЁ, пока оно на рассмотрении. Ровно это и предлагает
   *    интерфейс участнику; раньше маршрут был закрыт админской мидлварой и
   *    кнопка не могла сработать ни разу;
   *  - админ группы убирает уже РАЗОБРАННОЕ. Ожидающее решения он не удаляет —
   *    сначала отклоняет, чтобы у автора осталась причина.
   */
  static async deleteSuggestion(
    suggestionId: number,
    actorId: number,
    groupId?: number
  ): Promise<void> {
    const suggestion = await prisma.menuSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    this.assertSuggestionGroup(suggestion, groupId);

    const isAuthor = suggestion.suggestedBy === actorId;
    const isPending = suggestion.status === 'PENDING';

    if (!(isAuthor && isPending)) {
      const moderates = await GroupService.isUserGroupAdmin(
        actorId,
        suggestion.groupId
      );
      if (!moderates) {
        throw new GroupAccessError(
          'NOT_ADMIN',
          'Удалить может автор своего предложения или админ группы'
        );
      }
      if (isPending) {
        throw new Error('Cannot delete pending suggestion. Reject it first.');
      }
    }

    await prisma.menuSuggestion.delete({
      where: { id: suggestionId },
    });

    logger.info(`Suggestion ${suggestionId} deleted`, { actorId, isAuthor });
  }
}

export default MenuSuggestionService;
