import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Конфигурация React Query
 * P1 Task: Улучшенное кеширование + Offline support
 * ВАЖНО: Polls НЕ кэшируются долго, так как они меняются часто
 */
const queryConfig: DefaultOptions = {
  queries: {
    // Время кэширования для большинства запросов
    staleTime: 1 * 60 * 1000, // 1 минута (было 5)
    // Время хранения в кэше
    gcTime: 5 * 60 * 1000, // 5 минут (было 10)
    // Повторные запросы при ошибках
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Не рефетчить при фокусе окна (Mini App не нуждается)
    refetchOnWindowFocus: false,
    // Рефетч при восстановлении соединения
    refetchOnReconnect: true,
    // ВАЖНО: Рефетчить при монтировании для polls
    refetchOnMount: 'always',
    // Network mode
    networkMode: 'online',
  },
  mutations: {
    // Повторные попытки при ошибках мутаций
    retry: 1,
    retryDelay: 1000,
    networkMode: 'online',
  },
};

/**
 * Создание Query Client
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

/**
 * Persister для offline support
 * Сохраняет cache в localStorage
 * ВАЖНО: Фильтрует polls - они НЕ должны сохраняться долго
 */
export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'TELEGRAM_FOOD_BOT_CACHE',
  serialize: (data) => {
    // Фильтруем polls из персистенции
    const filtered = {
      ...data,
      clientState: {
        ...data.clientState,
        queries: data.clientState.queries.filter((query: any) => {
          // Не сохраняем polls в localStorage
          const queryKey = query.queryKey;
          if (Array.isArray(queryKey) && queryKey[0] === 'polls') {
            return false;
          }
          return true;
        })
      }
    };
    return JSON.stringify(filtered);
  },
  deserialize: (data) => JSON.parse(data),
});

/**
 * Query Keys для типизации и централизованного управления
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
} as const;

/**
 * Типы для удобной работы с query keys
 */
export type QueryKeys = typeof queryKeys;

/**
 * Cache utilities для управления кешем
 * P1 Task: Удобные методы для invalidation и prefetch
 */
export const cacheUtils = {
  /**
   * Очистить весь cache
   */
  clearAll: () => {
    queryClient.clear();
    localStorage.removeItem('TELEGRAM_FOOD_BOT_CACHE');
  },
  
  /**
   * Очистить старый кэш polls при запуске приложения
   */
  clearStalePollsCache: () => {
    queryClient.removeQueries({ 
      queryKey: ['polls'],
      exact: false 
    });
  },
  
  /**
   * Очистить cache для polls
   */
  clearPolls: () => {
    queryClient.removeQueries({ queryKey: queryKeys.polls.all });
  },
  
  /**
   * Очистить cache для menu
   */
  clearMenu: () => {
    queryClient.removeQueries({ queryKey: queryKeys.menu.all });
  },
  
  /**
   * Invalidate (принудительно обновить) активные polls
   */
  invalidateActivePolls: (groupId?: number) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.polls.active(groupId) });
  },
  
  /**
   * Invalidate menu items
   */
  invalidateMenuItems: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
  },
  
  /**
   * Prefetch активные polls (для HomePage)
   */
  prefetchActivePolls: async (fetcher: () => Promise<any>, groupId?: number) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.polls.active(groupId),
      queryFn: fetcher,
    });
  },
  
  /**
   * Получить данные из cache без запроса
   */
  getCachedActivePolls: (groupId?: number) => {
    return queryClient.getQueryData(queryKeys.polls.active(groupId));
  },
  
  getCachedMenuItems: () => {
    return queryClient.getQueryData(queryKeys.menu.lists());
  },
};
