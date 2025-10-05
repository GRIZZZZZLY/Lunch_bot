import { MenuItem } from '@prisma/client';
export declare function initializePollServiceBot(bot: any): void;
export declare function createPollFromWebApp(params: {
    groupId: number;
    duration: number;
    createdBy: number;
    title?: string;
    menuItems: MenuItem[];
}): Promise<{
    pollId: number;
    messageId: number;
}>;
//# sourceMappingURL=poll.service.extensions.d.ts.map