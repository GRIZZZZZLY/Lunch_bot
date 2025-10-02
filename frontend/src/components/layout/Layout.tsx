import React, { useEffect } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';
import { ToastContainer } from '../common/Toast';
import { FullPageLoader } from '../common/LoadingSpinner';

export interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Основной Layout компонент
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { colorScheme, themeParams, isReady } = useTelegram();
  const { isLoading, error, isAuthenticated } = useAuth();
  const { setTheme } = useAppStore((state) => ({
    setTheme: state.setTheme,
  }));

  // Синхронизация темы с Telegram
  useEffect(() => {
    if (isReady) {
      setTheme(colorScheme);
    }
  }, [colorScheme, isReady, setTheme]);

  // Применение CSS переменных темы
  useEffect(() => {
    if (isReady && themeParams) {
      const root = document.documentElement;
      
      // Устанавливаем CSS переменные для цветов Telegram
      root.style.setProperty('--tg-theme-bg-color', themeParams.bg_color || '#ffffff');
      root.style.setProperty('--tg-theme-text-color', themeParams.text_color || '#000000');
      root.style.setProperty('--tg-theme-hint-color', themeParams.hint_color || '#999999');
      root.style.setProperty('--tg-theme-link-color', themeParams.link_color || '#2481cc');
      root.style.setProperty('--tg-theme-button-color', themeParams.button_color || '#2481cc');
      root.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color || '#ffffff');
      root.style.setProperty('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color || '#f1f1f1');
      
      // Устанавливаем класс темы для Tailwind
      if (colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isReady, themeParams, colorScheme]);

  // Показываем загрузку пока не готов WebApp
  if (!isReady) {
    return <FullPageLoader text="Инициализация..." />;
  }

  // Показываем загрузку пока идет аутентификация
  if (isLoading) {
    return <FullPageLoader text="Авторизация..." />;
  }

  // Показываем ошибку если аутентификация не удалась
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Ошибка авторизации
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Попробуйте перезапустить приложение
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-200"
      style={{
        backgroundColor: 'var(--tg-theme-bg-color)',
        color: 'var(--tg-theme-text-color)',
      }}
    >
      {/* Основной контент */}
      <main className="container mx-auto px-4 py-4 max-w-2xl">
        {children}
      </main>

      {/* Toast уведомления */}
      <ToastContainer />
    </div>
  );
};

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

/**
 * Navigation компонент (если потребуется навигация)
 */
export const Navigation: React.FC<{
  currentTab: string;
  onTabChange: (tab: string) => void;
}> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'menu', label: 'Меню', icon: '🍽️' },
    { id: 'polls', label: 'Голосования', icon: '🗳️' },
    { id: 'stats', label: 'Статистика', icon: '📊' },
    { id: 'profile', label: 'Профиль', icon: '👤' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-3 px-2 text-center text-sm font-medium transition-colors ${
                currentTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="text-lg mb-1">{tab.icon}</div>
              <div>{tab.label}</div>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
