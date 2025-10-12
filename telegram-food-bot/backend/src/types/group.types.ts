import { User } from '@prisma/client';

export interface CreateGroupData {
  telegramId: string;
  title: string;
  type: string; // 'group', 'supergroup', 'channel'
}

export interface UpdateGroupData {
  title?: string;
  type?: string;
  isActive?: boolean;
}

export interface GroupWithMembers {
  id: number;
  telegramId: string;
  title: string;
  type: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: GroupMemberWithUser[];
  _count?: {
    members: number;
    polls: number;
  };
}

export interface GroupMemberWithUser {
  id: number;
  userId: number;
  groupId: number;
  role: string;
  joinedAt: Date;
  user: User;
}

/**
 * Настройки группы (хранятся в Group.settings JSON)
 */
export interface GroupSettings {
  expectedParticipants?: number;   // Ожидаемое кол-во участников
  autoCompleteEnabled?: boolean;   // Автозавершение при 100% явке
  notificationsEnabled?: boolean;  // Уведомления включены
  reminderBeforeEnd?: number;      // Напоминание за N минут
  progressNotifications?: boolean; // Уведомления о прогрессе (50%, 75%)
}
