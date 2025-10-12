import { User, MenuItem, Poll } from '@prisma/client';

/**
 * Типы уведомлений
 */
export enum NotificationType {
  POLL_STARTED = 'poll_started',
  POLL_ENDING_SOON = 'poll_ending_soon',
  POLL_ENDED = 'poll_ended',
  POLL_CANCELLED = 'poll_cancelled',
  ROULETTE_WINNER = 'roulette_winner',
  ORDER_REMINDER = 'order_reminder',
  CUSTOM = 'custom',
}

/**
 * Приоритет уведомления
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Базовые данные для отправки уведомления
 */
export interface NotificationData {
  userId: number;
  type: NotificationType;
  priority?: NotificationPriority;
  title?: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: any;
  disableNotification?: boolean;
}

/**
 * Данные для уведомления о победителе рулетки
 */
export interface RouletteWinnerNotificationData {
  winner: User;
  poll: Poll;
  winnerItem?: MenuItem;
  totalVotes: number;
  voters: User[];
  orderDetails?: {
    restaurant?: string;
    deliveryTime?: Date;
    budget?: number;
  };
}

/**
 * Данные для уведомления о завершении голосования
 * Поддерживает оба формата: Single Winner и Multi-Winner
 */
export interface PollEndedNotificationData {
  pollId: number;
  mode: 'single-winner' | 'multi-winner';
  totalVotes: number;
  groupTitle: string;
  
  // Single Winner данные
  winnerItem?: {
    id: number;
    name: string;
    description?: string;
    price?: number;
  };
  topItems?: Array<{
    item: {
      id: number;
      name: string;
      description?: string;
      price?: number;
    };
    votes: number;
    percentage: number;
  }>;
  
  // Multi-Winner данные
  winners?: Array<{
    menuItemId: number;
    menuItemName: string;
    voteCount: number;
    voters: Array<{
      userId: number;
      firstName: string;
      lastName?: string;
      username?: string;
    }>;
  }>;
  bringOwn?: {
    count: number;
    voters: Array<{
      userId: number;
      firstName: string;
      lastName?: string;
      username?: string;
    }>;
  };
  skipped?: {
    count: number;
    voters: Array<{
      userId: number;
      firstName: string;
      lastName?: string;
      username?: string;
    }>;
  };
  tieBreak?: {
    method: string;
    appliedTo: number[];
    reason: string;
  };
}

/**
 * Данные для уведомления о начале голосования
 */
export interface PollStartedNotificationData {
  poll: Poll;
  menuItems: MenuItem[];
  endTime?: Date;
  groupTitle: string;
}

/**
 * Данные для уведомления об отмене голосования
 */
export interface PollCancelledNotificationData {
  poll: Poll;
  cancelledBy: User;
  reason?: string;
  totalVotes: number;
  voters: User[];
}

/**
 * Результат отправки уведомления
 */
export interface NotificationResult {
  success: boolean;
  messageId?: number;
  error?: string;
  sentAt: Date;
}

/**
 * Настройки уведомлений пользователя
 */
export interface UserNotificationSettings {
  userId: number;
  enabled: boolean;
  pollStarted: boolean;
  pollEnding: boolean;
  pollEnded: boolean;
  rouletteWinner: boolean;
  orderReminders: boolean;
  muteUntil?: Date;
}

/**
 * Шаблон уведомления
 */
export interface NotificationTemplate {
  type: NotificationType;
  getTitle: (data: any) => string;
  getMessage: (data: any) => string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  priority: NotificationPriority;
}

/**
 * Очередь уведомлений
 */
export interface NotificationQueueItem {
  id: string;
  notification: NotificationData;
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
}

/**
 * Статистика уведомлений
 */
export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<NotificationType, number>;
  averageDeliveryTime: number;
  successRate: number;
}
