import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Loader для lazy-loaded страниц
 */
export const PageLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-telegram-bg-color">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-telegram-hint-color text-sm animate-pulse">
          Загрузка...
        </p>
      </div>
    </div>
  );
};

/**
 * Минимальный loader для быстрых переходов
 */
export const MinimalPageLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <LoadingSpinner size="md" />
    </div>
  );
};

/**
 * Skeleton loader для страниц
 */
export const PageSkeleton: React.FC<{ type?: 'list' | 'detail' | 'form' }> = ({ 
  type = 'list' 
}) => {
  if (type === 'list') {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className="p-4 space-y-6 animate-pulse">
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
        </div>
      ))}
    </div>
  );
};
