// Pre-baked mock responses for API endpoints. Selectable per scenario.
export const BASE_USER = {
  id: 42,
  telegramId: '123456789',
  username: 'testuser',
  firstName: 'Иван',
  lastName: 'Иванов',
  isAdmin: true,
  createdAt: '2025-01-10T10:00:00.000Z',
};

export const MENU_ITEMS = [
  { id: 1, name: 'Пельмени', price: 320, category: 'hot', emoji: '🥟', description: 'Домашние', isActive: true },
  { id: 2, name: 'Борщ', price: 280, category: 'soup', emoji: '🍜', description: 'Со сметаной', isActive: true },
  { id: 3, name: 'Цезарь', price: 390, category: 'salad', emoji: '🥗', description: 'С курицей', isActive: true },
  { id: 4, name: 'Плов', price: 350, category: 'hot', emoji: '🍚', description: 'По-узбекски', isActive: true },
  { id: 5, name: 'Сырники', price: 260, category: 'dessert', emoji: '🥞', description: 'Со сгущёнкой', isActive: true },
  { id: 6, name: 'Компот', price: 90, category: 'drink', emoji: '🥤', description: 'Из сухофруктов', isActive: true },
];

const now = () => new Date().toISOString();
const pastMin = (m) => new Date(Date.now() - m * 60_000).toISOString();
const futureMin = (m) => new Date(Date.now() + m * 60_000).toISOString();

export const ACTIVE_POLL = {
  id: 101,
  groupId: '1',
  status: 'ACTIVE',
  duration: 30,
  createdAt: pastMin(10),
  closedAt: null,
  creatorId: 42,
  menuItems: MENU_ITEMS.slice(0, 4).map((m, i) => ({
    id: 200 + i,
    pollId: 101,
    menuItemId: m.id,
    menuItem: m,
    _count: { votes: [3, 5, 2, 1][i] },
  })),
  votes: [],
};

export const ACTIVE_POLL_ENDING = { ...ACTIVE_POLL, createdAt: pastMin(28), id: 102 };

export const COMPLETED_POLL = {
  ...ACTIVE_POLL,
  id: 103,
  status: 'COMPLETED',
  closedAt: pastMin(30),
  createdAt: pastMin(90),
};

export const HISTORY_POLLS = [COMPLETED_POLL, { ...COMPLETED_POLL, id: 104, createdAt: pastMin(2 * 24 * 60) }, { ...COMPLETED_POLL, id: 105, createdAt: pastMin(7 * 24 * 60) }];

export const POLL_RESULT = {
  pollId: 103,
  poll: COMPLETED_POLL,
  winnerId: 1,
  winnerName: 'Пельмени',
  totalVotes: 11,
  participantsCount: 11,
  responsible: { userId: 77, name: 'Анна', method: 'roulette' },
  menuItems: COMPLETED_POLL.menuItems,
  closedAt: COMPLETED_POLL.closedAt,
  rouletteData: null,
};

export const USER_STATS = {
  totalVotes: 42,
  totalPolls: 60,
  participationRate: 70,
  favoriteItems: [
    { itemId: 1, itemName: 'Пельмени', voteCount: 12, percentage: 28 },
    { itemId: 2, itemName: 'Борщ', voteCount: 8, percentage: 19 },
    { itemId: 4, itemName: 'Плов', voteCount: 5, percentage: 12 },
  ],
  recentActivity: [
    { pollId: 103, pollTitle: 'Обед 24 апреля', votedAt: pastMin(60), itemName: 'Пельмени' },
    { pollId: 104, pollTitle: 'Обед 23 апреля', votedAt: pastMin(2*24*60), itemName: 'Борщ' },
  ],
};

export const URGENT_DEBT_TX = {
  id: 901,
  pollId: 103,
  debtorId: 42,
  creditorId: 77,
  amount: 320,
  status: 'PENDING',
  createdAt: pastMin(3),
  paidAt: null,
  confirmedAt: null,
  creditor: { id: 77, firstName: 'Анна', lastName: '', username: 'anna' },
  debtor: BASE_USER,
  poll: COMPLETED_POLL,
};

export const MY_GROUP = {
  id: 1,
  title: 'Обеды офис',
  telegramId: '-1001234567890',
  type: 'supergroup',
  isActive: true,
  role: 'ADMIN',
};

// ---- scenario matchers ----
// returns mock handler map for a given scenario key
export function buildMocks(scenario) {
  const m = {
    // Auth
    '/api/auth/validate': () => ({
      success: true,
      data: {
        user: BASE_USER,
        accessToken: 'mock-jwt-access',
        refreshToken: 'mock-jwt-refresh',
        expiresIn: 3600,
      },
    }),
    '/api/auth/me': () => ({ success: true, data: BASE_USER }),
    '/api/auth/status': () => ({ success: true, data: { authenticated: true, user: BASE_USER, timestamp: new Date().toISOString() } }),
    '/api/auth/refresh': () => ({
      success: true,
      data: {
        user: BASE_USER,
        accessToken: 'mock-jwt-access',
        refreshToken: 'mock-jwt-refresh',
      },
    }),
    '/api/user/me': () => ({ success: true, data: BASE_USER }),
    '/api/user/groups': () => ({ success: true, data: [MY_GROUP] }),
    '/api/user/payment-info': () => ({ success: true, data: { sbpPhone: '+79991234567', bankName: 'Тинькофф' } }),

    // Menu
    '/api/menu': () => ({ success: true, data: MENU_ITEMS }),
    '/api/menu/active': () => ({ success: true, data: MENU_ITEMS }),

    // Polls
    '/api/polls': () => ({ success: true, data: { polls: HISTORY_POLLS, total: HISTORY_POLLS.length, limit: 30, offset: 0, hasNext: false } }),
    '/api/polls/active': () => ({ success: true, data: [] }),
    '/api/polls/last-completed': () => ({ success: true, data: null }),
    '/api/polls/history': () => ({ success: true, data: { polls: HISTORY_POLLS, total: 3, limit: 30, offset: 0, hasNext: false } }),
    '/api/polls/stats': () => ({
      success: true,
      data: {
        totalPolls: 60,
        activePolls: 1,
        completedPolls: 59,
        totalVotes: 320,
        averageParticipation: 7.2,
        mostPopularItem: { id: 1, name: 'Пельмени', votes: 42 },
      },
    }),
    '/api/polls/popular-items': () => ({
      success: true,
      data: [
        { id: 1, name: 'Пельмени', votes: 42, emoji: '🥟', winCount: 15, price: 320 },
        { id: 2, name: 'Борщ', votes: 38, emoji: '🍜', winCount: 10, price: 280 },
        { id: 4, name: 'Плов', votes: 27, emoji: '🍚', winCount: 8, price: 350 },
        { id: 3, name: 'Цезарь', votes: 21, emoji: '🥗', winCount: 6, price: 390 },
      ],
    }),
    '/api/polls/trends': () => ({
      success: true,
      data: {
        byWeekday: [{ day: 1, votes: 45 }, { day: 2, votes: 52 }, { day: 3, votes: 38 }, { day: 4, votes: 61 }, { day: 5, votes: 44 }],
        byMonth: [{ month: '2026-02', polls: 18 }, { month: '2026-03', polls: 21 }, { month: '2026-04', polls: 12 }],
      },
    }),
    '/api/polls/today-completed': () => ({ success: true, data: null }),
    '/api/polls/compare': () => ({ success: true, data: {} }),
    '/api/polls/user-stats/my': () => ({
      success: true,
      data: {
        totalVotes: 42,
        totalPolls: 60,
        participationRate: 70,
        favoriteItems: [
          { itemId: 1, itemName: 'Пельмени', voteCount: 12, percentage: 28 },
          { itemId: 2, itemName: 'Борщ', voteCount: 8, percentage: 19 },
        ],
        recentActivity: [],
      },
    }),
    '/api/polls/votes/my': () => ({ success: true, data: { menuItemIds: [] } }),
    '/api/polls/user-stats/my': () => ({ success: true, data: USER_STATS }),

    // Budget
    '/api/budget/debts': () => ({ success: true, data: [] }),
    '/api/budget/credits': () => ({ success: true, data: [] }),
    '/api/budget/stats': () => ({ success: true, data: { totalDebts: 0, totalCredits: 0, balance: 0, pendingTransactions: 0 } }),

    // Suggestions
    '/api/suggestions': () => ({ success: true, data: { suggestions: [], total: 0 } }),
    '/api/suggestions/pending-count': () => ({ success: true, data: { count: 0 } }),
    '/api/suggestions/stats': () => ({ success: true, data: { total: 0, pending: 0, approved: 0, rejected: 0 } }),

    // Admin
    '/api/admin/debt-stats': () => ({ success: true, data: { totalDebts: 0, totalCredits: 0, byPoll: [] } }),
    '/api/admin/debtors': () => ({ success: true, data: [] }),
    '/api/admin/users': () => ({ success: true, data: { users: [BASE_USER], total: 1 } }),
    '/api/admin/notification-settings/1': () => ({ success: true, data: { remindEnabled: true, remindMinutesBefore: 5 } }),
    '/api/admin/reminder-settings/1': () => ({ success: true, data: { enabled: true, intervalMinutes: 60 } }),
    '/api/admin/cleanup/stats': () => ({ success: true, data: { oldPolls: 0, oldTransactions: 0 } }),

    // Recurring
    '/api/recurring/1': () => ({ success: true, data: null }),
  };
  // Attach regex-based routes as an internal map
  m.__regex = [
    [/^\/api\/polls\/\d+\/results$/, () => ({ success: true, data: POLL_RESULT })],
    [/^\/api\/polls\/\d+\/breakdown$/, () => ({ success: true, data: { items: POLL_RESULT.menuItems, winner: POLL_RESULT.winnerName } })],
    [/^\/api\/polls\/\d+\/my-votes$/, () => ({ success: true, data: { menuItemIds: [] } })],
    [/^\/api\/polls\/\d+$/, () => ({ success: true, data: COMPLETED_POLL })],
    [/^\/api\/menu\/\d+$/, () => ({ success: true, data: MENU_ITEMS[0] })],
    [/^\/api\/user\/\d+\/avatar$/, () => ({ success: true, data: { userId: 1, initial: 'И' } })],
    [/^\/api\/recurring\/\d+/, () => ({ success: true, data: null })],
    [/^\/api\/notifications\/cooldown\/\d+/, () => ({ success: true, data: { isActive: false, secondsLeft: 0 } })],
  ];

  // Scenario overrides
  switch (scenario) {
    case 'home-active':
    case 'home-voted':
    case 'home-ending':
      m['/api/polls/active'] = () => ({
        success: true,
        data: [scenario === 'home-ending' ? ACTIVE_POLL_ENDING : ACTIVE_POLL],
      });
      if (scenario === 'home-voted') {
        m['/api/polls/votes/my'] = () => ({ success: true, data: { menuItemIds: [1] } });
        m[/\/api\/polls\/\d+\/my-votes/] = () => ({ success: true, data: { menuItemIds: [1] } });
      }
      break;

    case 'home-urgent-debt':
      m['/api/polls/last-completed'] = () => ({ success: true, data: COMPLETED_POLL });
      m['/api/budget/debts'] = () => ({ success: true, data: [URGENT_DEBT_TX] });
      break;

    case 'budget-responsible':
      m['/api/budget/credits'] = () => ({
        success: true,
        data: [
          { ...URGENT_DEBT_TX, id: 1001, creditorId: 42, debtorId: 55, creditor: BASE_USER, debtor: { id: 55, firstName: 'Пётр', username: 'pyotr' } },
          { ...URGENT_DEBT_TX, id: 1002, creditorId: 42, debtorId: 66, creditor: BASE_USER, debtor: { id: 66, firstName: 'Мария', username: 'maria' }, status: 'PAID' },
        ],
      });
      break;

    case 'budget-waiting-confirm':
      m['/api/budget/debts'] = () => ({ success: true, data: [{ ...URGENT_DEBT_TX, status: 'PAID', paidAt: pastMin(2) }] });
      break;

    case 'budget-success':
      m['/api/budget/debts'] = () => ({ success: true, data: [{ ...URGENT_DEBT_TX, status: 'CONFIRMED', confirmedAt: pastMin(1) }] });
      break;

    case 'menu-empty':
      m['/api/menu'] = () => ({ success: true, data: [] });
      m['/api/menu/active'] = () => ({ success: true, data: [] });
      break;

    case 'history-empty':
      m['/api/polls/history'] = () => ({ success: true, data: { polls: [], total: 0, limit: 30, offset: 0, hasNext: false } });
      m['/api/polls'] = () => ({ success: true, data: { polls: [], total: 0, limit: 30, offset: 0, hasNext: false } });
      break;

    case 'stats-empty':
      m['/api/polls/history'] = () => ({ success: true, data: { polls: [], total: 0, limit: 30, offset: 0, hasNext: false } });
      m['/api/polls'] = () => ({ success: true, data: { polls: [], total: 0, limit: 30, offset: 0, hasNext: false } });
      m['/api/polls/stats'] = () => ({ success: true, data: { totalPolls: 0, activePolls: 0, completedPolls: 0, totalVotes: 0, averageParticipation: 0 } });
      m['/api/polls/popular-items'] = () => ({ success: true, data: [] });
      m['/api/polls/user-stats/my'] = () => ({ success: true, data: { totalVotes: 0, totalPolls: 0, participationRate: 0, favoriteItems: [], recentActivity: [] } });
      break;

    case 'profile-regular': {
      const regularUser = { ...BASE_USER, isAdmin: false };
      m['/api/user/me'] = () => ({ success: true, data: regularUser });
      m['/api/auth/me'] = () => ({ success: true, data: regularUser });
      m['/api/auth/validate'] = () => ({
        success: true,
        data: { user: regularUser, accessToken: 'mock-jwt-access', refreshToken: 'mock-jwt-refresh', expiresIn: 3600 },
      });
      break;
    }

    case 'profile-streak':
      // history with consecutive days of votes
      {
        const polls = [];
        for (let i = 0; i < 7; i++) {
          polls.push({
            ...COMPLETED_POLL,
            id: 2000 + i,
            createdAt: pastMin(i * 24 * 60 + 60),
            votes: [{ id: 3000 + i, pollId: 2000 + i, userId: 42, menuItemId: 1, createdAt: pastMin(i * 24 * 60) }],
          });
        }
        m['/api/polls/history'] = () => ({ success: true, data: { polls, total: polls.length, limit: 30, offset: 0, hasNext: false } });
      }
      break;
  }

  return m;
}
