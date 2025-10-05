import React from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

interface Voter {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  telegramId: bigint;
}

interface VotersAvatarsProps {
  voters: Voter[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Компонент для отображения аватаров проголосовавших пользователей (Social Proof)
 */
export const VotersAvatars: React.FC<VotersAvatarsProps> = ({
  voters,
  maxDisplay = 3,
  size = 'md',
}) => {
  if (voters.length === 0) return null;

  const displayedVoters = voters.slice(0, maxDisplay);
  const remainingCount = Math.max(0, voters.length - maxDisplay);

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  const offsetClasses = {
    sm: '-ml-2',
    md: '-ml-2.5',
    lg: '-ml-3',
  };

  /**
   * Генерация цвета фона на основе имени пользователя
   */
  const getColorFromName = (name: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  /**
   * Получение инициалов пользователя
   */
  const getInitials = (voter: Voter): string => {
    const first = voter.firstName?.charAt(0) || '';
    const last = voter.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  /**
   * Получение Telegram аватара (если доступно)
   * Note: Telegram не предоставляет прямые URL аватаров через Web App API,
   * поэтому используем fallback с инициалами
   */
  const getTelegramAvatarUrl = (telegramId: bigint): string | null => {
    // Telegram не предоставляет публичные URLs для аватаров через Web App
    // В будущем можно добавить запрос через Bot API к /getUserProfilePhotos
    return null;
  };

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        {displayedVoters.map((voter, index) => {
          const avatarUrl = getTelegramAvatarUrl(voter.telegramId);
          const initials = getInitials(voter);
          const colorClass = getColorFromName(voter.firstName);

          return (
            <motion.div
              key={voter.id}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={`
                ${sizeClasses[size]}
                ${index > 0 ? offsetClasses[size] : ''}
                relative rounded-full border-2 border-white dark:border-gray-800
                flex items-center justify-center
                font-semibold text-white
                shadow-md
                ${colorClass}
                hover:z-10 hover:scale-110 transition-transform
                cursor-default
              `}
              title={`${voter.firstName}${voter.lastName ? ' ' + voter.lastName : ''}`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={voter.firstName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </motion.div>
          );
        })}

        {/* Показываем "+N" если есть еще пользователи */}
        {remainingCount > 0 && (
          <motion.div
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
          </motion.div>
        )}
      </div>

      {/* Иконка пользователей (опционально) */}
      {voters.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="ml-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
        >
          <Users size={14} />
          <span>{voters.length}</span>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Компактная версия - только счётчик с иконкой
 */
export const VotersCount: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400"
    >
      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <Users size={14} className="text-blue-500" />
      </div>
      <span className="font-medium">{count}</span>
    </motion.div>
  );
};
