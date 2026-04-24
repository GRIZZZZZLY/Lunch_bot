/**
 * React Query hooks для User Avatar API
 *
 * Кеширование аватарок с localStorage и API
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { userService, type UserAvatar } from '@/services/user.service';

/**
 * Локальный кеш аватарок в localStorage
 * Срок хранения: 24 часа
 * Лимит записей: 200
 */
const AVATAR_CACHE_KEY = 'user_avatars_cache';
const AVATAR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

const parseAvatarCacheLimit = (): number => {
  const rawLimit = import.meta.env.VITE_AVATAR_CACHE_LIMIT;
  const parsed = Number(rawLimit);

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return 200;
};

const MAX_AVATAR_CACHE_ENTRIES = parseAvatarCacheLimit();

interface CachedAvatar {
  avatarUrl: string | null;
  timestamp: number;
}

type AvatarCache = Record<string, CachedAvatar>;

const avatarCacheMemory: AvatarCache = {};
let avatarCacheLoaded = false;

const pruneAvatarCache = (cache: AvatarCache, now = Date.now()): boolean => {
  let changed = false;

  Object.keys(cache).forEach((key) => {
    const cached = cache[key];
    if (!cached || now - cached.timestamp > AVATAR_CACHE_TTL) {
      delete cache[key];
      changed = true;
    }
  });

  const keys = Object.keys(cache);
  if (keys.length > MAX_AVATAR_CACHE_ENTRIES) {
    const entries = keys
      .map((key) => ({ key, timestamp: cache[key]?.timestamp ?? 0 }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const excess = entries.length - MAX_AVATAR_CACHE_ENTRIES;
    for (let i = 0; i < excess; i += 1) {
      delete cache[entries[i].key];
      changed = true;
    }
  }

  return changed;
};

const ensureAvatarCache = (): AvatarCache => {
  if (avatarCacheLoaded) {
    return avatarCacheMemory;
  }

  avatarCacheLoaded = true;

  try {
    const cache = localStorage.getItem(AVATAR_CACHE_KEY);
    if (!cache) return avatarCacheMemory;

    const parsed: AvatarCache = JSON.parse(cache);
    Object.assign(avatarCacheMemory, parsed);
  } catch (error) {
    console.error('[useUserAvatar] Error reading from localStorage:', error);
  }

  if (pruneAvatarCache(avatarCacheMemory)) {
    persistAvatarCache(avatarCacheMemory);
  }

  return avatarCacheMemory;
};

const persistAvatarCache = (cache: AvatarCache): void => {
  try {
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('[useUserAvatar] Error writing to localStorage:', error);
  }
};

/**
 * Получить аватарку из localStorage кеша
 */
function getCachedAvatar(userId: number): string | null {
  const avatarCache = ensureAvatarCache();
  const cached = avatarCache[userId.toString()];

  if (!cached) return null;

  // Проверяем срок действия кеша
  const now = Date.now();
  if (now - cached.timestamp > AVATAR_CACHE_TTL) {
    delete avatarCache[userId.toString()];
    persistAvatarCache(avatarCache);
    return null;
  }

  return cached.avatarUrl;
}

/**
 * Сохранить аватарку в localStorage кеш
 */
function setCachedAvatar(userId: number, avatarUrl: string | null): void {
  const avatarCache = ensureAvatarCache();

  avatarCache[userId.toString()] = {
    avatarUrl,
    timestamp: Date.now(),
  };

  if (pruneAvatarCache(avatarCache)) {
    persistAvatarCache(avatarCache);
    return;
  }

  persistAvatarCache(avatarCache);
}

/**
 * Hook для получения аватарки пользователя
 *
 * Использует трехуровневое кеширование:
 * 1. React Query cache (in-memory)
 * 2. localStorage cache (24 часа)
 * 3. API запрос к бэкенду (который использует DB cache)
 *
 * @param userId - ID пользователя
 * @param options - опции query
 * @returns { avatarUrl, isLoading, error }
 *
 * @example
 * ```tsx
 * const { avatarUrl, isLoading } = useUserAvatar(123);
 *
 * if (isLoading) return <Skeleton />;
 * return <img src={avatarUrl || '/default-avatar.png'} />;
 * ```
 */
export function useUserAvatar(
  userId: number | undefined,
  options?: {
    enabled?: boolean;
  }
) {
  const query = useQuery({
    queryKey: queryKeys.user.avatar(userId!),
    queryFn: async (): Promise<UserAvatar> => {
      // 1. Сначала пытаемся получить из localStorage
      const cached = getCachedAvatar(userId!);
      if (cached !== null) {
        if (import.meta.env.DEV) {
          console.log(`[useUserAvatar] Cache hit for user ${userId}`);
        }
        return {
          userId: userId!,
          telegramId: '', // Не важно для фронтенда
          avatarUrl: cached,
        };
      }

      // 2. Кеш не найден → загружаем через API
      if (import.meta.env.DEV) {
        console.log(`[useUserAvatar] Cache miss for user ${userId}, fetching from API`);
      }

      const response = await userService.getUserAvatar(userId!);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch user avatar');
      }

      if (!response.data) {
        throw new Error('No avatar data received');
      }

      // 3. Сохраняем в localStorage кеш
      setCachedAvatar(userId!, response.data.avatarUrl);

      return response.data;
    },
    enabled: options?.enabled ?? !!userId,
    staleTime: AVATAR_CACHE_TTL, // 24 часа
    gcTime: AVATAR_CACHE_TTL, // 24 часа (ранее cacheTime)
    retry: 1, // Повторяем только 1 раз при ошибке
  });

  return {
    avatarUrl: query.data?.avatarUrl ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook для batch-загрузки аватарок нескольких пользователей
 *
 * Эффективно загружает аватарки для списка пользователей.
 * Использует API batch endpoint для минимизации запросов.
 *
 * @param userIds - Массив ID пользователей
 * @param options - опции query
 * @returns { avatars, isLoading, error }
 *
 * @example
 * ```tsx
 * const voterIds = [1, 2, 3, 4, 5];
 * const { avatars, isLoading } = useUserAvatarsBatch(voterIds);
 *
 * // avatars - это Map<userId, avatarUrl | null>
 * const avatarUrl = avatars.get(userId);
 * ```
 */
export function useUserAvatarsBatch(
  userIds: number[],
  options?: {
    enabled?: boolean;
  }
) {
  const query = useQuery({
    queryKey: queryKeys.user.avatarsBatch(userIds),
    queryFn: async (): Promise<UserAvatar[]> => {
      if (!userIds.length) {
        return [];
      }

      // Проверяем кеш для каждого пользователя
      const cachedResults: UserAvatar[] = [];
      const uncachedUserIds: number[] = [];

      for (const userId of userIds) {
        const cached = getCachedAvatar(userId);
        if (cached !== null) {
          cachedResults.push({
            userId,
            telegramId: '',
            avatarUrl: cached,
          });
        } else {
          uncachedUserIds.push(userId);
        }
      }

      if (import.meta.env.DEV) {
        console.log(
          `[useUserAvatarsBatch] Cache: ${cachedResults.length}/${userIds.length}, fetching ${uncachedUserIds.length} from API`
        );
      }

      // Если все в кеше → возвращаем
      if (uncachedUserIds.length === 0) {
        return cachedResults;
      }

      // Загружаем недостающие через batch API
      const response = await userService.getUserAvatarsBatch(uncachedUserIds);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch user avatars');
      }

      // Кешируем новые результаты
      for (const avatar of response.data) {
        setCachedAvatar(avatar.userId, avatar.avatarUrl);
      }

      // Объединяем кешированные и новые результаты
      return [...cachedResults, ...response.data];
    },
    enabled: options?.enabled ?? userIds.length > 0,
    staleTime: AVATAR_CACHE_TTL, // 24 часа
    gcTime: AVATAR_CACHE_TTL, // 24 часа
    retry: 1,
  });

  // Преобразуем массив в Map для удобного доступа
  const avatarsMap = useMemo(() => {
    const map = new Map<number, string | null>();
    if (query.data) {
      for (const avatar of query.data) {
        map.set(avatar.userId, avatar.avatarUrl);
      }
    }
    return map;
  }, [query.data]);

  return {
    avatars: avatarsMap,
    avatarsArray: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Очистить кеш аватарок в localStorage
 * Полезно при логауте или для принудительного обновления
 */
export function clearAvatarCache(): void {
  try {
    localStorage.removeItem(AVATAR_CACHE_KEY);
    if (import.meta.env.DEV) {
      console.log('[useUserAvatar] Avatar cache cleared');
    }
  } catch (error) {
    console.error('[useUserAvatar] Error clearing cache:', error);
  }
}
