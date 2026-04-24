export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category?: string;
  emoji?: string;
  description?: string;
  deliveryMinutes?: number;
  isActive?: boolean;
  order?: number;
}

export type PollStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PollMenuItemLink {
  id: number;
  pollId: number;
  menuItemId: number;
  menuItem: MenuItem;
  _count?: { votes: number };
}

export interface Poll {
  id: number;
  groupId: string;
  status: PollStatus;
  duration: number;
  createdAt: string;
  closedAt?: string;
  creatorId?: number;
  menuItems?: PollMenuItemLink[];
  votes?: Vote[];
  participantsCount?: number;
  _count?: { votes: number; participants?: number };
}

export interface Vote {
  id: number;
  pollId: number;
  userId: number;
  menuItemId: number;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'username'>;
  menuItem?: Pick<MenuItem, 'id' | 'name' | 'emoji'>;
}

export interface PollResult {
  pollId: number;
  winnerId: number;
  winnerName: string;
  totalVotes: number;
  responsible?: {
    userId: number;
    name: string;
    method: 'volunteer' | 'roulette';
  };
}

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MenuSuggestion {
  id: number;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  status: SuggestionStatus;
  suggestedBy: number;
  reviewedBy?: number;
  reviewedAt?: string;
  rejectionReason?: string;
  createdMenuItemId?: number;
  createdAt: string;
  updatedAt: string;
  suggester?: Pick<User, 'id' | 'firstName' | 'username'>;
  reviewer?: Pick<User, 'id' | 'firstName' | 'username'>;
}

export type TransactionStatus = 'PENDING' | 'PAID' | 'CONFIRMED';

export interface Transaction {
  id: number;
  pollId: number;
  debtorId: number;
  creditorId: number;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  paidAt?: string;
  confirmedAt?: string;
  debtor?: Pick<User, 'id' | 'firstName' | 'username'>;
  creditor?: Pick<User, 'id' | 'firstName' | 'username'>;
  poll?: Pick<Poll, 'id' | 'createdAt' | 'closedAt' | 'status'>;
}
