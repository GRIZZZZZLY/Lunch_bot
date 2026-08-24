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
  /** `Decimal?` в схеме: блюдо можно создать без цены (бот, сид, одобренное
      предложение без суммы), и API отдаёт `null` как есть. Тип обязан это
      признавать — иначе `formatPrice(null)` падает на `toLocaleString`. */
  price: number | null;
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
  /**
   * Момент старта таймера. От него сервер считает окончание; у старых записей
   * и части ответов API поля нет, тогда в ход идёт `createdAt` (обычно тот же
   * момент) — см. `pollEndsAt` в features/home/lib/selectors.
   */
  startedAt?: string;
  /** Момент завершения (API отдаёт `endedAt`; `closedAt` — легаси-псевдоним). */
  endedAt?: string | null;
  closedAt?: string;
  creatorId?: number;
  menuItems?: PollMenuItemLink[];
  selectedMenuItemIds?: string | number[] | null;
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

/**
 * Транзакция долга. Имена полей — КАК В API (Prisma-модель + include), а не как
 * удобнее читать: fromUser всегда должник, toUser всегда получатель.
 *
 * Раньше здесь стояли `debtor`/`creditor`/`debtorId`/`creditorId`, которых бэкенд
 * не присылает никогда (serializeBigInt ключи не переименовывает). Поля молча
 * были undefined, и экран бюджета показывал «Участник» вместо каждого имени.
 * Мок e2e при этом отдавал именно `debtor`/`creditor`, поэтому тесты и снимки
 * показывали имена, которых в проде не было.
 */
export interface Transaction {
  id: number;
  pollId: number | null;
  storeRunId?: number | null;
  fromUserId: number;
  toUserId: number;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  paidAt?: string | null;
  confirmedAt?: string | null;
  /** Кто должен. */
  fromUser?: Pick<User, 'id' | 'firstName' | 'username'>;
  /** Кому должен. Реквизиты приходят ТОЛЬКО в списке своих долгов — там, где по
   *  ним и переводят; в списке кредитов их нет и быть не должно. */
  toUser?: Pick<User, 'id' | 'firstName' | 'username'> & {
    paymentPhone?: string | null;
    paymentCard?: string | null;
    paymentDetails?: string | null;
  };
  poll?: Pick<Poll, 'id' | 'createdAt' | 'closedAt' | 'status'>;
  /* За что долг: обеденная транзакция несёт блюдо, магазинная — забег. */
  menuItem?: { id: number; name: string };
  storeRun?: { id: number; storeName: string };
  /* Сколько раз напоминали и когда. Скалярные колонки — API отдавал их и раньше,
     тип не объявлял. */
  reminderCount?: number;
  lastReminderAt?: string | null;
}
