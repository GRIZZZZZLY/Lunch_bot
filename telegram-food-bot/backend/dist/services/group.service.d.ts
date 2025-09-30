import { Group } from '@prisma/client';
import { CreateGroupData, UpdateGroupData } from '../types/group.types';
export declare class GroupService {
    static upsertGroup(data: CreateGroupData): Promise<Group>;
    static getGroupByTelegramId(telegramId: string): Promise<Group | null>;
    static getGroupById(id: number): Promise<Group | null>;
    static updateGroup(id: number, data: UpdateGroupData): Promise<Group>;
    static getActiveGroupPoll(groupId: number): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        createdBy: number;
        groupId: number;
        status: string;
        duration: number;
        startedAt: Date;
        endedAt: Date | null;
    } | null>;
    static getAllGroups(limit?: number, offset?: number): Promise<{
        groups: Group[];
        total: number;
    }>;
    static getGroupStats(groupId: number): Promise<{
        totalPolls: number;
        activePolls: number;
        totalVotes: number;
        averageVotesPerPoll: number;
    }>;
    static deactivateGroup(groupId: number): Promise<Group>;
}
//# sourceMappingURL=group.service.d.ts.map