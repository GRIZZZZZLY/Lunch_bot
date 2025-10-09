/**
 * Типы для системы голосований
 */

// Последний голос пользователя
export interface UserLastVote {
  pollId: number;
  pollTitle: string;
  menuItemId: number;
  menuItemName: string;
  votedAt: string; // ISO timestamp
  rating: 'like' | 'dislike' | null; // Оценка пользователя
}

// Самое популярное блюдо
export interface TopDish {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  rating: number; // 0-5
  popularityPercent: number; // 0-100
  voteCount: number;
}

// Текущий статус голоса пользователя
export interface UserVoteStatus {
  hasVoted: boolean;
  votedItemId?: number;
  votedItemName?: string;
  votedAt?: string;
  sameChoiceCount?: number; // Сколько других выбрали то же
}
