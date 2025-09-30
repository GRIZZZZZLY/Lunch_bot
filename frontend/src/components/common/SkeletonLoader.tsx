import React from 'react';

export interface SkeletonLoaderProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: 'text' | 'rectangular' | 'circular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Универсальный Skeleton Loader компонент с разными вариантами анимаций
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  variant = 'text',
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gradient-to-r from-telegram-secondary-bg-color via-telegram-secondary-bg-color/50 to-telegram-secondary-bg-color';
  
  const variantClasses = {
    text: 'rounded',
    rectangular: '',
    circular: 'rounded-full',
    rounded: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-skeleton-wave',
    none: ''
  };

  const style = {
    width,
    height
  };

  return (
    <div 
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={style}
    />
  );
};

/**
 * Skeleton для карточки блюда
 */
export const MenuItemSkeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ 
  className = '', 
  style 
}) => {
  return (
    <div 
      className={`bg-telegram-secondary-bg-color rounded-xl p-4 space-y-4 ${className}`}
      style={style}
    >
      {/* Изображение */}
      <SkeletonLoader
        variant="rounded"
        width="100%"
        height="12rem"
        animation="wave"
      />
      
      {/* Заголовок и цена */}
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <SkeletonLoader width="60%" height="1.5rem" />
          <SkeletonLoader width="20%" height="1.5rem" />
        </div>
        
        {/* Описание */}
        <div className="space-y-2">
          <SkeletonLoader width="100%" height="1rem" />
          <SkeletonLoader width="75%" height="1rem" />
        </div>
        
        {/* Категория и кнопки */}
        <div className="flex justify-between items-center">
          <SkeletonLoader width="25%" height="1.25rem" variant="rounded" />
          <div className="flex space-x-2">
            <SkeletonLoader width="2.5rem" height="2.5rem" variant="circular" />
            <SkeletonLoader width="2.5rem" height="2.5rem" variant="circular" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton для списка блюд
 */
export const MenuListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <MenuItemSkeleton 
          key={index}
          className="animate-pulse"
          style={{ animationDelay: `${index * 100}ms` }}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton для статистических карточек
 */
export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-telegram-secondary-bg-color rounded-xl p-4 space-y-3">
      <SkeletonLoader width="3rem" height="2rem" />
      <SkeletonLoader width="70%" height="1rem" />
    </div>
  );
};

/**
 * Skeleton для поиска и фильтров
 */
export const SearchFilterSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Поиск */}
      <SkeletonLoader height="3rem" variant="rounded" animation="wave" />
      
      {/* Фильтры */}
      <div className="flex space-x-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex-shrink-0"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <SkeletonLoader
              width={`${60 + Math.random() * 40}px`}
              height="2.5rem"
              variant="rounded"
              animation="pulse"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
