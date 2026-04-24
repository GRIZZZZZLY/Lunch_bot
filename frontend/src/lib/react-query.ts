// Совместимая обёртка вокруг lib/queryClient.
// Раньше создавала второй `new QueryClient()` — два инстанса параллельно
// приводили к рассинхрону кеша (invalidate в одном не работал в другом).
// Теперь реэкспортирует единый клиент.
//
// TODO (тех долг): унифицировать queryKeys ниже с lib/queryClient.ts
// (там menu.items()/items, здесь menu.lists() — разные имена для одного кеша).

export { queryClient, persister, cacheUtils } from './queryClient';

/**
 * Query Keys для типизации и централизованного управления.
 *
 * ВНИМАНИЕ: Дублирует часть структуры из lib/queryClient.ts.
 * Используется хуками из hooks/queries/*. Менять синхронно с queryClient.ts.
 */
export const queryKeys = {
  // Menu
  menu: {
    all: ['menu'] as const,
    lists: () => [...queryKeys.menu.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.menu.lists(), filters] as const,
    details: () => [...queryKeys.menu.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.menu.details(), id] as const,
    categories: () => [...queryKeys.menu.all, 'categories'] as const,
    categoryCounts: () => [...queryKeys.menu.all, 'categoryCounts'] as const,
  },

  // Polls
  polls: {
    all: ['polls'] as const,
    lists: () => [...queryKeys.polls.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.polls.lists(), filters] as const,
    details: () => [...queryKeys.polls.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.polls.details(), id] as const,
    active: (groupId?: number) =>
      [...queryKeys.polls.all, 'active', groupId] as const,
    history: (params?: Record<string, unknown>) =>
      [...queryKeys.polls.all, 'history', params] as const,
    results: (id: number) => [...queryKeys.polls.all, 'results', id] as const,
  },

  // User
  user: {
    all: ['user'] as const,
    me: () => [...queryKeys.user.all, 'me'] as const,
    paymentInfo: () => [...queryKeys.user.all, 'paymentInfo'] as const,
    groups: () => [...queryKeys.user.all, 'groups'] as const,
  },

  // Votes
  votes: {
    all: ['votes'] as const,
    byPoll: (pollId: number) => [...queryKeys.votes.all, 'poll', pollId] as const,
  },

  // Store runs ("Иду в магазин")
  storeRuns: {
    all: ['storeRuns'] as const,
    active: () => [...queryKeys.storeRuns.all, 'active'] as const,
    detail: (id: number) => [...queryKeys.storeRuns.all, 'detail', id] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
