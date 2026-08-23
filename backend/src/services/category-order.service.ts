import { CategoryOrder, OrderItem, Prisma } from '@prisma/client';

// SQLite: enum replaced with string constants
const CategorySelectionStatus = {
  SELECTED_AUTO: 'SELECTED_AUTO',
  SELECTED_VOLUNTEER: 'SELECTED_VOLUNTEER',
  SELECTED_ROULETTE: 'SELECTED_ROULETTE',
  VOLUNTEER_OPEN: 'VOLUNTEER_OPEN',
} as const;
type CategorySelectionStatus =
  (typeof CategorySelectionStatus)[keyof typeof CategorySelectionStatus];
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { sumMoney, toDecimal } from '../utils/decimal';
import { BaseError } from '../utils/error';
import { eventBus } from './event-bus.service';
import {
  CalculationCompletedError,
  CategoryOrderNotFoundError,
  MAX_ADDITIONAL_COST,
  OrderInputError,
  ResponsibleAlreadyAssignedError,
} from './category-order.errors';

/**
 * Пропустить наши доменные ошибки наружу как есть.
 *
 * Каждый `catch` ниже пишет исходную ошибку в журнал и подменяет её на
 * «Failed to …». Для сбоя базы это правильно — наружу не должны уходить
 * внутренности. Но под ту же подмену попадали и осмысленные отказы, которые
 * этот же метод бросил парой строк выше: клиент получал 500 вместо 404/409.
 * `BaseError` несёт статус и код сам, поэтому подменять его нечем и не нужно.
 */
function rethrowDomainError(error: unknown): void {
  if (error instanceof BaseError) {
    throw error;
  }
}

/** Допустимая денежная сумма: конечное неотрицательное число не выше предела. */
function isAllowedAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_ADDITIONAL_COST;
}

/**
 * Итоги категорийного заказа: сумма позиций, сумма надбавок, общий итог.
 *
 * Один расчёт на два метода. До этого он был написан ДВАЖДЫ — в `updateCosts`
 * (надбавки пришли из запроса, сумма позиций читается из базы) и в
 * `recalculateTotals` (наоборот: позиции агрегируются, надбавки читаются), — и
 * обе записи складывали деньги обычным `+` над `number`. Две копии одной
 * формулы над колонками `Decimal` — это и есть та «complex conditional», из-за
 * которой Repowise поставил файлу −2.2: разойтись им ничто не мешало, а
 * расхождение видно не сразу, потому что на круглых суммах его нет.
 *
 * Возвращает `Decimal`, а НЕ `number`: приведение к `number` внутри расчёта и
 * есть источник погрешности. В `number` результат переводит только тот, кто
 * собирается его показать.
 */
function computeTotals(input: {
  itemsAmount: Prisma.Decimal | number | null | undefined;
  deliveryCost: Prisma.Decimal | number | null | undefined;
  serviceFee: Prisma.Decimal | number | null | undefined;
  tip: Prisma.Decimal | number | null | undefined;
}): {
  totalItemsAmount: Prisma.Decimal;
  totalAdditionalCosts: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
} {
  const totalItemsAmount = toDecimal(input.itemsAmount);
  const totalAdditionalCosts = sumMoney([
    input.deliveryCost,
    input.serviceFee,
    input.tip,
  ]);

  return {
    totalItemsAmount,
    totalAdditionalCosts,
    totalAmount: totalItemsAmount.plus(totalAdditionalCosts),
  };
}

export interface CreateCategoryOrderData {
  pollId: number;
  category: string;
  responsibleUserId?: number | null;
  selectionMode?: 'volunteer' | 'roulette' | 'auto' | null;
  selectionStatus: CategorySelectionStatus;
  participantCount: number;
}

export interface CategoryOrderWithDetails extends CategoryOrder {
  poll: {
    id: number;
    groupId: number;
    status: string;
  };
  responsibleUser: {
    id: number;
    telegramId: bigint;
    firstName: string;
    lastName: string | null;
    username: string | null;
  } | null;
  orderItems: OrderItem[];
  _count: {
    orderItems: number;
  };
}

export interface UpdateCostsData {
  deliveryCost?: number;
  serviceFee?: number;
  tip?: number;
  notes?: string;
}

export class CategoryOrderService {
  /**
   * Create CategoryOrders from poll votes grouped by category
   */
  static async createCategoryOrders(pollId: number): Promise<CategoryOrder[]> {
    try {
      // Get all votes for this poll grouped by category
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          menuItem: true,
          user: true,
        },
      });

      // Group votes by category
      const categoryMap = new Map<string, Set<number>>();

      for (const vote of votes) {
        if (!vote.menuItem) {
          logger.warn(`Skipping vote ${vote.id}: menuItem is missing`);
          continue;
        }

        const category = vote.menuItem.name?.trim();
        if (!category) {
          logger.warn(`Skipping vote ${vote.id}: menu item name is empty`);
          continue;
        }

        if (!categoryMap.has(category)) {
          categoryMap.set(category, new Set());
        }
        categoryMap.get(category)!.add(vote.userId);
      }

      /* Строки собираются в JS и вставляются одним запросом.
         Раньше на каждую категорию шёл свой `create`: завершение голосования
         на пять блюд — пять вставок подряд, и каждая со своим круговым
         походом в базу. Разница между категориями только в двух полях, так
         что делить это на два разных запроса нет причины.
         `createManyAndReturn` (PostgreSQL) отдаёт вставленные строки в порядке
         входных данных — вызывающий код и события ниже опираются на него. */
      const rows = [...categoryMap.entries()]
        .filter(([, userIds]) => userIds.size > 0)
        .map(([category, userIds]) => {
          const participantCount = userIds.size;
          // Один участник — он же и ответственный, выбирать не из кого.
          const soleParticipant =
            participantCount === 1 ? Array.from(userIds)[0] : null;

          return {
            pollId,
            category,
            responsibleUserId: soleParticipant,
            selectionStatus:
              soleParticipant !== null
                ? CategorySelectionStatus.SELECTED_AUTO
                : CategorySelectionStatus.VOLUNTEER_OPEN,
            // Multi-participant: no responsible until volunteer/roulette actually selects one
            selectionMode: soleParticipant !== null ? 'auto' : null,
            participantCount,
            calculationStatus: 'PENDING',
          };
        });

      const categoryOrders: CategoryOrder[] =
        rows.length === 0
          ? []
          : await prisma.categoryOrder.createManyAndReturn({ data: rows });

      for (const co of categoryOrders) {
        logger.info(
          co.responsibleUserId !== null
            ? `Created CategoryOrder ${co.id} for category "${co.category}" with auto-responsible user ${co.responsibleUserId}`
            : `Created CategoryOrder ${co.id} for category "${co.category}" with ${co.participantCount} participants (responsible pending)`
        );
      }

      logger.info(
        `Created ${categoryOrders.length} CategoryOrders for poll ${pollId}`
      );

      for (const co of categoryOrders) {
        eventBus.emit('category_order_updated', {
          categoryOrderId: co.id,
          pollId,
          type: 'created',
          timestamp: new Date().toISOString(),
        });
      }

      return categoryOrders;
    } catch (error) {
      logger.error('Error creating category orders:', error);
      throw new Error('Failed to create category orders');
    }
  }

  /**
   * Get CategoryOrders for a poll
   */
  static async getCategoryOrdersForPoll(
    pollId: number
  ): Promise<CategoryOrderWithDetails[]> {
    try {
      const categoryOrders = await prisma.categoryOrder.findMany({
        where: { pollId },
        include: {
          poll: {
            select: {
              id: true,
              groupId: true,
              status: true,
            },
          },
          responsibleUser: {
            select: {
              id: true,
              telegramId: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          orderItems: true,
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
        orderBy: {
          category: 'asc',
        },
      });

      return categoryOrders;
    } catch (error) {
      logger.error('Error getting category orders for poll:', error);
      throw new Error('Failed to get category orders');
    }
  }

  /**
   * Get a single CategoryOrder by ID
   */
  static async getCategoryOrder(
    id: number
  ): Promise<CategoryOrderWithDetails | null> {
    try {
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id },
        include: {
          poll: {
            select: {
              id: true,
              groupId: true,
              status: true,
            },
          },
          responsibleUser: {
            select: {
              id: true,
              telegramId: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          orderItems: {
            include: {
              user: {
                select: {
                  id: true,
                  telegramId: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },
            },
          },
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      return categoryOrder;
    } catch (error) {
      logger.error('Error getting category order:', error);
      throw new Error('Failed to get category order');
    }
  }

  /**
   * Set responsible user for a CategoryOrder
   */
  static async setResponsible(
    categoryOrderId: number,
    userId: number,
    mode: 'volunteer' | 'roulette'
  ): Promise<CategoryOrder> {
    try {
      const selectionStatus =
        mode === 'volunteer'
          ? CategorySelectionStatus.SELECTED_VOLUNTEER
          : CategorySelectionStatus.SELECTED_ROULETTE;

      const updated = await prisma.categoryOrder.updateMany({
        where: {
          id: categoryOrderId,
          selectionStatus: CategorySelectionStatus.VOLUNTEER_OPEN,
          responsibleUserId: null,
        },
        data: {
          responsibleUserId: userId,
          selectionStatus,
          selectionMode: mode,
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new ResponsibleAlreadyAssignedError();
      }
      const categoryOrder = await prisma.categoryOrder.findUniqueOrThrow({
        where: { id: categoryOrderId },
      });

      logger.info(
        `Set responsible user ${userId} for CategoryOrder ${categoryOrderId} via ${mode}`
      );

      eventBus.emit('responsible_selected', {
        categoryOrderId,
        pollId: categoryOrder.pollId,
        responsibleUserId: userId,
        method: mode,
        timestamp: new Date().toISOString(),
      });

      return categoryOrder;
    } catch (error) {
      logger.error('Error setting responsible user:', error);
      rethrowDomainError(error);
      throw new Error('Failed to set responsible user');
    }
  }

  /**
   * Кто отвечает за категорию, или `null` если категории нет либо
   * ответственный ещё не выбран.
   *
   * Вынесено из `category-order.controller.ts`, где стояло прямым обращением
   * к Prisma: правило доступа «править может только ответственный» описывалось
   * в HTTP-слое и не переиспользовалось. Различать «категории нет» и
   * «ответственного нет» вызывающему не нужно — оба означают отказ.
   */
  static async getResponsibleUserId(
    categoryOrderId: number
  ): Promise<number | null> {
    const categoryOrder = await prisma.categoryOrder.findUnique({
      where: { id: categoryOrderId },
      select: { responsibleUserId: true },
    });

    return categoryOrder?.responsibleUserId ?? null;
  }

  /**
   * Get participants (users who voted for this category)
   */
  static async getParticipants(categoryOrderId: number): Promise<number[]> {
    try {
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        select: {
          pollId: true,
          category: true,
        },
      });

      if (!categoryOrder) {
        throw new CategoryOrderNotFoundError();
      }

      // Get all votes for this poll and category
      const votes = await prisma.vote.findMany({
        where: {
          pollId: categoryOrder.pollId,
          menuItem: {
            name: categoryOrder.category,
          },
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      return votes.map(v => v.userId);
    } catch (error) {
      logger.error('Error getting participants:', error);
      rethrowDomainError(error);
      throw new Error('Failed to get participants');
    }
  }

  /**
   * Пакетно: участники (проголосовавшие) по нескольким категориям одного poll.
   * Один запрос голосов вместо findUnique+findMany на каждую категорию.
   * Категория = имя блюда (menuItem.name).
   */
  static async getParticipantsByCategoriesForPoll(
    pollId: number,
    categories: string[]
  ): Promise<Map<string, Set<number>>> {
    const result = new Map<string, Set<number>>();
    const uniqueCategories = [...new Set(categories)];
    if (uniqueCategories.length === 0) return result;

    for (const c of uniqueCategories) result.set(c, new Set<number>());

    try {
      const votes = await prisma.vote.findMany({
        where: {
          pollId,
          menuItem: { name: { in: uniqueCategories } },
        },
        select: {
          userId: true,
          menuItem: { select: { name: true } },
        },
      });

      for (const v of votes) {
        const name = v.menuItem?.name;
        if (name && result.has(name)) {
          result.get(name)!.add(v.userId);
        }
      }

      return result;
    } catch (error) {
      logger.error('Error getting participants by categories:', error);
      throw new Error('Failed to get participants');
    }
  }

  /**
   * Update calculation status
   */
  static async updateCalculationStatus(
    categoryOrderId: number,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  ): Promise<CategoryOrder> {
    try {
      const updateData: Prisma.CategoryOrderUpdateInput = {
        calculationStatus: status,
        updatedAt: new Date(),
      };

      if (status === 'IN_PROGRESS') {
        updateData.calculationStartedAt = new Date();
      } else if (status === 'COMPLETED') {
        updateData.calculationCompletedAt = new Date();
      }

      const categoryOrder = await prisma.categoryOrder.update({
        where: { id: categoryOrderId },
        data: updateData,
      });

      logger.info(
        `Updated CategoryOrder ${categoryOrderId} status to ${status}`
      );

      const eventType =
        status === 'COMPLETED' ? ('finalized' as const) : ('updated' as const);
      eventBus.emit('category_order_updated', {
        categoryOrderId,
        pollId: categoryOrder.pollId,
        type: eventType,
        timestamp: new Date().toISOString(),
      });

      return categoryOrder;
    } catch (error) {
      logger.error('Error updating calculation status:', error);
      throw new Error('Failed to update calculation status');
    }
  }

  /**
   * Update additional costs for a CategoryOrder
   */
  static async updateCosts(
    categoryOrderId: number,
    costs: UpdateCostsData
  ): Promise<CategoryOrder> {
    const deliveryCost = costs.deliveryCost ?? 0;
    const serviceFee = costs.serviceFee ?? 0;
    const tip = costs.tip ?? 0;

    /* Девять условий в одном `if` (Repowise: «complex conditional, impact
       −2.2») сведены к одной проверке на три поля. Смысл тот же, но проверка
       названа один раз, а не размножена по полям — из-за размножения при
       добавлении четвёртой суммы одно из трёх сравнений однажды забудут. */
    if (![deliveryCost, serviceFee, tip].every(isAllowedAmount)) {
      throw new OrderInputError('Costs must be non-negative numbers');
    }

    try {
      // Get current total items amount
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        select: {
          totalItemsAmount: true,
        },
      });

      const { totalAdditionalCosts, totalAmount } = computeTotals({
        itemsAmount: categoryOrder?.totalItemsAmount,
        deliveryCost,
        serviceFee,
        tip,
      });

      const result = await prisma.categoryOrder.updateMany({
        where: {
          id: categoryOrderId,
          calculationStatus: { not: 'COMPLETED' },
        },
        data: {
          deliveryCost,
          serviceFee,
          tip,
          notes: costs.notes,
          totalAdditionalCosts,
          totalAmount,
          updatedAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new CalculationCompletedError();
      }
      const updated = await prisma.categoryOrder.findUniqueOrThrow({
        where: { id: categoryOrderId },
      });

      logger.info(
        `Updated costs for CategoryOrder ${categoryOrderId}: delivery=${deliveryCost}, service=${serviceFee}, tip=${tip}`
      );

      eventBus.emit('category_order_updated', {
        categoryOrderId,
        pollId: updated.pollId,
        type: 'updated',
        timestamp: new Date().toISOString(),
      });

      return updated;
    } catch (error) {
      logger.error('Error updating costs:', error);
      rethrowDomainError(error);
      throw new Error('Failed to update costs');
    }
  }

  /**
   * Recalculate totals after OrderItems change
   */
  static async recalculateTotals(categoryOrderId: number): Promise<void> {
    try {
      // Sum all order item prices
      const result = await prisma.orderItem.aggregate({
        where: { categoryOrderId },
        _sum: {
          price: true,
        },
      });

      // Get current additional costs
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        select: {
          deliveryCost: true,
          serviceFee: true,
          tip: true,
        },
      });

      if (!categoryOrder) {
        throw new CategoryOrderNotFoundError();
      }

      const { totalItemsAmount, totalAmount } = computeTotals({
        itemsAmount: result._sum.price,
        deliveryCost: categoryOrder.deliveryCost,
        serviceFee: categoryOrder.serviceFee,
        tip: categoryOrder.tip,
      });

      await prisma.categoryOrder.update({
        where: { id: categoryOrderId },
        data: {
          totalItemsAmount,
          totalAmount,
          updatedAt: new Date(),
        },
      });

      logger.info(
        `Recalculated totals for CategoryOrder ${categoryOrderId}: items=${totalItemsAmount}, total=${totalAmount}`
      );

      const co = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        select: { pollId: true },
      });
      if (co) {
        eventBus.emit('category_order_updated', {
          categoryOrderId,
          pollId: co.pollId,
          type: 'updated',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error recalculating totals:', error);
      rethrowDomainError(error);
      throw new Error('Failed to recalculate totals');
    }
  }

  /**
   * Delete a CategoryOrder (admin only, cascade deletes OrderItems)
   */
  static async deleteCategoryOrder(categoryOrderId: number): Promise<void> {
    try {
      await prisma.categoryOrder.delete({
        where: { id: categoryOrderId },
      });

      logger.info(`Deleted CategoryOrder ${categoryOrderId}`);
    } catch (error) {
      logger.error('Error deleting category order:', error);
      throw new Error('Failed to delete category order');
    }
  }
}
