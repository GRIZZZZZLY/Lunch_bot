/**
 * React Query configuration
 * P1 Task: Кеширование + Offline support
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Default options для React Query
 * 
 * Оптимизировано для Telegram Mini App:
 * - staleTime: 5 минут - данные считаются свежими
 * - cacheTime: 10 минут - данные хранятся в памяти
 * - refetchOnWindowFocus: false - не обновлять при фокусе (не нужно в Mini App)
 * - retry: 2 - повторить 2 раза при ошибке
 */
const queryConfig: DefaultOptions = {
  queries: {
    // Время, в течение которого данные считаются "свежими"
    staleTime: 5 * 60 * 1000, // 5 минут
    
    // Время хранения неиспользуемых данных в cache
    gcTime: 10 * 60 * 1000, // 10 минут (было cacheTime в v4)
    
    // Не перезапрашивать данные при фокусе окна
    refetchOnWindowFocus: false,
    
    // Не перезапрашивать при переподключении
    refetchOnReconnect: true,
    
    // Retry policy
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Network mode
    networkMode: 'online', // Работать только online (можно изменить на 'offlineFirst')
  },
  mutations: {
    // Retry для mutations
    retry: 1,
    retryDelay: 1000,
    
    // Network mode для mutations
    networkMode: 'online',
  },
};

/**
 * Query Client instance
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

/**
 * Persister для offline support
 * Сохраняет cache в localStorage
 */
export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'TELEGRAM_FOOD_BOT_CACHE',
  // Фильтр: какие queries сохранять
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

/**
 * Query Keys константы
 * Используются для invalidation и prefetching
 */
export const queryKeys = {
  // Polls
  polls: {
    all: ['polls'] as const,
    active: () => [...queryKeys.polls.all, 'active'] as const,
    detail: (id: number) => [...queryKeys.polls.all, 'detail', id] as const,
    history: () => [...queryKeys.polls.all, 'history'] as const,
    stats: () => [...queryKeys.polls.all, 'stats'] as const,
  },
  
  // Menu
  menu: {
    all: ['menu'] as const,
    items: () => [...queryKeys.menu.all, 'items'] as const,
    item: (id: number) => [...queryKeys.menu.all, 'item', id] as const,
    categories: () => [...queryKeys.menu.all, 'categories'] as const,
  },
  
  // User
  user: {
    all: ['user'] as const,
    profile: (id: number) => [...queryKeys.user.all, 'profile', id] as const,
    votes: (id: number) => [...queryKeys.user.all, 'votes', id] as const,
  },
} as const;

/**
 * Утилиты для работы с cache
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
   * Invalidate (принудительно обновить) все активные polls
   */
  invalidateActivePolls: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.polls.active() });
  },
  
  /**
   * Invalidate menu items
   */
  invalidateMenuItems: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.menu.items() });
  },
  
  /**
   * Prefetch активные polls (для HomePage)
   */
  prefetchActivePolls: async (fetcher: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.polls.active(),
      queryFn: fetcher,
    });
  },
  
  /**
   * Получить данные из cache без запроса
   */
  getCachedPolls: () => {
    return queryClient.getQueryData(queryKeys.polls.active());
  },
  
  getCachedMenuItems: () => {
    return queryClient.getQueryData(queryKeys.menu.items());
  },
};

/**
 * Dev tools helper
 */
export const isDevelopment = import.meta.env.MODE === 'development';

/**
 * Logger для React Query (только в dev)
 */
if (isDevelopment) {
  queryClient.setDefaultOptions({
    queries: {
      ...queryConfig.queries,
      // В dev логируем все queries
      meta: {
        errorMessage: 'Failed to fetch data',
      },
    },
  });
}
