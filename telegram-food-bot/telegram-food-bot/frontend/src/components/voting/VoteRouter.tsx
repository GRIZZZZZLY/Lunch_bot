import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { pollsService } from '../../services/polls.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { logger } from '../../utils/logger';

// SessionStorage кэш для активных голосований
const CACHE_KEY = 'active-polls-cache';
const CACHE_TTL = 10000; // 10 секунд

interface CachedPolls {
  data: any[];
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
export const VoteRouter: React.FC = () => {
  console.log('🚀 [VoteRouter] Component mounted!');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  console.log('[VoteRouter] Render state:', { 
    hasUser: !!user, 
    userId: user?.id,
    checking 
  });

  useEffect(() => {
    console.log('[VoteRouter] useEffect triggered, user:', user);
    checkActivePolls();
  }, [user]);

  const checkActivePolls = async () => {
    try {
      setChecking(true);
      
      if (!user) {
        console.log('[VoteRouter] No user found, redirecting to hub');
        navigate('/vote/hub', { replace: true });
        return;
      }
      
      console.log('[VoteRouter] Checking active polls for user:', user.id);
      
      // ВСЕГДА очищаем кэш для свежих данных
      sessionStorage.removeItem(CACHE_KEY);
      console.log('[VoteRouter] Cache cleared, fetching fresh data');
      
      // Кэш невалиден или отсутствует - запрашиваем API
      console.log('[VoteRouter] Fetching fresh data from API');
      const response = await pollsService.getActivePolls();
      
      console.log('[VoteRouter] API Response:', {
        success: response.success,
        hasData: !!response.data,
        dataLength: response.data?.length || 0,
        data: response.data,
        error: response.error,
        code: response.code
      });
      
      // Детальный лог данных
      if (response.data && response.data.length > 0) {
        console.log('[VoteRouter] First poll details:', JSON.stringify(response.data[0], null, 2));
      } else {
        console.warn('[VoteRouter] ⚠️ No polls in response data!', {
          isArray: Array.isArray(response.data),
          dataType: typeof response.data,
          dataValue: response.data
        });
      }
      
      if (response.success && response.data) {
        if (response.data.length > 0) {
          const firstPoll = response.data[0];
          
          console.log('[VoteRouter] Found active poll:', {
            pollId: firstPoll.id,
            groupId: firstPoll.groupId,
            status: firstPoll.status,
            startedAt: firstPoll.startedAt,
            endedAt: firstPoll.endedAt,
            duration: firstPoll.duration,
            totalFound: response.data.length
          });
          
          navigate(`/vote/${firstPoll.id}`, { replace: true });
        } else {
          console.log('[VoteRouter] No active polls found (empty array), redirecting to hub');
          navigate('/vote/hub', { replace: true });
        }
      } else {
        console.warn('[VoteRouter] API response not successful:', {
          error: response.error,
          code: response.code
        });
        navigate('/vote/hub', { replace: true });
      }
      
    } catch (error) {
      console.error('[VoteRouter] Error checking active polls:', error);
      logger.error('[VoteRouter] Failed to check active polls', error);
      
      // В случае ошибки перенаправляем на hub
      navigate('/vote/hub', { replace: true });
    } finally {
      setChecking(false);
    }
  };

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
