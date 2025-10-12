import { NotificationType, NotificationPriority, NotificationData, NotificationResult, RouletteWinnerNotificationData, PollEndedNotificationData, PollStartedNotificationData } from '../types/notification.types';
import { User } from '@prisma/client';
export declare class NotificationService {
    private bot;
    private templates;
    constructor();
    initialize(bot: any): void;
    private initializeTemplates;
    send(data: NotificationData): Promise<NotificationResult>;
    sendRouletteWinnerNotification(data: RouletteWinnerNotificationData): Promise<NotificationResult>;
    notifyResponsible(pollId: number, responsibleUserId: number): Promise<NotificationResult>;
    sendPollEndedNotification(userIds: number[], data: PollEndedNotificationData): Promise<NotificationResult[]>;
    sendPollCompletionNotifications(pollId: number): Promise<NotificationResult[]>;
    sendPollStartedNotification(userIds: number[], data: PollStartedNotificationData): Promise<NotificationResult[]>;
    sendCustomNotification(userId: number, message: string, options?: {
        title?: string;
        priority?: NotificationPriority;
        parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
        replyMarkup?: any;
    }): Promise<NotificationResult>;
    sendBulkNotification(userIds: number[], message: string, options?: {
        type?: NotificationType;
        priority?: NotificationPriority;
        parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    }): Promise<NotificationResult[]>;
    private isUserMuted;
    private formatDate;
    sendPollCancelledNotifications(pollId: number, cancelledBy: User, reason?: string): Promise<void>;
    getStats(): Promise<any>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map