export interface CreateMenuItemData {
    name: string;
    description?: string;
    price?: number;
    category?: string;
    imageUrl?: string;
    isActive?: boolean;
}
export interface UpdateMenuItemData {
    name?: string;
    description?: string;
    price?: number;
    category?: string;
    imageUrl?: string;
    isActive?: boolean;
}
export interface MenuItemWithStats {
    id: number;
    name: string;
    description?: string;
    price?: number;
    category?: string;
    imageUrl?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    voteCount: number;
    winCount: number;
    _count: {
        votes: number;
        pollResults: number;
    };
}
//# sourceMappingURL=menu.types.d.ts.map