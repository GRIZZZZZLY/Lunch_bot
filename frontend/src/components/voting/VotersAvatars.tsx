import React from 'react';
import { m } from 'framer-motion';
import { Users } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';

const offsetClasses = {
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};


interface Voter {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  telegramId: bigint;
}

interface VotersAvatarsProps {
  voters?: Voter[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Компонент для отображения аватаров проголосовавших пользователей (Social Proof)
 * Использует UserAvatar для автоматической загрузки аватаров из Telegram API
 */
export const VotersAvatars: React.FC<VotersAvatarsProps> = ({
  voters = [],
  maxDisplay = 3,
  size = 'md',
}) => {
  if (!voters || voters.length === 0) return null;

  const displayedVoters = voters.slice(0, maxDisplay);
  const remainingCount = Math.max(0, voters.length - maxDisplay);

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        {displayedVoters.map((voter, index) => {
          return (
            <m.div
              key={voter.id}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={index > 0 ? offsetClasses[size] : ''}
            >
              <UserAvatar
                userId={voter.id}
                firstName={voter.firstName}
                lastName={voter.lastName}
                size={size}
                className="border-2 border-white dark:border-gray-800 shadow-md hover:z-10 hover:scale-110 transition-transform cursor-default"
              />
            </m.div>
          );
        })}

        {/* Показываем "+N" если есть еще пользователи */}
        {remainingCount > 0 && (
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: displayedVoters.length * 0.05, duration: 0.2 }}
            className={`
              ${sizeClasses[size]}
              ${offsetClasses[size]}
              relative rounded-full border-2 border-white dark:border-gray-800
              flex items-center justify-center
              font-semibold text-gray-700 dark:text-gray-300
              bg-gray-200 dark:bg-gray-700
              shadow-md
              cursor-default
            `}
            title={`+${remainingCount} еще`}
          >
            <span className="text-[10px]">+{remainingCount}</span>
          </m.div>
        )}
      </div>


    </div>
  );
};

/**
 * Компактная версия - только счётчик с иконкой
 */
export const VotersCount: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400"
    >
      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <Users size={14} className="text-blue-500" />
      </div>
      <span className="font-medium">{count}</span>
    </m.div>
  );
};
