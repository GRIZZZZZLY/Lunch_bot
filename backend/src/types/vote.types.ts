/**
 * Типы голосов
 */
export enum VoteType {
  MENU_ITEM = 'MENU_ITEM',      // Выбрал блюдо из меню
  BRING_OWN = 'BRING_OWN',      // Принесу из дома
  SKIP = 'SKIP',                 // Не обедаю сегодня
}

/**
 * Данные для создания голоса с новыми типами
 */
export interface CreateVoteWithTypeData {
  pollId: number;
  userId: number;
  voteType: VoteType;
  menuItemId?: number;           // Опционально, только для MENU_ITEM
  customOption?: string;         // Опционально, для дополнительных деталей
}

/**
 * Статистика голосов по типам
 */
export interface VoteTypeStats {
  menuItemVotes: number;
  bringOwnVotes: number;
  skipVotes: number;
  total: number;
}

/**
 * Расширенная информация о голосе
 */
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
