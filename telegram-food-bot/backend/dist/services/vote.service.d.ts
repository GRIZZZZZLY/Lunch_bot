import { Vote } from '@prisma/client';
import { CreateVoteData, VoteWithDetails } from '../types/poll.types';
import { CreateVoteWithTypeData, VoteTypeStats } from '../types/vote.types';
export declare class VoteService {
    static createVote(data: CreateVoteData): Promise<Vote>;
    static createVoteWithType(data: CreateVoteWithTypeData): Promise<Vote>;
    static updateVote(voteId: number, menuItemId: number): Promise<Vote>;
    static getVoteBreakdown(pollId: number): Promise<Array<{
        menuItemId: number;
        menuItemName: string;
        votes: number;
        percentage: number;
        voters: Array<{
            id: number;
            firstName: string;
            username?: string;
        }>;
    }>>;
    static upsertVote(data: CreateVoteData): Promise<Vote>;
    static upsertVoteWithType(data: CreateVoteWithTypeData): Promise<Vote>;
    static getVoteTypeStats(pollId: number): Promise<VoteTypeStats>;
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
    static getVoters(pollId: number): Promise<Array<{
        userId: number;
        userName: string;
        menuItemName: string;
    }>>;
    static getMostPopularMenuItem(pollId: number): Promise<{
        menuItemId: number;
        menuItemName: string;
        votes: number;
    } | null>;
}
//# sourceMappingURL=vote.service.d.ts.map