/**
 * React Query hooks для User Avatar API
 *
 * Кеширование аватарок с localStorage и API
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { userService, type UserAvatar } from '@/services/user.service';

/**
 * Локальный кеш аватарок в localStorage
 * Срок хранения: 24 часа
 * Лимит записей: 200
 */
// v2 — бэк теперь возвращает подписанный URL `/api/avatar/<fileId>?exp=&sig=`
// вместо `tg://avatar/<fileId>`. Bump ключа = старый кеш с unsigned URL'ами
// (которые получили бы 401 от avatarAccessMiddleware) тихо игнорируется.
const AVATAR_CACHE_KEY = 'user_avatars_cache_v2';
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
      const entry = entries[i];
      if (!entry) continue;
      delete cache[entry.key];
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
  } catch {
    // Ignore invalid localStorage cache.
  }

  if (pruneAvatarCache(avatarCacheMemory)) {
    persistAvatarCache(avatarCacheMemory);
  }

  return avatarCacheMemory;
};

const persistAvatarCache = (cache: AvatarCache): void => {
  try {
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore unavailable localStorage.
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
        return {
          userId: userId!,
          telegramId: '', // Не важно для фронтенда
          avatarUrl: cached,
        };
      }

      // 2. Кеш не найден → загружаем через API
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
