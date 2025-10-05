export declare class PollReminderService {
    private static reminders;
    private static botInstance;
    static initialize(bot: any): void;
    static scheduleReminders(pollId: number, durationMinutes: number, chatId: bigint): void;
    private static sendReminderNotification;
    private static sendFinalCallNotification;
    private static sendPersonalReminders;
    static cancelReminders(pollId: number): void;
    static cancelAllReminders(): void;
    static getActiveReminders(): number[];
}
//# sourceMappingURL=poll-reminder.service.d.ts.map