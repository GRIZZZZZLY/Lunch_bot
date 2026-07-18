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
    staleTime: 30 * 1000, // 30 секунд (было 5 минут - слишком долго!)
    
    // Время хранения неиспользуемых данных в cache
    gcTime: 5 * 60 * 1000, // 5 минут (было 10 минут)
    
    // Перезапрашивать данные при фокусе окна
    refetchOnWindowFocus: true, // Было false - включаем для актуальности!
    
    // Перезапрашивать при переподключении
    refetchOnReconnect: true,
    
    // Retry policy
    retry: 1, // Было 2 - уменьшаем для быстрого фейла
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 10000), // Быстрее retry
    
    // Network mode
    networkMode: 'online',
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
 * P0-1: централизованные staleTime для разных типов данных. Импортируется
 * в useQuery({ staleTime: STALE_TIMES.X }). Без этого хуки делают свои
 * "30 секунд" → шторм запросов на горячих экранах.
 *
 * Подбор:
 * - REALTIME (5s) — активные polls (используется с refetchInterval: 5000).
 * - VOTES (4.5s) — голосование real-time, чуть меньше интервала refetch.
 * - BUDGET (10s) — долги/кредиты обновляются при mutate, не часто сами.
 * - MENU (5 мин) — меню редко меняется, инвалидируется явно админкой.
 * - PROFILE/STATIC (15 мин) — профиль, аватары; меняются ОЧЕНЬ редко.
 */

/**
 * Query Keys константы
 * Используются для invalidation и prefetching
 *
 * IMPORTANT: Simplified structure to prevent initialization errors
 * - No methods that reference the object itself
 * - All keys defined as simple arrays or factory functions
 * - No spread operators with 'as const'
 */
export const queryKeys = {
  // Polls - simple structure
  polls: {
    all: ['polls'],
    active: () => ['polls', 'active'],
    todayCompleted: (groupId: number) => ['polls', 'today-completed', groupId],
    detail: (id: number) => ['polls', 'detail', id],
    history: () => ['polls', 'history'],
    stats: () => ['polls', 'stats'],
  },

  // Menu - simple structure
  menu: {
    all: ['menu'],
    items: () => ['menu', 'items'],
    item: (id: number) => ['menu', 'item', id],
    categories: () => ['menu', 'categories'],
  },

  // User - simple structure, NO ALIAS
  user: {
    all: ['user'],
    profile: (id: number) => ['user', 'profile', id],
    paymentInfo: (id: number) => ['user', 'payment', id],
    votes: (id: number) => ['user', 'votes', id],
    avatar: (id: number) => ['user', 'avatar', id],
    avatarsBatch: (ids: number[]) => ['user', 'avatars-batch', ids.sort().join(',')],
  },
};

/**
 * Утилиты для работы с cache
 */

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
