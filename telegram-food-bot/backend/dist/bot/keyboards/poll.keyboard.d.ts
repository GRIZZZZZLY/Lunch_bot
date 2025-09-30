import { MenuItem } from '@prisma/client';
import { VoteWithDetails } from '../../types/poll.types';
export declare function createPollKeyboard(pollId: number, menuItems: MenuItem[], votes: Map<number, VoteWithDetails[]>): {
    inline_keyboard: any[][];
};
export declare function createCompletedPollKeyboard(pollId: number, hasVotes?: boolean, isRouletteRun?: boolean): {
    inline_keyboard: any[][];
};
export declare function createPollAdminKeyboard(pollId: number, isActive?: boolean): {
    inline_keyboard: any[][];
};
export declare function createCategorizedPollKeyboard(pollId: number, menuItemsByCategory: {
    [category: string]: MenuItem[];
}, votes: Map<number, VoteWithDetails[]>, selectedCategory?: string): {
    inline_keyboard: any[][];
};
export declare function createResultsKeyboard(pollId: number, hasVotes: boolean, isActive: boolean, isRouletteRun?: boolean): {
    inline_keyboard: any[][];
};
export declare function createPollMessage(pollData: {
    poll: any;
    menuItems: MenuItem[];
    votes: Map<number, VoteWithDetails[]>;
    totalVotes: number;
}): string;
export declare function createResultsMessage(pollData: {
    poll: any;
    result?: any;
    breakdown: any[];
    totalVotes: number;
}): string;
//# sourceMappingURL=poll.keyboard.d.ts.map