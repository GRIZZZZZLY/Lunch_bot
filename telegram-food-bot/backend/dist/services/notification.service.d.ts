import { NotificationType, NotificationPriority, NotificationData, NotificationResult, RouletteWinnerNotificationData, PollEndedNotificationData, PollStartedNotificationData } from '../types/notification.types';
export declare class NotificationService {
    private bot;
    private templates;
    constructor();
    initialize(bot: any): void;
    private initializeTemplates;
    send(data: NotificationData): Promise<NotificationResult>;
    sendRouletteWinnerNotification(data: RouletteWinnerNotificationData): Promise<NotificationResult>;
    sendPollEndedNotification(userIds: number[], data: PollEndedNotificationData): Promise<NotificationResult[]>;
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
    getStats(): Promise<any>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.service.d.ts.map