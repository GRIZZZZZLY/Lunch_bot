import type { MenuItem, MenuSuggestion, Poll, PollResult, Transaction, User } from '../../../src/types/models';
import type { UserGroup } from '../../../src/services/user.service';
import type { GroupStore } from '../../../src/services/group-store.service';
import type { ItemPreset } from '../../../src/services/item-preset.service';
import type {
  StoreItem,
  StoreRunListItem,
  StoreRunWithRelations,
} from '../../../src/services/store-run.service';

/* Роли глобального администратора здесь нет намеренно: право выводится только
   из роли в группе, и фикстура, дающая доступ мимо неё, снова развела бы две
   системы прав. */
export type E2ERole =
  | 'creator'
  | 'admin'
  | 'member'
  | 'storeInitiator'
  | 'storeParticipant'
  | 'responsible'
  | 'debtor';

export type ScenarioName =
  | 'default'
  | 'empty'
  | 'groups-none'
  | 'groups-multiple'
  | 'active-poll-unvoted'
  | 'active-poll-voted'
  | 'completed-poll'
  | 'menu-empty'
  | 'menu-error'
  | 'auth-error'
  | 'auth-missing-init-data'
  | 'expired-session'
  | 'store-collecting'
  | 'store-shopping'
  | 'store-settled'
  | 'store-cancelled'
  | 'store-forbidden'
  | 'store-not-found'
  | 'budget-debtor'
  | 'budget-responsible'
  | 'suggestions'
  | 'api-error';

export interface FailureRule {
  status: number;
  error: string;
  code: string;
  remaining?: number;
  abort?: boolean;
}

export interface RequestRecord {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

export interface E2EState {
  role: E2ERole;
  user: User;
  groups: UserGroup[];
  menu: MenuItem[];
  polls: Poll[];
  history: Poll[];
  myVotes: Record<number, number[]>;
  pollResults: Record<number, PollResult>;
  storeRuns: StoreRunWithRelations[];
  groupStores: GroupStore[];
  itemPresets: ItemPreset[];
  debts: Transaction[];
  credits: Transaction[];
  suggestions: MenuSuggestion[];
  paymentInfo: { paymentPhone?: string; paymentCard?: string; paymentDetails?: string };
  failures: Record<string, FailureRule>;
  delays: Record<string, number>;
  requests: RequestRecord[];
  unexpectedRequests: string[];
  expectedNetworkFailures: string[];
  initData: string;
  validateAuth: boolean;
  refreshAuth: boolean;
  expireProtectedRequestOnce: boolean;
  protectedRequestExpired: boolean;
}

const CREATED_AT = '2026-07-14T09:00:00.000Z';
const ACTIVE_CREATED_AT = '2026-07-20T09:00:00.000Z';
/** Закупка открыта в 09:00, сбор до 10:00 — окно часа, как в жизни. */
const RUN_CREATED_AT = '2026-07-20T09:00:00.000Z';

export const USERS = {
  current: {
    id: 101,
    telegramId: '700000101',
    username: 'anna_e2e',
    firstName: 'Анна',
    lastName: 'Тестова',
    isAdmin: false,
    createdAt: CREATED_AT,
  },
  initiator: {
    id: 202,
    telegramId: '700000202',
    username: 'igor_e2e',
    firstName: 'Игорь',
    lastName: 'Инициаторов',
    isAdmin: false,
    createdAt: CREATED_AT,
  },
} satisfies Record<string, User>;

export const MENU: MenuItem[] = [
  {
    id: 11,
    name: 'Борщ со сметаной',
    price: 390,
    category: 'Супы',
    description: 'Говядина, свёкла, сметана',
    emoji: '🥣',
    isActive: true,
  },
  {
    id: 12,
    name: 'Паста карбонара',
    price: 520,
    category: 'Горячее',
    description: 'Бекон, пармезан, сливочный соус',
    emoji: '🍝',
    isActive: true,
  },
  {
    id: 13,
    name: 'Салат с киноа',
    price: 430,
    category: 'Салаты',
    description: 'Киноа, авокадо, томаты',
    emoji: '🥗',
    isActive: false,
  },
];

function vote(id: number, userId: number, menuItemId: number, firstName: string) {
  return {
    id,
    pollId: 501,
    userId,
    menuItemId,
    createdAt: CREATED_AT,
    user: { id: userId, firstName, username: `${firstName.toLowerCase()}_e2e` },
  };
}

export function makeActivePoll(): Poll {
  const votes = [vote(1, 202, 11, 'Игорь'), vote(2, 303, 12, 'Мария')];
  return {
    id: 501,
    groupId: '1',
    status: 'ACTIVE',
    duration: 30,
    createdAt: ACTIVE_CREATED_AT,
    creatorId: 202,
    menuItems: MENU.slice(0, 2).map((item) => ({
      id: 900 + item.id,
      pollId: 501,
      menuItemId: item.id,
      menuItem: item,
      _count: { votes: votes.filter((entry) => entry.menuItemId === item.id).length },
    })),
    votes,
    participantsCount: 2,
    _count: { votes: 2, participants: 2 },
  };
}

export function makeCompletedPoll(id = 401): Poll {
  return {
    ...makeActivePoll(),
    id,
    status: 'COMPLETED',
    createdAt: '2026-07-17T09:00:00.000Z',
    closedAt: '2026-07-17T09:30:00.000Z',
    menuItems: MENU.slice(0, 2).map((item, index) => ({
      id: 800 + item.id,
      pollId: id,
      menuItemId: item.id,
      menuItem: item,
      _count: { votes: index === 0 ? 3 : 1 },
    })),
    votes: [
      { ...vote(11, 101, 11, 'Анна'), pollId: id },
      { ...vote(12, 202, 11, 'Игорь'), pollId: id },
      { ...vote(13, 303, 11, 'Мария'), pollId: id },
      { ...vote(14, 404, 12, 'Олег'), pollId: id },
    ],
    _count: { votes: 4, participants: 4 },
  };
}

function roleToGroupRole(role: E2ERole): string {
  if (role === 'creator') return 'CREATOR';
  if (role === 'admin') return 'ADMIN';
  return 'MEMBER';
}

function makeGroups(role: E2ERole): UserGroup[] {
  return [
    {
      id: 1,
      title: 'Команда Ракета',
      telegramId: '-100000000001',
      type: 'supergroup',
      isActive: true,
      role: roleToGroupRole(role),
    },
  ];
}

function makeStoreItems(currentIsInitiator: boolean): StoreItem[] {
  const currentId = USERS.current.id;
  const initiatorId = currentIsInitiator ? currentId : USERS.initiator.id;
  return [
    {
      id: 701,
      storeRunId: 601,
      userId: currentId,
      name: 'Молоко 3,2%',
      quantity: 2,
      notes: 'Синюю пачку',
      price: null,
      status: 'REQUESTED',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      user: USERS.current,
    },
    {
      id: 702,
      storeRunId: 601,
      userId: initiatorId,
      name: 'Хлеб бородинский',
      quantity: 1,
      notes: null,
      price: null,
      status: 'REQUESTED',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      user: currentIsInitiator ? USERS.current : USERS.initiator,
    },
  ];
}

/** Справочник магазинов группы: подсказки под полем «Откуда заказываем». */
export function makeGroupStores(): GroupStore[] {
  return [
    {
      id: 901,
      groupId: 1,
      name: 'Пятёрочка у офиса',
      lastUsedAt: RUN_CREATED_AT,
      usageCount: 4,
      archivedAt: null,
    },
    {
      id: 902,
      groupId: 1,
      name: 'Магнит на Ленина',
      lastUsedAt: '2026-07-10T09:00:00.000Z',
      usageCount: 2,
      archivedAt: null,
    },
  ];
}

/** Личный список товаров: то, что пользователь уже заказывал. */
export function makeItemPresets(): ItemPreset[] {
  return [
    {
      id: 801,
      name: 'Молоко 3,2%',
      quantity: 2,
      notes: 'в стеклянной бутылке',
      pinned: true,
      usageCount: 7,
      lastUsedAt: RUN_CREATED_AT,
    },
    {
      id: 802,
      name: 'Кофе в зёрнах',
      quantity: 1,
      notes: null,
      pinned: false,
      usageCount: 3,
      lastUsedAt: '2026-07-12T09:00:00.000Z',
    },
  ];
}

export function makeStoreRun(
  status: StoreRunWithRelations['status'],
  currentIsInitiator: boolean,
): StoreRunWithRelations {
  const initiator = currentIsInitiator ? USERS.current : USERS.initiator;
  const items = makeStoreItems(currentIsInitiator).map((item, index) => {
    if (status === 'SHOPPING' && index === 1) return { ...item, status: 'BOUGHT' as const, price: 129 };
    if (status === 'SETTLED') {
      return index === 0
        ? { ...item, status: 'BOUGHT' as const, price: 180 }
        : { ...item, status: 'NOT_FOUND' as const, price: null };
    }
    return item;
  });
  return {
    id: 601,
    groupId: 1,
    initiatorId: initiator.id,
    storeId: 901,
    storeName: 'Пятёрочка у офиса',
    status,
    collectUntil: '2026-07-20T10:00:00.000Z',
    shoppingAt: status === 'SHOPPING' || status === 'SETTLED' ? RUN_CREATED_AT : null,
    settledAt: status === 'SETTLED' ? '2026-07-14T10:00:00.000Z' : null,
    /* Отдельная метка, а не общий CREATED_AT: полоса сбора считается как
       remaining / (collectUntil − createdAt). С общей меткой окно выходило почти
       двое суток, полоса оказывалась пустой при живом таймере, и компонент было
       не разглядеть ни на снимках, ни глазами. Реальное окно — 3..30 минут. */
    createdAt: RUN_CREATED_AT,
    updatedAt: RUN_CREATED_AT,
    initiator,
    group: { id: 1, telegramId: '-100000000001', title: 'Команда Ракета' },
    items,
  };
}

function toListItem(run: StoreRunWithRelations): StoreRunListItem {
  return {
    ...run,
    items: run.items.map(({ id, name, quantity }) => ({ id, name, quantity })),
  };
}

export function activeStoreRunList(state: E2EState): StoreRunListItem[] {
  return state.storeRuns
    .filter((run) => run.status === 'COLLECTING' || run.status === 'SHOPPING')
    .map(toListItem);
}

function makeTransactions(): { debts: Transaction[]; credits: Transaction[] } {
  return {
    debts: [
      {
        id: 801,
        pollId: 401,
        fromUserId: USERS.current.id,
        toUserId: USERS.initiator.id,
        amount: 420,
        status: 'PENDING',
        createdAt: CREATED_AT,
        /* Реквизиты получателя приходят вместе со СВОИМ долгом — по ним и
           переводят. В кредитах их нет: деньги идут в обратную сторону. */
        toUser: { ...USERS.initiator, paymentPhone: '+7 900 123-45-67', paymentCard: 'https://www.tinkoff.ru/rm/test-link' },
        fromUser: USERS.current,
        // за что долг: обеденная транзакция несёт блюдо
        menuItem: { id: 12, name: 'Паста карбонара' },
      },
      {
        id: 802,
        pollId: 401,
        fromUserId: USERS.current.id,
        toUserId: USERS.initiator.id,
        amount: 180,
        status: 'PAID',
        createdAt: CREATED_AT,
        toUser: { ...USERS.initiator, paymentPhone: '+7 900 123-45-67' },
        fromUser: USERS.current,
        // а магазинная — забег: две строки к одному человеку теперь различимы
        storeRun: { id: 601, storeName: 'Пятёрочка у офиса' },
        // отмечено сутки назад — экран должен показать, сколько уже ждём
        paidAt: '2026-07-19T09:00:00.000Z',
      },
    ],
    credits: [
      {
        id: 803,
        pollId: 401,
        fromUserId: 303,
        toUserId: USERS.current.id,
        amount: 390,
        status: 'PAID',
        createdAt: CREATED_AT,
        toUser: USERS.current,
        fromUser: { id: 303, firstName: 'Мария', username: 'maria_e2e' },
        menuItem: { id: 102, name: 'Борщ со сметаной' },
        // память о напоминаниях: сборщик должен видеть, что уже напоминал
        reminderCount: 2,
        lastReminderAt: '2026-07-19T09:00:00.000Z',
      },
    ],
  };
}

function makeSuggestions(): MenuSuggestion[] {
  return [
    {
      id: 901,
      name: 'Том-ям',
      description: 'Средней остроты',
      price: 590,
      status: 'PENDING',
      suggestedBy: USERS.current.id,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      suggester: USERS.current,
    },
    {
      id: 902,
      name: 'Фалафель',
      price: 410,
      status: 'APPROVED',
      suggestedBy: USERS.initiator.id,
      reviewedBy: USERS.current.id,
      reviewedAt: CREATED_AT,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      suggester: USERS.initiator,
    },
    {
      id: 903,
      name: 'Слишком острый рамен',
      status: 'REJECTED',
      rejectionReason: 'Не подходит команде',
      suggestedBy: USERS.current.id,
      reviewedBy: USERS.initiator.id,
      reviewedAt: CREATED_AT,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      suggester: USERS.current,
    },
  ];
}

export function createScenario(name: ScenarioName, role: E2ERole): E2EState {
  const completed = makeCompletedPoll();
  const tx = makeTransactions();
  /* users.is_admin ещё существует в схеме, но ничего не открывает: колонку
     читает только карточка управления людьми, чтобы показать чужой флаг. */
  const currentUser = {
    ...USERS.current,
    isAdmin: false,
  };
  const state: E2EState = {
    role,
    user: currentUser,
    groups: makeGroups(role),
    menu: MENU.map((item) => ({ ...item })),
    polls: [],
    history: [completed],
    myVotes: {},
    pollResults: {
      [completed.id]: {
        pollId: completed.id,
        winnerId: 11,
        winnerName: 'Борщ со сметаной',
        totalVotes: 4,
        responsible: { userId: 202, name: 'Игорь', method: 'roulette' },
      },
    },
    storeRuns: [],
    /* Справочник магазинов есть всегда: подсказки под «Откуда заказываем»
       тянутся на главной, ещё до всякой закупки. */
    groupStores: makeGroupStores(),
    itemPresets: [],
    debts: [],
    credits: [],
    suggestions: [],
    paymentInfo: {
      paymentPhone: '+7 900 111-22-33',
      paymentDetails: 'Т-Банк',
      paymentCard: 'https://www.tinkoff.ru/rm/test-link',
    },
    failures: {},
    delays: {},
    requests: [],
    unexpectedRequests: [],
    expectedNetworkFailures: [],
    initData: 'query_id=e2e&user=%7B%22id%22%3A700000101%7D&auth_date=1900000000&hash=e2e',
    validateAuth: true,
    refreshAuth: true,
    expireProtectedRequestOnce: false,
    protectedRequestExpired: false,
  };

  if (name === 'empty') {
    state.menu = [];
    state.history = [];
    state.paymentInfo = {};
  }
  if (name === 'groups-none') state.groups = [];
  if (name === 'groups-multiple') {
    state.groups.push({
      id: 2,
      title: 'Команда Спутник',
      telegramId: '-100000000002',
      type: 'supergroup',
      isActive: true,
      role: 'MEMBER',
    });
    state.groups.push({
      id: 3,
      title: 'Архивная группа',
      telegramId: '-100000000003',
      type: 'supergroup',
      isActive: false,
      role: 'MEMBER',
    });
  }
  if (name === 'active-poll-unvoted' || name === 'active-poll-voted') {
    const active = makeActivePoll();
    state.polls = [active];
    state.pollResults[active.id] = {
      pollId: active.id,
      winnerId: 11,
      winnerName: 'Борщ со сметаной',
      totalVotes: 2,
    };
    if (name === 'active-poll-voted') state.myVotes[active.id] = [11];
  }
  if (name === 'completed-poll') state.polls = [];
  if (name === 'menu-empty') state.menu = [];
  if (name === 'menu-error') {
    state.failures['GET /menu'] = {
      status: 500,
      error: 'Меню временно недоступно',
      code: 'INTERNAL_ERROR',
    };
  }
  if (name === 'auth-error') state.validateAuth = false;
  if (name === 'auth-missing-init-data') {
    state.initData = '';
    state.validateAuth = false;
  }
  if (name === 'expired-session') state.expireProtectedRequestOnce = true;
  if (name.startsWith('store-')) {
    const currentIsInitiator = role === 'storeInitiator' || role === 'creator' || role === 'admin';
    /* Личный список наполняем только в сценариях закупки: он виден лишь в
       шторке добавления позиции. */
    state.itemPresets = makeItemPresets();
    if (name === 'store-collecting') state.storeRuns = [makeStoreRun('COLLECTING', currentIsInitiator)];
    if (name === 'store-shopping') state.storeRuns = [makeStoreRun('SHOPPING', currentIsInitiator)];
    if (name === 'store-settled') state.storeRuns = [makeStoreRun('SETTLED', currentIsInitiator)];
    if (name === 'store-cancelled') state.storeRuns = [makeStoreRun('CANCELLED', currentIsInitiator)];
    if (name === 'store-forbidden') {
      state.failures['GET /store-runs/601'] = {
        status: 403,
        error: 'Вы не состоите в этой группе',
        code: 'FORBIDDEN',
      };
    }
    if (name === 'store-not-found') {
      state.failures['GET /store-runs/999'] = {
        status: 404,
        error: 'Закупка не найдена',
        code: 'NOT_FOUND',
      };
    }
  }
  if (name === 'budget-debtor') state.debts = tx.debts;
  if (name === 'budget-responsible') state.credits = tx.credits;
  if (name === 'suggestions') state.suggestions = makeSuggestions();
  if (name === 'api-error') {
    state.failures['GET /polls/active'] = {
      status: 500,
      error: 'Временная ошибка сервера',
      code: 'INTERNAL_ERROR',
    };
  }
  if (role === 'debtor' && name === 'default') state.debts = tx.debts;
  if (role === 'responsible' && name === 'default') state.credits = tx.credits;

  return state;
}
