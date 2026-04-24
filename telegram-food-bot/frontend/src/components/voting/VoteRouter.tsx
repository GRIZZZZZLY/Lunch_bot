import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { pollsService, Poll } from '../../services/polls.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { logger } from '../../utils/logger';

// SessionStorage кэш для активных голосований
const CACHE_KEY = 'active-polls-cache';
const CACHE_TTL = 10000; // 10 секунд

interface CachedPolls {
  data: Poll[];
  timestamp: number;
}

/**
 * VoteRouter - Умный роутер с кэшированием
 * 
 * Оптимизации:
 * - SessionStorage кэш (10 секунд TTL)
 * - Избегает двойной загрузки при быстром переходе
 * - Поддерживает prefetch из BottomNavigation
 * 
 * Логика:
 * 1. Проверяет кэш
 * 2. Если кэш валиден → мгновенный редирект
 * 3. Иначе → запрос к API + сохранение в кэш
 */
export const VoteRouter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  const checkActivePolls = useCallback(async () => {
    try {
      setChecking(true);
      
      if (!user) {
        console.log('[VoteRouter] No user found, redirecting to home');
        navigate('/', { replace: true });
        return;
      }
      
      console.log('[VoteRouter] Checking active polls for user:', user.id);
      
      // Проверяем кэш
      const cachedData = sessionStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const cached: CachedPolls = JSON.parse(cachedData);
          const age = Date.now() - cached.timestamp;
          
          if (age < CACHE_TTL) {
            console.log('[VoteRouter] Using cached data (age:', age, 'ms)');
            
            if (cached.data && cached.data.length > 0) {
              navigate(`/vote/${cached.data[0].id}`, { replace: true });
              return;
            } else {
              navigate('/', { replace: true });
              return;
            }
          } else {
            console.log('[VoteRouter] Cache expired (age:', age, 'ms)');
          }
        } catch (e) {
          console.warn('[VoteRouter] Failed to parse cache:', e);
        }
      }
      
      // Кэш невалиден или отсутствует - запрашиваем API
      console.log('[VoteRouter] Fetching fresh data from API');
      const response = await pollsService.getActivePolls();
      
      if (response.success && response.data) {
        // Сохраняем в кэш
        const cacheData: CachedPolls = {
          data: response.data,
          timestamp: Date.now()
        };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        
        if (response.data.length > 0) {
          const firstPoll = response.data[0];
          
          console.log('[VoteRouter] Found active poll:', {
            pollId: firstPoll.id,
            groupId: firstPoll.groupId,
            status: firstPoll.status,
            totalFound: response.data.length
          });
          
          navigate(`/vote/${firstPoll.id}`, { replace: true });
        } else {
          console.log('[VoteRouter] No active polls found, redirecting to home');
          navigate('/', { replace: true });
        }
      } else {
        console.warn('[VoteRouter] API response not successful');
        navigate('/', { replace: true });
      }
      
    } catch (error) {
      console.error('[VoteRouter] Error checking active polls:', error);
      logger.error('[VoteRouter] Failed to check active polls', error);
      
      // В случае ошибки перенаправляем на главную
      navigate('/', { replace: true });
    } finally {
      setChecking(false);
    }
  }, [navigate, user]);

  useEffect(() => {
    checkActivePolls();
  }, [checkActivePolls]);

  // Показываем loader пока проверяем
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Загрузка голосований...
          </p>
        </div>
      </div>
    );
  }

  // Этот компонент всегда редиректит, поэтому не показываем ничего
  return null;
};
