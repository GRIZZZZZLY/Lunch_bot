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

/**
 * Команда в ключе кэша командных данных.
 *
 * Ответ этих запросов зависит от выбранной команды, а ключ её не содержал:
 * после переключения react-query отдавал из кэша данные ПРЕЖНЕЙ команды как
 * актуальные, потому что для него это был тот же самый запрос. Группа
 * добавлена в конец ключа — так префиксы (`['polls','active']`, `['budget']`)
 * продолжают работать для инвалидации сразу всех команд.
 *
 * `null` — команда ещё не определена (загрузка, человек без команд). Это
 * отдельная ячейка кэша, а не «все команды»: запросы с таким ключом не
 * выполняются вовсе, см. `enabled` в хуках.
 */
export type GroupKey = string | null;

export const queryKeys = {
  auth: ['auth'] as const,
  me: ['user', 'me'] as const,
  polls: {
    all: ['polls'] as const,
    /** Префикс для инвалидации активных голосований всех команд. */
    active: ['polls', 'active'] as const,
    activeForGroup: (groupId: GroupKey) => ['polls', 'active', groupId] as const,
    byId: (id: number) => ['polls', id] as const,
    results: (id: number) => ['polls', id, 'results'] as const,
    /** Префикс для инвалидации последнего завершённого во всех командах. */
    lastCompleted: ['polls', 'last-completed'] as const,
    lastCompletedForGroup: (groupId: GroupKey) =>
      ['polls', 'last-completed', groupId] as const,
    history: (groupId: GroupKey, params?: object) =>
      ['polls', 'history', groupId, params] as const,
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
    all: ['budget'] as const,
    debts: (groupId: GroupKey, params?: object) =>
      ['budget', 'debts', groupId, params] as const,
    credits: (groupId: GroupKey, params?: object) =>
      ['budget', 'credits', groupId, params] as const,
    stats: (groupId: GroupKey, params?: object) =>
      ['budget', 'stats', groupId, params] as const,
  },
  storeRuns: {
    all: ['storeRuns'] as const,
    /** Префикс для инвалидации активных забегов всех команд. */
    active: () => ['storeRuns', 'active'] as const,
    activeForGroup: (groupId: GroupKey) =>
      ['storeRuns', 'active', groupId] as const,
    detail: (id: number) => ['storeRuns', 'detail', id] as const,
  },
  groupStores: {
    all: ['groupStores'] as const,
    list: (groupId: number) => ['groupStores', 'list', groupId] as const,
  },
  /* Магазин и группа входят в ключ: порядок списка зависит от обоих, и общий
     кэш показывал бы сортировку, посчитанную для другого места. */
  itemPresets: {
    all: ['itemPresets'] as const,
    list: (storeId: number | null, groupId: number | null) =>
      ['itemPresets', 'list', storeId, groupId] as const,
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
