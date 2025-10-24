import { Poll, PollResult } from '@prisma/client';
import { CreatePollData, PollWithDetails, PollStats } from '../types/poll.types';
export declare function initializePollServiceBot(bot: any): void;
export declare class PollService {
    static createPoll(data: CreatePollData): Promise<Poll>;
    static getPollById(id: number): Promise<PollWithDetails | null>;
    static getActivePollInGroup(groupId: number): Promise<Poll | null>;
    static getActivePolls(): Promise<any[]>;
    static completePoll(pollId: number): Promise<PollResult>;
    static cancelPoll(pollId: number, cancelledBy: number, reason?: string): Promise<Poll>;
    static updatePoll(pollId: number, data: Partial<Poll>): Promise<Poll>;
    static getPollResult(resultId: number): Promise<PollResult>;
    static getPollResultByPollId(pollId: number): Promise<PollResult | null>;
    static runRoulette(pollId: number): Promise<PollResult>;
    static getPollHistory(groupId?: number, limit?: number, offset?: number): Promise<{
        polls: any[];
        total: number;
    }>;
    static getLastCompletedPoll(groupId?: number): Promise<Poll | null>;
    static getPollStats(groupId?: number): Promise<PollStats>;
    static getUserParticipationStats(userId: number): Promise<{
        totalVotes: number;
        totalPolls: number;
        participationRate: number;
        favoriteItems: Array<{
            itemId: number;
            itemName: string;
            voteCount: number;
            percentage: number;
        }>;
        recentActivity: Array<{
            pollId: number;
            pollTitle: string;
            votedAt: string;
            itemName: string;
        }>;
    }>;
    static getExpiredPolls(): Promise<Poll[]>;
    static getPollVoteBreakdown(pollId: number): Promise<{
        menuItemId: number;
        menuItemName: string;
        votes: number;
        percentage: number;
        voters: {
            id: number;
            firstName: string;
            username?: string;
        }[];
    }[]>;
    static savePollResult(data: {
        pollId: number;
        winnerMenuItemId?: number;
        responsibleUserId: number;
        totalVotes: number;
        rouletteData?: string;
    }): Promise<any>;
    static completePollMultiWinner(pollId: number, completedBy: number, options?: {
        minVotes?: number;
        maxWinners?: number | null;
        tieBreakMethod?: 'earliest' | 'alphabetical';
    }): Promise<PollResult>;
    private static getExpectedParticipants;
    static checkAutoComplete(pollId: number): Promise<boolean>;
}
//# sourceMappingURL=poll.service.d.ts.map