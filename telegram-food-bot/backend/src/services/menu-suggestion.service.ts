import { MenuSuggestion, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { toNumber } from '../utils/decimal';

export interface CreateSuggestionDTO {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  suggestedBy: number;
}

export interface SuggestionFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  suggestedBy?: number;
  limit?: number;
  offset?: number;
}

/**
 * Сервис для работы с предложениями блюд от пользователей
 */
export class MenuSuggestionService {
  /**
   * Создать новое предложение
   */
  static async createSuggestion(data: CreateSuggestionDTO): Promise<MenuSuggestion> {
    logger.info(`Creating menu suggestion: ${data.name} by user ${data.suggestedBy}`);

    const suggestion = await prisma.menuSuggestion.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        suggestedBy: data.suggestedBy,
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
    reviewerId: number
  ): Promise<{ suggestion: MenuSuggestion; menuItem: any }> {
    logger.info(`Approving suggestion ${suggestionId} by admin ${reviewerId}`);

    const suggestion = await prisma.menuSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion already processed');
    }

    // Создаём блюдо в меню
    const menuItem = await prisma.menuItem.create({
      data: {
        name: suggestion.name,
        description: suggestion.description,
        price: suggestion.price ? toNumber(suggestion.price) : null,
        imageUrl: suggestion.imageUrl,
        createdBy: reviewerId, // Админ становится создателем
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
            telegramId: true,
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

    return { suggestion: updatedSuggestion, menuItem };
  }

  /**
   * Отклонить предложение
   */
  static async rejectSuggestion(
    suggestionId: number,
    reviewerId: number,
    reason?: string
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
            telegramId: true,
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
    return updatedSuggestion;
  }

  /**
   * Получить количество ожидающих предложений
   */
  static async getPendingCount(): Promise<number> {
    const count = await prisma.menuSuggestion.count({
      where: {
        status: 'PENDING',
      },
    });

    return count;
  }

  /**
   * Получить статистику предложений
   */
  static async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.menuSuggestion.count(),
      prisma.menuSuggestion.count({ where: { status: 'PENDING' } }),
      prisma.menuSuggestion.count({ where: { status: 'APPROVED' } }),
      prisma.menuSuggestion.count({ where: { status: 'REJECTED' } }),
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
   * Удалить предложение (только для отклонённых и старых)
   */
  static async deleteSuggestion(suggestionId: number): Promise<void> {
    const suggestion = await prisma.menuSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Можно удалять только отклонённые предложения
    if (suggestion.status === 'PENDING') {
      throw new Error('Cannot delete pending suggestion. Reject it first.');
    }

    await prisma.menuSuggestion.delete({
      where: { id: suggestionId },
    });

    logger.info(`Suggestion ${suggestionId} deleted`);
  }
}

export default MenuSuggestionService;
