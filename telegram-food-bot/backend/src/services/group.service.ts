import { Group, User, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateGroupData, UpdateGroupData } from '../types/group.types';

export class GroupService {
  /**
   * Создание или обновление группы
   */
  static async upsertGroup(data: CreateGroupData): Promise<Group> {
    try {
      const group = await prisma.group.upsert({
        where: { telegramId: BigInt(data.telegramId) },
        update: {
          title: data.title,
          type: data.type,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          telegramId: BigInt(data.telegramId),
          title: data.title,
          type: data.type,
          isActive: true,
        },
      });

      logger.info(`Group upserted: ${group.telegramId} (${group.title})`);
      return group;
    } catch (error) {
      logger.error('Error upserting group:', error);
      throw new Error('Failed to create or update group');
    }
  }

  /**
   * Получение группы по Telegram ID
   */
  static async getGroupByTelegramId(telegramId: string): Promise<Group | null> {
    try {
      return await prisma.group.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });
    } catch (error) {
      logger.error('Error getting group by telegram ID:', error);
      throw new Error('Failed to get group');
    }
  }

  /**
   * Получение группы по ID
   */
  static async getGroupById(id: number): Promise<Group | null> {
    try {
      return await prisma.group.findUnique({
        where: { id },
        include: {
          polls: {
            where: { status: 'ACTIVE' },
          },
        },
      });
    } catch (error) {
      logger.error('Error getting group by ID:', error);
      throw new Error('Failed to get group');
    }
  }

  /**
   * Обновление группы
   */
  static async updateGroup(id: number, data: UpdateGroupData): Promise<Group> {
    try {
      const group = await prisma.group.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      logger.info(`Group updated: ${group.telegramId} (${group.title})`);
      return group;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Group not found');
        }
      }
      logger.error('Error updating group:', error);
      throw new Error('Failed to update group');
    }
  }

  /**
   * Получение активного голосования в группе
   */
  static async getActiveGroupPoll(groupId: number) {
    try {
      return await prisma.poll.findFirst({
        where: {
          groupId,
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      logger.error('Error getting active group poll:', error);
      throw new Error('Failed to get active poll');
    }
  }

  // GroupMember functions are temporarily disabled as the model doesn't exist in schema
  // TODO: Add GroupMember model to Prisma schema if needed

  /**
   * Получение всех групп
   */
  static async getAllGroups(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ groups: Group[]; total: number }> {
    try {
      const [groups, total] = await Promise.all([
        prisma.group.findMany({
          where: { isActive: true },
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.group.count({ where: { isActive: true } }),
      ]);

      return { groups, total };
    } catch (error) {
      logger.error('Error getting all groups:', error);
      throw new Error('Failed to get groups');
    }
  }

  /**
   * Получение статистики группы
   */
  static async getGroupStats(groupId: number) {
    try {
      const [totalPolls, activePolls, totalVotes] = await Promise.all([
        prisma.poll.count({ where: { groupId } }),
        prisma.poll.count({ where: { groupId, status: 'ACTIVE' } }),
        prisma.vote.count({
          where: {
            poll: { groupId },
          },
        }),
      ]);

      return {
        totalPolls,
        activePolls,
        totalVotes,
        averageVotesPerPoll: totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0,
      };
    } catch (error) {
      logger.error('Error getting group stats:', error);
      throw new Error('Failed to get group statistics');
    }
  }

  /**
   * Деактивация группы
   */
  static async deactivateGroup(groupId: number): Promise<Group> {
    try {
      const group = await prisma.group.update({
        where: { id: groupId },
        data: { 
          isActive: false,
          updatedAt: new Date(),
        },
      });

      logger.info(`Group deactivated: ${group.telegramId}`);
      return group;
    } catch (error) {
      logger.error('Error deactivating group:', error);
      throw new Error('Failed to deactivate group');
    }
  }
}
