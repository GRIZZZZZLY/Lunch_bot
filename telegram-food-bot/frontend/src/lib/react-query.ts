import { QueryClient, DefaultOptions } from '@tanstack/react-query';

/**
 * Конфигурация React Query
 */
const queryConfig: DefaultOptions = {
  queries: {
    // Время кэширования (5 минут)
    staleTime: 1000 * 60 * 5,
    // Время хранения в кэше (10 минут)
    gcTime: 1000 * 60 * 10,
    // Повторные запросы при ошибках
    retry: 1,
    // Рефетч при фокусе окна
    refetchOnWindowFocus: true,
    // Рефетч при восстановлении соединения
    refetchOnReconnect: true,
    // Не рефетчить при монтировании если данные fresh
    refetchOnMount: false,
  },
  mutations: {
    // Повторные попытки при ошибках мутаций
    retry: 0,
  },
};

/**
 * Создание Query Client
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
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
