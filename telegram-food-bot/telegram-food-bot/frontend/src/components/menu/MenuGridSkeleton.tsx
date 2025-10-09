import React from 'react';
import { motion } from 'framer-motion';

interface MenuGridSkeletonProps {
  count?: number;
}

/**
 * Skeleton loading для grid карточек меню
 */
export function MenuGridSkeleton({ count = 8 }: MenuGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} index={index} />
      ))}
    </div>
  );
}

/**
 * Одна skeleton карточка
 */
function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-card rounded-xl overflow-hidden border border-border shadow-sm"
    >
      {/* Skeleton Image - Square */}
      <div className="relative aspect-square w-full bg-muted animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/50 to-muted" />
      </div>

      {/* Skeleton Content */}
      <div className="p-3 space-y-2">
        {/* Title skeleton */}
        <div className="h-5 bg-muted rounded animate-pulse w-3/4" />

        {/* Description skeleton - 2 lines */}
        <div className="space-y-1.5">
          <div className="h-4 bg-muted rounded animate-pulse w-full" />
          <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
        </div>

        {/* Actions skeleton */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-border">
          <div className="flex-1 h-11 bg-muted rounded-lg animate-pulse" />
          <div className="flex-1 h-11 bg-muted rounded-lg animate-pulse" />
          <div className="flex-1 h-11 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Skeleton для filter chips
 */
export function FilterChipsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden pb-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex-shrink-0 h-9 w-24 bg-muted rounded-full animate-pulse"
        />
      ))}
    </div>
  );
}
