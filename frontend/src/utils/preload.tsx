import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Утилиты для предзагрузки lazy компонентов
 */

// Типы для preload функций
type PreloadableComponent<T extends React.ComponentType<any> = React.ComponentType<any>> = React.LazyExoticComponent<T> & {
  preload?: () => Promise<any>;
};

/**
 * Добавляет метод preload к lazy компонентам
 */
export function lazyWithPreload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const Component = React.lazy(factory);
  (Component as PreloadableComponent<T>).preload = factory;
  return Component as PreloadableComponent<T>;
}

/**
 * Хук для prefetch страниц при hover
 */
export function usePrefetch() {
  const prefetch = (
    factory: () => Promise<any>,
    delay: number = 0
  ) => {
    const timer = setTimeout(() => {
      factory();
    }, delay);

    return () => clearTimeout(timer);
  };

  return prefetch;
}

/**
 * Preload компонентов для критических маршрутов
 * Вызывать при инициализации приложения
 */
export const preloadCriticalRoutes = () => {
  // Загружаем самые часто используемые страницы
  const routes = [
    () => import('../pages/MenuPage'),
    () => import('../pages/StatsPage'),
    // VotingPage УДАЛЁН - функционал в InlineVotingCard на главной
  ];

  routes.forEach(route => {
    // Задержка для избежания блокировки загрузки
    setTimeout(() => {
      route();
    }, 1000);
  });
};

/**
 * Компонент Link с prefetch
 */
interface PrefetchLinkProps {
  to: string;
  onPrefetch?: () => Promise<any>;
  children: React.ReactNode;
  className?: string;
}

export const PrefetchLink: React.FC<PrefetchLinkProps> = ({
  to,
  onPrefetch,
  children,
  className,
}) => {
  const navigate = useNavigate();
  const [isPrefetching, setIsPrefetching] = React.useState(false);

  const handleMouseEnter = () => {
    if (onPrefetch && !isPrefetching) {
      setIsPrefetching(true);
      onPrefetch();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <a
      href={to}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={className}
    >
      {children}
    </a>
  );
};


