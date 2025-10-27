import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  photoUrl?: string;
  firstName: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
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
 * Поддерживает фото из Telegram API (если доступно)
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  firstName,
  lastName,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  // Если есть photoUrl и изображение загрузилось
  if (photoUrl && !imageError) {
    return (
      <div className={`${sizeMap[size]} rounded-full overflow-hidden shadow-lg ${className}`}>
        <img
          src={photoUrl}
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
