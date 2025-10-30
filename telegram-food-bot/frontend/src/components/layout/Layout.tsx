import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTelegram } from '../../hooks/useTelegram';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';
import { FullPageLoader } from '../common/LoadingSpinner';
import { DonationBar } from '../donation';

export interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Основной Layout компонент
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { colorScheme, themeParams, isReady } = useTelegram();
  const { isLoading, error, isAuthenticated } = useAuth();
  const { setTheme } = useAppStore((state) => ({
    setTheme: state.setTheme,
  }));

  // Hide DonationBar on voting pages for clean UX
  const isVotingPage = location.pathname.startsWith('/vote') || location.pathname.startsWith('/poll');

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

  // Debug logging (перенесено в useEffect)
  useEffect(() => {
    console.log('[Layout] Render state:', {
      isReady,
      isLoading,
      isAuthenticated,
      error,
      colorScheme,
    });

    if (!isReady) {
      console.log('[Layout] Waiting for Telegram WebApp...');
    } else if (isLoading) {
      console.log('[Layout] Authenticating...');
    }
  }, [isReady, isLoading, isAuthenticated, error, colorScheme]);

  // Показываем загрузку пока не готов WebApp
  if (!isReady) {
    return <FullPageLoader />;
  }

  // Показываем загрузку пока идет аутентификация
  if (isLoading) {
    return <FullPageLoader />;
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
      className="min-h-screen transition-colors duration-200 relative"
    >
      {/* Основной контент */}
      <main 
        className="container mx-auto px-4 pt-4 pb-32 max-w-2xl relative z-0 min-h-screen"
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </main>

      {/* Donation bar - скрыт на страницах голосования для чистого UX */}
      {!isVotingPage && <DonationBar />}
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
 * Navigation компонент с glassmorphism эффектом
 */
export const Navigation: React.FC<{
  currentTab: string;
  onTabChange: (tab: string) => void;
}> = ({ currentTab, onTabChange }) => {
  const { colorScheme } = useTelegram();
  const isDark = colorScheme === 'dark';
  
  const tabs = [
    { 
      id: 'home', 
      label: 'Главная', 
      icon: (active: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      )
    },
    { 
      id: 'menu', 
      label: 'Меню', 
      icon: (active: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>
      )
    },
    { 
      id: 'stats', 
      label: 'Статистика', 
      icon: (active: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" x2="12" y1="20" y2="10"/>
          <line x1="18" x2="18" y1="20" y2="4"/>
          <line x1="6" x2="6" y1="20" y2="16"/>
        </svg>
      )
    },
    { 
      id: 'profile', 
      label: 'Профиль', 
      icon: (active: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      )
    },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        backdropFilter: 'blur(20px) saturate(180%)',
        background: isDark 
          ? 'rgba(23, 33, 43, 0.8)' 
          : 'rgba(255, 255, 255, 0.8)',
        borderTop: isDark
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: isDark
          ? '0 -4px 16px rgba(0, 0, 0, 0.3)'
          : '0 -4px 16px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="container mx-auto px-2 max-w-2xl">
        <div className="flex">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                onTapStart={() => {
                  // Telegram Haptic Feedback для native mobile ощущения
                  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
                    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                  }
                }}
                onPointerEnter={() => {
                  // Prefetch страницы при hover для быстрого перехода
                  if (!isActive) {
                    switch (tab.id) {
                      case 'home':
                        import('../../pages/HomePage');
                        break;
                      case 'menu':
                        import('../../pages/MenuPage');
                        break;
                      case 'stats':
                        import('../../pages/StatsPage');
                        break;
                      case 'profile':
                        import('../../pages/ProfilePage');
                        break;
                    }
                  }
                }}
                className="relative flex-1 py-3 px-2 flex flex-col items-center justify-center"
              >
                {/* Иконка с subtle scale и fade */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.15 : 1,
                    opacity: isActive ? 1 : 0.6
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    mass: 0.5
                  }}
                  className={`mb-1 ${
                    isActive
                      ? 'text-primary-food-600 dark:text-primary-food-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {tab.icon(isActive)}
                </motion.div>

                {/* Label с fade эффектом */}
                <motion.span
                  animate={{ 
                    opacity: isActive ? 1 : 0.7,
                    fontWeight: isActive ? 500 : 400
                  }}
                  transition={{ duration: 0.2 }}
                  className={`text-xs truncate max-w-full ${
                    isActive
                      ? 'text-primary-food-700 dark:text-primary-food-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {tab.label}
                </motion.span>

                {/* Тонкий индикатор снизу с fade-in/out */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className="absolute bottom-0 left-1/2 h-0.5 bg-primary-food-600 dark:bg-primary-food-400 rounded-full"
                      initial={{ width: 0, opacity: 0, x: '-50%' }}
                      animate={{ width: 32, opacity: 1, x: '-50%' }}
                      exit={{ width: 0, opacity: 0, x: '-50%' }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
