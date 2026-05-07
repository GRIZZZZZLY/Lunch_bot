import React from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { useAuth } from '../../hooks/useAuth';

/**
 * Header компонент с информацией о пользователе
 */
export const Header: React.FC = () => {
  const { user } = useAuth();
  const { user: tgUser } = useTelegram();

  if (!user && !tgUser) return null;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-4">
      <div className="container mx-auto px-4 py-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {(user?.firstName || tgUser?.first_name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white">
                {user?.firstName || tgUser?.first_name || 'Пользователь'}
              </h1>
              {(user?.username || tgUser?.username) && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{user?.username || tgUser?.username}
                </p>
              )}
            </div>
          </div>

          {user?.isAdmin && (
            <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
              <span>👑</span>
              <span>Админ</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
