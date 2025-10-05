import React from 'react';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface LiveVoteCounterProps {
  voteCount: number;
  totalUsers?: number;
  className?: string;
}

export const LiveVoteCounter: React.FC<LiveVoteCounterProps> = ({
  voteCount,
  totalUsers,
  className,
}) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30',
        className
      )}
    >
      <Users size={14} className="text-green-700 dark:text-green-400" />
      <span className="text-xs font-medium text-green-700 dark:text-green-400">
        {voteCount} {totalUsers ? `/ ${totalUsers}` : ''} голосов
      </span>
    </motion.div>
  );
};
