export interface CreateMenuItemData {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isActive?: boolean;
  createdBy: number; // Required field
  groupId: number;   // Required: блюдо принадлежит конкретной группе
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface MenuItemWithStats {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  voteCount: number;
  winCount: number;
  _count: {
    votes: number;
    pollResults: number;
  };
}
