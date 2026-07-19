import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTelegram } from '../../hooks/useTelegram';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store/useAppStore';
import { AppSkeleton } from '../common/AppSkeleton';
import { DonationBar } from '../donation/DonationBar';

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
  const setTheme = useAppStore((state) => state.setTheme);

  // Hide DonationBar on voting/results pages for clean UX
  // ИЗМЕНЕНО: VotingPage удалена, голосование теперь на главной (?pollId=X)
  // Скрываем DonationBar только на страницах результатов
  const isVotingPage = location.pathname.includes('/results');

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

  // Показываем unified skeleton пока не готов WebApp
  if (!isReady) {
    return <AppSkeleton />;
  }

  // Показываем unified skeleton пока идет аутентификация
  if (isLoading) {
    return <AppSkeleton />;
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
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
            Попробуй перезапустить приложение
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-background transition-colors duration-200 relative"
    >
      {/* Основной контент */}
      <main
        className="container mx-auto px-4 pt-4 max-w-2xl relative z-0 min-h-screen"
        style={{
          overscrollBehavior: 'contain',
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        {children}
      </main>

      {/* Donation bar - скрыт на страницах голосования для чистого UX */}
      {!isVotingPage && <DonationBar />}
    </div>
  );
};

/**
 * Navigation компонент с glassmorphism эффектом
 */
