import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useUserAvatar } from '@/hooks/useUserAvatar';

interface UserAvatarProps {
  /**
   * ID пользователя для автозагрузки аватарки из API
   * Если указан, то photoUrl игнорируется и загружается из Telegram API
   */
  userId?: number;

  /**
   * Прямой URL фото (для обратной совместимости)
   * Используется только если userId не указан
   */
  photoUrl?: string;

  firstName: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;

  /**
   * Отключить автозагрузку аватарки (использовать только photoUrl или fallback)
   */
  disableAutoLoad?: boolean;
}

const sizeMap = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

const iconSizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

/**
 * Компонент аватара пользователя с fallback на первую букву имени
 *
 * Режимы работы:
 * 1. Auto-load mode (приоритет): если передан userId, автоматически загружает аватарку из API
 * 2. Direct mode: если передан photoUrl, использует его напрямую
 * 3. Fallback: показывает инициал имени
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  photoUrl,
  firstName,
  lastName,
  size = 'md',
  className = '',
  disableAutoLoad = false,
}) => {
  const [imageError, setImageError] = useState(false);

  // Auto-load mode: загружаем аватарку через API если указан userId
  const { avatarUrl, isLoading } = useUserAvatar(userId, {
    enabled: !!userId && !disableAutoLoad,
  });

  // Определяем финальный URL для отображения
  // Приоритет: avatarUrl (из API) > photoUrl (прямой) > fallback (инициал)
  const finalAvatarUrl = userId && !disableAutoLoad ? avatarUrl : photoUrl;

  // Показываем skeleton при загрузке (только для auto-load mode)
  if (userId && !disableAutoLoad && isLoading) {
    return (
      <div className={`${sizeMap[size]} rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />
    );
  }

  // Если есть finalAvatarUrl и изображение загрузилось
  if (finalAvatarUrl && !imageError) {
    return (
      <div className={`${sizeMap[size]} rounded-full overflow-hidden shadow-lg ${className}`}>
        <img
          src={finalAvatarUrl}
          alt={`${firstName} ${lastName || ''}`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback: первая буква имени
  const initial = firstName?.charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-primary-food-500 to-primary-food-600 flex items-center justify-center text-white font-bold shadow-lg ${className}`}
    >
      {initial}
    </div>
  );
};

/**
 * Иконка пользователя для случаев, когда нет данных
 */
export const UserIconAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
    >
      <User size={iconSizeMap[size]} className="text-gray-500 dark:text-gray-400" />
    </div>
  );
};
