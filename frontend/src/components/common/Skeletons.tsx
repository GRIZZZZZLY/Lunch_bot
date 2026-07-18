import { Skeleton } from '../ui/skeleton';

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
