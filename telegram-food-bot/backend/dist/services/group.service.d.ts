import { Group } from '@prisma/client';
import { CreateGroupData, UpdateGroupData, GroupSettings } from '../types/group.types';
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
        messageId: number | null;
        chatId: bigint | null;
        selectedMenuItemIds: string | null;
    } | null>;
    static addMemberToGroup(groupId: number, userId: number, role?: string): Promise<any>;
    static removeMemberFromGroup(groupId: number, userId: number): Promise<void>;
    static getGroupMembers(groupId: number, activeOnly?: boolean): Promise<any[]>;
    static getUsersByGroupId(groupId: number, activeOnly?: boolean): Promise<any[]>;
    static isMemberOfGroup(groupId: number, userId: number): Promise<boolean>;
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
    static getRealMemberCount(groupTelegramId: string | bigint, bot?: any): Promise<number | null>;
    static getActiveParticipants(groupId: number): Promise<number>;
    static getGroupSettings(groupId: number): Promise<GroupSettings>;
    static updateGroupSettings(groupId: number, settings: Partial<GroupSettings>): Promise<Group>;
}
//# sourceMappingURL=group.service.d.ts.map