import { User } from '@prisma/client';
export interface CreateGroupData {
    telegramId: string;
    title: string;
    type: string;
}
export interface UpdateGroupData {
    title?: string;
    type?: string;
    isActive?: boolean;
}
export interface GroupWithMembers {
    id: number;
    telegramId: string;
    title: string;
    type: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    members: GroupMemberWithUser[];
    _count?: {
        members: number;
        polls: number;
    };
}
export interface GroupMemberWithUser {
    id: number;
    userId: number;
    groupId: number;
    role: string;
    joinedAt: Date;
    user: User;
}
//# sourceMappingURL=group.types.d.ts.map