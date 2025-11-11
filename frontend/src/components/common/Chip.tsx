import React from 'react';
import { useHaptic } from '../../hooks/useHaptic';

interface ChipProps {
  label: string;
  icon?: string | React.ReactNode;
  avatar?: string;
  onDelete?: () => void;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: 'filled' | 'outlined' | 'default';
  color?: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Chip - компонент для отображения тегов, категорий и фильтров
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  avatar,
  onDelete,
  onClick,
  selected = false,
  disabled = false,
  variant = 'default',
  color = 'default',
  size = 'md',
  className = '',
}) => {
  const haptic = useHaptic();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      haptic.light();
      onClick();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onDelete) {
      haptic.medium();
      onDelete();
    }
  };

  // Color variants
  const colorClasses = {
    default: {
      filled: 'bg-gray-500 text-white',
      outlined: 'border-gray-500 text-gray-400 dark:text-gray-400',
      default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    },
    primary: {
      filled: 'bg-telegram-button-color text-white',
      outlined: 'border-telegram-button-color text-telegram-button-color',
      default: 'bg-telegram-button-color/10 text-telegram-button-color',
    },
    success: {
      filled: 'bg-green-500 text-white',
      outlined: 'border-green-500 text-green-500',
      default: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    },
    error: {
      filled: 'bg-red-500 text-white',
      outlined: 'border-red-500 text-red-500',
      default: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
    warning: {
      filled: 'bg-orange-500 text-white',
      outlined: 'border-orange-500 text-orange-500',
      default: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    },
    info: {
      filled: 'bg-blue-500 text-white',
      outlined: 'border-blue-500 text-blue-500',
      default: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    },
  };

  // Size variants
  const sizeClasses = {
    sm: 'text-xs px-2 py-1 gap-1',
    md: 'text-sm px-3 py-1.5 gap-1.5',
    lg: 'text-base px-4 py-2 gap-2',
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const baseClass = `inline-flex items-center rounded-full font-medium transition-all ${sizeClasses[size]}`;
  const variantClass = colorClasses[color][variant];
  const outlinedBorder = variant === 'outlined' ? 'border-2' : '';
  const clickableClass = onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : '';
  const selectedClass = selected ? 'ring-2 ring-telegram-button-color ring-offset-2' : '';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <div
      onClick={handleClick}
      className={`${baseClass} ${variantClass} ${outlinedBorder} ${clickableClass} ${selectedClass} ${disabledClass} ${className}`}
    >
      {/* Avatar */}
      {avatar && (
        <img
          src={avatar}
          alt=""
          className={`rounded-full ${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'}`}
        />
      )}

      {/* Icon */}
      {icon && !avatar && (
        <span className={iconSizes[size]}>
          {typeof icon === 'string' ? icon : icon}
        </span>
      )}

      {/* Label */}
      <span className="whitespace-nowrap">{label}</span>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={disabled}
          className="ml-1 rounded-full hover:bg-black/10 transition-colors p-0.5 disabled:cursor-not-allowed"
        >
          <svg
            className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

/**
 * ChipGroup - группа чипов с управлением выбором
 */
export const ChipGroup: React.FC<{
  chips: Array<{
    id: string;
    label: string;
    icon?: string | React.ReactNode;
  }>;
  selected?: string[];
  onSelect?: (id: string) => void;
  multiSelect?: boolean;
  variant?: ChipProps['variant'];
  color?: ChipProps['color'];
  size?: ChipProps['size'];
  className?: string;
}> = ({
  chips,
  selected = [],
  onSelect,
  multiSelect: _multiSelect = false,
  variant = 'default',
  color = 'primary',
  size = 'md',
  className = '',
}) => {
  const handleSelect = (id: string) => {
    if (!onSelect) return;
    onSelect(id);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          label={chip.label}
          icon={chip.icon}
          onClick={() => handleSelect(chip.id)}
          selected={selected.includes(chip.id)}
          variant={variant}
          color={color}
          size={size}
        />
      ))}
    </div>
  );
};

/**
 * FilterChip - специальный чип для фильтров
 */
export const FilterChip: React.FC<{
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onClear?: () => void;
}> = ({ label, active = false, count, onClick, onClear }) => {
  return (
    <Chip
      label={count !== undefined ? `${label} (${count})` : label}
      onClick={onClick}
      onDelete={active ? onClear : undefined}
      selected={active}
      variant={active ? 'filled' : 'outlined'}
      color="primary"
    />
  );
};

/**
 * Пример использования:
 * 
 * // Простой chip:
 * <Chip label="React" />
 * 
 * // С иконкой:
 * <Chip label="Пицца" icon="🍕" />
 * 
 * // С аватаром:
 * <Chip label="Иван" avatar="/avatar.jpg" />
 * 
 * // Удаляемый:
 * <Chip
 *   label="Тег"
 *   onDelete={() => removeTag(id)}
 * />
 * 
 * // Кликабельный с selected:
 * <Chip
 *   label="Категория"
 *   onClick={() => setCategory('pizza')}
 *   selected={category === 'pizza'}
 * />
 * 
 * // Группа чипов:
 * <ChipGroup
 *   chips={[
 *     { id: 'pizza', label: 'Пицца', icon: '🍕' },
 *     { id: 'burger', label: 'Бургер', icon: '🍔' },
 *     { id: 'sushi', label: 'Суши', icon: '🍣' },
 *   ]}
 *   selected={['pizza']}
 *   onSelect={(id) => setSelected(id)}
 *   multiSelect
 * />
 * 
 * // Filter chip:
 * <FilterChip
 *   label="Активные"
 *   active={filter === 'active'}
 *   count={5}
 *   onClick={() => setFilter('active')}
 *   onClear={() => setFilter(null)}
 * />
 */
