import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      /* Кэш живёт дольше сессии обеда. При 5 минутах возврат на вкладку после
         паузы заставал пустой кэш, страница снова показывала скелет и человек
         видел загрузку там, где данные уже читал. Устаревшие данные при этом
         не залипают: staleTime 30s всё равно перезапрашивает их в фоне, но
         поверх уже показанного контента. */
      gcTime: 30 * 60_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  auth: ['auth'] as const,
  me: ['user', 'me'] as const,
  polls: {
    all: ['polls'] as const,
    active: ['polls', 'active'] as const,
    activeForGroup: (groupId: string) => ['polls', 'active', groupId] as const,
    byId: (id: number) => ['polls', id] as const,
    results: (id: number) => ['polls', id, 'results'] as const,
    history: (params?: object) => ['polls', 'history', params] as const,
    myVotes: (id: number) => ['polls', id, 'my-votes'] as const,
  },
  menu: {
    all: ['menu'] as const,
    active: ['menu', 'active'] as const,
    byId: (id: number) => ['menu', id] as const,
  },
  suggestions: {
    all: ['suggestions'] as const,
    list: (params?: object) => ['suggestions', 'list', params] as const,
    byId: (id: number) => ['suggestions', id] as const,
    stats: ['suggestions', 'stats'] as const,
  },
  budget: {
    debts: (params?: object) => ['budget', 'debts', params] as const,
    credits: (params?: object) => ['budget', 'credits', params] as const,
    stats: (params?: object) => ['budget', 'stats', params] as const,
  },
  storeRuns: {
    all: ['storeRuns'] as const,
    active: () => ['storeRuns', 'active'] as const,
    detail: (id: number) => ['storeRuns', 'detail', id] as const,
  },
  admin: {
    all: ['admin'] as const,
    users: (groupId: number) => ['admin', 'users', groupId] as const,
    debtors: (groupId: number) => ['admin', 'debtors', groupId] as const,
    debtStats: (groupId: number) => ['admin', 'debt-stats', groupId] as const,
    cleanupStats: (groupId: number) => ['admin', 'cleanup-stats', groupId] as const,
    reminderSettings: (groupId: number) => ['admin', 'reminder-settings', groupId] as const,
    notificationSettings: (groupId: number) => ['admin', 'notification-settings', groupId] as const,
  },
};
