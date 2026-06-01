export type GroupRole = 'CREATOR' | 'ADMIN' | 'MEMBER';

export interface UserGroup {
  id: number;
  title: string;
  role: GroupRole;
  isActive: boolean;
}

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}
