import { Vote } from '@prisma/client';
import { CreateVoteData, VoteWithDetails } from '../types/poll.types';
export declare class VoteService {
    static upsertVote(data: CreateVoteData): Promise<Vote>;
    static getUserVoteInPoll(pollId: number, userId: number): Promise<Vote | null>;
    static removeVote(pollId: number, userId: number): Promise<void>;
    static getPollVotes(pollId: number): Promise<VoteWithDetails[]>;
    static getVoteCountByMenuItem(pollId: number): Promise<{
        menuItemId: number;
        menuItemName: string;
        votes: number;
    }[]>;
    static getPollVoters(pollId: number): Promise<{
        id: number;
        telegramId: bigint;
        firstName: string;
        lastName?: string;
        username?: string;
        votedFor: string;
        votedAt: Date;
    }[]>;
    static hasUserVoted(pollId: number, userId: number): Promise<boolean>;
    static getUserVoteStats(userId: number): Promise<{
        totalVotes: number;
        pollsParticipated: number;
        favoriteMenuItems: {
            name: string;
            votes: number;
        }[];
        lastVoteDate?: Date;
    }>;
    static getUserVotes(userId: number, limit?: number, offset?: number): Promise<{
        votes: VoteWithDetails[];
        total: number;
    }>;
    static removeExpiredVotes(pollIds: number[]): Promise<number>;
    static getTopMenuItemsByVotes(days?: number, limit?: number, groupId?: number): Promise<{
        menuItemId: number;
        menuItemName: string;
        totalVotes: number;
        uniqueVoters: number;
    }[]>;
}
//# sourceMappingURL=vote.service.d.ts.map