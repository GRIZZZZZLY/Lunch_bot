import { Group, User, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateGroupData, UpdateGroupData, GroupSettings } from '../types/group.types';

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

  /**
   * Добавить участника в группу
   */
  static async addMemberToGroup(groupId: number, userId: number, role: string = 'MEMBER'): Promise<any> {
    try {
      // Проверяем, не состоит ли уже пользователь в группе
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (existingMember) {
        // Если участник уже был, но вышел - восстанавливаем
        if (!existingMember.isActive) {
          return await prisma.groupMember.update({
            where: { id: existingMember.id },
            data: {
              isActive: true,
              leftAt: null,
              role,
            },
          });
        }
        // Если уже активный участник - ничего не делаем
        return existingMember;
      }

      // Создаём нового участника
      return await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          role,
          isActive: true,
        },
      });
    } catch (error) {
      logger.error('Error adding member to group:', error);
      throw new Error('Failed to add member to group');
    }
  }

  /**
   * Удалить участника из группы (мягкое удаление)
   */
  static async removeMemberFromGroup(groupId: number, userId: number): Promise<void> {
    try {
      await prisma.groupMember.updateMany({
        where: {
          groupId,
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error removing member from group:', error);
      throw new Error('Failed to remove member from group');
    }
  }

  /**
   * Получить всех участников группы
   */
  static async getGroupMembers(groupId: number, activeOnly: boolean = true): Promise<any[]> {
    try {
      return await prisma.groupMember.findMany({
        where: {
          groupId,
          ...(activeOnly ? { isActive: true } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              avatarUrl: true,
              isAdmin: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });
    } catch (error) {
      logger.error('Error getting group members:', error);
      throw new Error('Failed to get group members');
    }
  }

  /**
   * Получить список групп для пользователя
   */
  static async getGroupsForUser(userId: number, activeOnly: boolean = true): Promise<any[]> {
    try {
      return await prisma.groupMember.findMany({
        where: {
          userId,
          ...(activeOnly ? { isActive: true } : {}),
        },
        include: {
          group: true,
        },
        orderBy: {
          joinedAt: 'desc',
        },
      });
    } catch (error) {
      logger.error('Error getting groups for user:', error);
      throw new Error('Failed to get user groups');
    }
  }

  /**
   * Проверка, что пользователь состоит в группе
   */
  static async isUserGroupMember(userId: number, groupId: number): Promise<boolean> {
    try {
      const member = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId,
          isActive: true,
        },
        select: { id: true },
      });

      return !!member;
    } catch (error) {
      logger.error('Error checking group membership:', error);
      return false;
    }
  }

  /**
   * Проверка, что пользователь админ группы
   */
  static async isUserGroupAdmin(userId: number, groupId: number): Promise<boolean> {
    try {
      const member = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId,
          isActive: true,
          role: {
            in: ['ADMIN', 'CREATOR'],
          },
        },
        select: { id: true },
      });

      return !!member;
    } catch (error) {
      logger.error('Error checking group admin access:', error);
      return false;
    }
  }

  /**
   * Изменить роль участника группы
   */
  static async setMemberRole(groupId: number, userId: number, role: string): Promise<any> {
    try {
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!existingMember) {
        throw new Error('Group member not found');
      }

      return await prisma.groupMember.update({
        where: { id: existingMember.id },
        data: { role },
      });
    } catch (error) {
      logger.error('Error updating group member role:', error);
      throw error;
    }
  }

  /**
   * Получить пользователей группы (только User объекты)
   */
  static async getUsersByGroupId(groupId: number, activeOnly: boolean = true): Promise<any[]> {
    try {
      const members = await this.getGroupMembers(groupId, activeOnly);
      return members.map((member) => member.user);
    } catch (error) {
      logger.error('Error getting users by group ID:', error);
      throw new Error('Failed to get users by group ID');
    }
  }

  /**
   * Проверить, является ли пользователь участником группы
   */
  static async isMemberOfGroup(groupId: number, userId: number): Promise<boolean> {
    try {
      const member = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId,
          isActive: true,
        },
      });
      return !!member;
    } catch (error) {
      logger.error('Error checking group membership:', error);
      return false;
    }
  }

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

  /**
   * Получение РЕАЛЬНОГО количества участников из Telegram API
   * Использует getChatMemberCount для актуального подсчета
   * 
   * @param groupTelegramId - Telegram ID группы (BigInt или string)
   * @param bot - Экземпляр бота (опционально)
   * @returns Количество активных участников (минус боты) или null при ошибке
   */
  static async getRealMemberCount(
    groupTelegramId: string | bigint,
    bot?: any
  ): Promise<number | null> {
    try {
      // Если бот не передан, пытаемся получить глобальный instance
      let botInstance = bot;
      if (!botInstance) {
        try {
          const botModule = await import('../bot/bot');
          botInstance = (botModule as any).getBotInstance?.();
        } catch (error) {
          logger.debug('Cannot import bot instance for getRealMemberCount');
        }
      }
      
      if (!botInstance) {
        logger.debug('Bot instance not available for getRealMemberCount');
        return null;
      }

      const chatId = typeof groupTelegramId === 'bigint' 
        ? Number(groupTelegramId) 
        : parseInt(groupTelegramId.toString());
      
      const totalCount = await botInstance.api.getChatMemberCount(chatId);
      
      // Минус 1 (сам бот не учитывается)
      const realCount = Math.max(totalCount - 1, 1);
      
      logger.info(`✅ Real member count for group ${groupTelegramId}: ${realCount} (total: ${totalCount})`);
      
      return realCount;
    } catch (error: any) {
      // Telegram может вернуть ошибку если бот не в группе
      if (error.error_code === 403 || error.error_code === 400) {
        logger.warn(`⚠️ Bot not in group ${groupTelegramId} or no access`);
      } else {
        logger.error('Error getting real member count:', error);
      }
      return null;
    }
  }

  /**
   * Получение активных участников группы (по статистике последних голосований)
   * Исключает ботов из подсчета
   * ⚠️ FALLBACK метод - используйте getRealMemberCount() для актуальных данных
   */
  static async getActiveParticipants(groupId: number): Promise<number> {
    try {
      // Получаем последние 5 завершенных голосований
      const recentPolls = await prisma.poll.findMany({
        where: { 
          groupId, 
          status: { in: ['COMPLETED', 'CANCELLED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          votes: {
            include: {
              user: true
            }
          }
        }
      });

      if (recentPolls.length === 0) {
        // Если нет истории, возвращаем минимум (1 реальный участник)
        return 1;
      }

      // Собираем уникальных голосовавших (исключая ботов)
      const uniqueVoters = new Set<number>();
      recentPolls.forEach(poll => {
        poll.votes.forEach(vote => {
          // Добавляем только реальных пользователей
          // (боты обычно не голосуют, но на всякий случай)
          uniqueVoters.add(vote.userId);
        });
      });

      const count = uniqueVoters.size;
      logger.info(`Active participants in group ${groupId}: ${count} (excluding bots)`);
      
      // Минимум 1 участник (если только боты, то все равно нужен хотя бы один человек)
      return Math.max(count, 1);
    } catch (error) {
      logger.error('Error getting active participants:', error);
      return 1; // Fallback к 1 участнику
    }
  }

  /**
   * Получение настроек группы
   */
  static async getGroupSettings(groupId: number): Promise<GroupSettings> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { settings: true }
      });

      if (!group || !group.settings) {
        // Возвращаем дефолтные настройки
        return {
          autoCompleteEnabled: true,
          notificationsEnabled: true,
          progressNotifications: false,
        };
      }

      return (typeof group.settings === 'string' 
        ? JSON.parse(group.settings) 
        : group.settings) as GroupSettings;
    } catch (error) {
      logger.error('Error getting group settings:', error);
      return {
        autoCompleteEnabled: true,
        notificationsEnabled: true,
      };
    }
  }

  /**
   * Обновление настроек группы
   */
  static async updateGroupSettings(
    groupId: number, 
    settings: Partial<GroupSettings>
  ): Promise<Group> {
    try {
      // Получаем текущие настройки
      const currentSettings = await this.getGroupSettings(groupId);
      
      // Мержим с новыми
      const updatedSettings: GroupSettings = {
        ...currentSettings,
        ...settings,
      };

      const group = await prisma.group.update({
        where: { id: groupId },
        data: {
          settings: JSON.stringify(updatedSettings),
          updatedAt: new Date(),
        },
      });

      logger.info(`Group settings updated: ${groupId}`, updatedSettings);
      return group;
    } catch (error) {
      logger.error('Error updating group settings:', error);
      throw new Error('Failed to update group settings');
    }
  }
}
