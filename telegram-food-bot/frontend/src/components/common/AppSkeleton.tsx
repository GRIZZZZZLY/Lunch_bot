import React from 'react';
import { Skeleton } from '../ui/skeleton';

/**
 * Unified skeleton для всех loading состояний приложения
 * 
 * Используется:
 * - В Layout.tsx при инициализации WebApp и аутентификации
 * - В App.tsx как Suspense fallback при lazy loading страниц
 * 
 * Показывает структуру HomePage для consistency
 */
export const AppSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background - нейтральный фон без градиентов */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-gray-200/80 dark:bg-gray-700/80" />
          <Skeleton className="h-4 w-32 bg-gray-200/60 dark:bg-gray-700/60" />
        </div>

        {/* Hero card skeleton (main poll/content area) */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3 bg-gray-200/80 dark:bg-gray-700/80" />
            <Skeleton className="h-4 w-full bg-gray-200/60 dark:bg-gray-700/60" />
            <Skeleton className="h-4 w-3/4 bg-gray-200/60 dark:bg-gray-700/60" />
            
            <div className="pt-4">
              <Skeleton className="h-12 w-full bg-gray-200/80 dark:bg-gray-700/80 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Quick actions skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full bg-white/60 dark:bg-gray-800/60 rounded-xl" />
          <Skeleton className="h-24 w-full bg-white/60 dark:bg-gray-800/60 rounded-xl" />
        </div>

        {/* Budget widget skeleton (smaller card) */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40 bg-gray-200/80 dark:bg-gray-700/80" />
            <Skeleton className="h-4 w-full bg-gray-200/60 dark:bg-gray-700/60" />
            <Skeleton className="h-4 w-2/3 bg-gray-200/60 dark:bg-gray-700/60" />
          </div>
        </div>
      </div>

      {/* Bottom navigation placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-around h-full px-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton 
              key={item} 
              className="h-10 w-10 rounded-full bg-gray-200/60 dark:bg-gray-700/60" 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Минимальная версия skeleton для быстрых переходов между страницами
 * Используется когда уже есть Layout, но загружается новый контент
 */
export const MinimalAppSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Secondary content */}
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
};
