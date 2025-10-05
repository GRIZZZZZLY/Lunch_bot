export declare enum VoteType {
    MENU_ITEM = "MENU_ITEM",
    BRING_OWN = "BRING_OWN",
    SKIP = "SKIP"
}
export interface CreateVoteWithTypeData {
    pollId: number;
    userId: number;
    voteType: VoteType;
    menuItemId?: number;
    customOption?: string;
}
export interface VoteTypeStats {
    menuItemVotes: number;
    bringOwnVotes: number;
    skipVotes: number;
    total: number;
}
export interface VoteWithTypeInfo {
    id: number;
    pollId: number;
    userId: number;
    userName: string;
    voteType: VoteType;
    menuItemId?: number;
    menuItemName?: string;
    customOption?: string;
    createdAt: Date;
}
//# sourceMappingURL=vote.types.d.ts.map