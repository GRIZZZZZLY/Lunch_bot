import { User, MenuItem, Poll } from '@prisma/client';
export declare enum NotificationType {
    POLL_STARTED = "poll_started",
    POLL_ENDING_SOON = "poll_ending_soon",
    POLL_ENDED = "poll_ended",
    ROULETTE_WINNER = "roulette_winner",
    ORDER_REMINDER = "order_reminder",
    CUSTOM = "custom"
}
export declare enum NotificationPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent"
}
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
export interface PollStartedNotificationData {
    poll: Poll;
    menuItems: MenuItem[];
    endTime?: Date;
    groupTitle: string;
}
export interface NotificationResult {
    success: boolean;
    messageId?: number;
    error?: string;
    sentAt: Date;
}
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
export interface NotificationTemplate {
    type: NotificationType;
    getTitle: (data: any) => string;
    getMessage: (data: any) => string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    priority: NotificationPriority;
}
export interface NotificationQueueItem {
    id: string;
    notification: NotificationData;
    scheduledAt: Date;
    attempts: number;
    maxAttempts: number;
    lastError?: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
}
export interface NotificationStats {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byType: Record<NotificationType, number>;
    averageDeliveryTime: number;
    successRate: number;
}
//# sourceMappingURL=notification.types.d.ts.map