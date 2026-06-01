import {
  CategoryOrder,
  OrderItem,
  Prisma,
} from '@prisma/client';

// SQLite: enum replaced with string constants
const CategorySelectionStatus = {
  SELECTED_AUTO: 'SELECTED_AUTO',
  SELECTED_VOLUNTEER: 'SELECTED_VOLUNTEER',
  SELECTED_ROULETTE: 'SELECTED_ROULETTE',
  VOLUNTEER_OPEN: 'VOLUNTEER_OPEN',
} as const;
type CategorySelectionStatus = typeof CategorySelectionStatus[keyof typeof CategorySelectionStatus];
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { toNumber } from '../utils/decimal';
import { eventBus } from './event-bus.service';

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

      // Filter categories with at least 1 participant
      const categoryOrders: CategoryOrder[] = [];
      
      for (const [category, userIds] of categoryMap.entries()) {
        if (userIds.size === 0) {
          continue;
        }

        const participantCount = userIds.size;
        
        // For single participant, auto-assign as responsible
        if (participantCount === 1) {
          const userId = Array.from(userIds)[0];
          const categoryOrder = await prisma.categoryOrder.create({
            data: {
              pollId,
              category,
              responsibleUserId: userId,
              selectionStatus: CategorySelectionStatus.SELECTED_AUTO,
              selectionMode: 'auto',
              participantCount,
              calculationStatus: 'PENDING',
            },
          });
          
          categoryOrders.push(categoryOrder);
          logger.info(
            `Created CategoryOrder ${categoryOrder.id} for category "${category}" with auto-responsible user ${userId}`
          );
        } else {
          // Multi-participant: no responsible until volunteer/roulette actually selects one
          const categoryOrder = await prisma.categoryOrder.create({
            data: {
              pollId,
              category,
              responsibleUserId: null,
              selectionStatus: CategorySelectionStatus.VOLUNTEER_OPEN,
              selectionMode: null,
              participantCount,
              calculationStatus: 'PENDING',
            },
          });
          
          categoryOrders.push(categoryOrder);
          logger.info(
            `Created CategoryOrder ${categoryOrder.id} for category "${category}" with ${participantCount} participants (responsible pending)`
          );
        }
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

      const categoryOrder = await prisma.categoryOrder.update({
        where: { id: categoryOrderId },
        data: {
          responsibleUserId: userId,
          selectionStatus,
          selectionMode: mode,
          updatedAt: new Date(),
        },
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
      throw new Error('Failed to set responsible user');
    }
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
        throw new Error('CategoryOrder not found');
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

      return votes.map((v) => v.userId);
    } catch (error) {
      logger.error('Error getting participants:', error);
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

      const eventType = status === 'COMPLETED' ? 'finalized' as const : 'updated' as const;
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
    try {
      const deliveryCost = costs.deliveryCost ?? 0;
      const serviceFee = costs.serviceFee ?? 0;
      const tip = costs.tip ?? 0;
      const totalAdditionalCosts = deliveryCost + serviceFee + tip;

      // Get current total items amount
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        select: {
          totalItemsAmount: true,
        },
      });

      const totalItemsAmount = toNumber(categoryOrder?.totalItemsAmount);
      const totalAmount = totalItemsAmount + totalAdditionalCosts;

      const updated = await prisma.categoryOrder.update({
        where: { id: categoryOrderId },
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

      const totalItemsAmount = toNumber(result._sum.price);

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
        throw new Error('CategoryOrder not found');
      }

      const totalAdditionalCosts =
        toNumber(categoryOrder.deliveryCost) +
        toNumber(categoryOrder.serviceFee) +
        toNumber(categoryOrder.tip);

      const totalAmount = totalItemsAmount + totalAdditionalCosts;

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
