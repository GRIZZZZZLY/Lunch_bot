import React from 'react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

/**
 * Skeleton для карточки голосования
 */
export const VotingCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border-l-4 border-gray-300 dark:border-gray-600 border-t border-r border-b border-gray-200 dark:border-gray-700">
    {/* Header */}
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-2">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
    
    {/* Stats */}
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="h-10 w-28 rounded-lg" />
      <div className="flex -space-x-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800" />
        ))}
      </div>
    </div>
    
    {/* Menu items */}
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

/**
 * Skeleton для карточки блюда в меню
 */
export const MenuItemSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center gap-3">
      <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2 mb-2" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  </div>
);

/**
 * Skeleton для списка блюд меню
 */
export const MenuListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <MenuItemSkeleton key={i} />
    ))}
  </div>
);

/**
 * Skeleton для карточки статистики
 */
export const StatsCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-gray-300 dark:border-gray-600 border-t border-r border-b border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="w-8 h-8 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-16 mb-1" />
    <Skeleton className="h-3 w-20" />
  </div>
);

/**
 * Skeleton для секции статистики
 */
export const StatsGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 gap-3">
    {[...Array(count)].map((_, i) => (
      <StatsCardSkeleton key={i} />
    ))}
  </div>
);

/**
 * Skeleton для профиля пользователя
 */
export const ProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Avatar & Name */}
    <div className="flex flex-col items-center gap-3">
      <Skeleton className="w-24 h-24 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-32" />
    </div>
    
    {/* Stats cards */}
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
    
    {/* Form */}
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  </div>
);

/**
 * Skeleton для главной страницы
 */
export const HomePageSkeleton: React.FC = () => (
  <div className="space-y-6 p-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="w-12 h-12 rounded-full" />
    </div>
    
    {/* Quick actions */}
    <div className="flex gap-2 overflow-hidden">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-full flex-shrink-0" />
      ))}
    </div>
    
    {/* Voting card */}
    <VotingCardSkeleton />
  </div>
);

/**
 * Skeleton для истории голосований
 */
export const PollHistorySkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-3">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-3 w-24" />
      </div>
    ))}
  </div>
);

export default {
  VotingCardSkeleton,
  MenuItemSkeleton,
  MenuListSkeleton,
  StatsCardSkeleton,
  StatsGridSkeleton,
  ProfileSkeleton,
  HomePageSkeleton,
  PollHistorySkeleton,
};
