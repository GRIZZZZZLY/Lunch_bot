import { Poll, PollResult } from '@prisma/client';
import { CreatePollData, PollWithDetails, PollStats } from '../types/poll.types';
export declare class PollService {
    static createPoll(data: CreatePollData): Promise<Poll>;
    static getPollById(id: number): Promise<PollWithDetails | null>;
    static getActivePollInGroup(groupId: number): Promise<Poll | null>;
    static getActivePolls(): Promise<Poll[]>;
    static completePoll(pollId: number): Promise<PollResult>;
    static cancelPoll(pollId: number): Promise<Poll>;
    static getPollResult(resultId: number): Promise<PollResult>;
    static getPollResultByPollId(pollId: number): Promise<PollResult | null>;
    static runRoulette(pollId: number): Promise<PollResult>;
    static getPollHistory(groupId?: number, limit?: number, offset?: number): Promise<{
        polls: Poll[];
        total: number;
    }>;
    static getPollStats(groupId?: number): Promise<PollStats>;
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
}
//# sourceMappingURL=poll.service.d.ts.map