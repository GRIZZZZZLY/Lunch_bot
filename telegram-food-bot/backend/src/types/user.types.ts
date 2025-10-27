export interface CreateUserData {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
}

export interface UpdateUserData {
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface UserWithStats {
  id: number;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    votes: number;
    pollResults: number;
  };
}
