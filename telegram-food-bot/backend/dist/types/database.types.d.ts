import { User, Group, MenuItem, Poll, Vote, PollResult } from '@prisma/client';
export type { User, Group, MenuItem, Poll, Vote, PollResult };
export type PollStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type UserWithRelations = User & {
    createdMenuItems?: MenuItem[];
    votes?: Vote[];
    createdPolls?: Poll[];
    responsiblePolls?: PollResult[];
};
export type GroupWithPolls = Group & {
    polls?: Poll[];
};
export type MenuItemWithCreator = MenuItem & {
    creator: User;
    votes?: Vote[];
};
export type PollWithRelations = Poll & {
    group?: Group;
    creator?: User;
    votes?: VoteWithRelations[];
    result?: PollResultWithRelations | null;
};
export type VoteWithRelations = Vote & {
    poll?: Poll;
    user: User;
    menuItem: MenuItem;
};
export type PollResultWithRelations = PollResult & {
    poll?: Poll;
    responsibleUser: User;
    winnerMenuItem?: MenuItem;
};
export interface CreateUserData {
    telegramId: number;
    username?: string;
    firstName: string;
    lastName?: string;
    isAdmin?: boolean;
}
export interface UpdateUserData {
    username?: string;
    firstName?: string;
    lastName?: string;
    isAdmin?: boolean;
    isActive?: boolean;
}
export interface CreateGroupData {
    telegramId: number;
    title: string;
    type?: string;
}
export interface UpdateGroupData {
    title?: string;
    type?: string;
    isActive?: boolean;
    settings?: any;
}
export interface CreateMenuItemData {
    name: string;
    description?: string;
    price?: number;
    category?: string;
    imageUrl?: string;
    createdBy: number;
}
export interface UpdateMenuItemData {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    imageUrl?: string;
    isActive?: boolean;
}
export interface CreatePollData {
    groupId: number;
    duration: number;
    createdBy: number;
}
export interface UpdatePollData {
    status?: PollStatus;
    endedAt?: Date;
}
export interface UpdatePollData {
    status?: PollStatus;
    endedAt?: Date;
}
export interface CreateVoteData {
    pollId: number;
    userId: number;
    menuItemId: number;
}
export interface UpdateVoteData {
    menuItemId?: number;
}
export interface CreatePollResultData {
    pollId: number;
    winnerMenuItemId?: number;
    responsibleUserId: number;
    totalVotes: number;
    rouletteData?: any;
}
export interface UserFilters {
    telegramId?: number;
    username?: string;
    isAdmin?: boolean;
    isActive?: boolean;
}
export interface GroupFilters {
    telegramId?: number;
    title?: string;
    type?: string;
    isActive?: boolean;
}
export interface MenuItemFilters {
    name?: string;
    category?: string;
    isActive?: boolean;
    createdBy?: number;
}
export interface PollFilters {
    groupId?: number;
    status?: PollStatus;
    createdBy?: number;
    dateFrom?: Date;
    dateTo?: Date;
}
export interface VoteFilters {
    pollId?: number;
    userId?: number;
    menuItemId?: number;
}
export interface MenuItemStats {
    id: number;
    name: string;
    totalVotes: number;
    winCount: number;
    winRate: number;
    lastVoted?: Date;
}
export interface UserStats {
    id: number;
    telegramId: number;
    firstName: string;
    username?: string;
    voteCount: number;
    responsibleCount: number;
    lastActive?: Date;
}
export interface PollStats {
    id: number;
    groupId: number;
    totalVotes: number;
    uniqueVoters: number;
    winnerName?: string;
    responsibleName?: string;
    startedAt: Date;
    endedAt?: Date;
}
export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
//# sourceMappingURL=database.types.d.ts.map