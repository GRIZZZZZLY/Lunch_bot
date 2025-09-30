import { User, MenuItem, Poll } from '@prisma/client';

/**
 * Типы уведомлений
 */
export enum NotificationType {
  POLL_STARTED = 'poll_started',
  POLL_ENDING_SOON = 'poll_ending_soon',
  POLL_ENDED = 'poll_ended',
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
 */
export interface PollEndedNotificationData {
  poll: Poll;
  winnerItem?: MenuItem;
  totalVotes: number;
  topItems: Array<{
    item: MenuItem;
    votes: number;
    percentage: number;
  }>;
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
