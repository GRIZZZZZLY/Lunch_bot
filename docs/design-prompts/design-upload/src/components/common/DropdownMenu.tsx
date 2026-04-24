import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useHaptic } from '../../hooks/useHaptic';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  align?: 'start' | 'end' | 'center';
  closeOnClick?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * DropdownMenu - выпадающее меню для действий
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  position = 'bottom-right',
  align = 'start',
  closeOnClick = true,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const haptic = useHaptic();

  // Вычисление позиции меню
  useEffect(() => {
    if (isOpen && triggerRef.current && menuRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = 0;
      let left = 0;

      // Вертикальная позиция
      if (position.startsWith('bottom')) {
        top = triggerRect.bottom + 8;
        // Проверка выхода за пределы экрана снизу
        if (top + menuRect.height > viewportHeight) {
          top = triggerRect.top - menuRect.height - 8;
        }
      } else {
        top = triggerRect.top - menuRect.height - 8;
        // Проверка выхода за пределы экрана сверху
        if (top < 0) {
          top = triggerRect.bottom + 8;
        }
      }

      // Горизонтальная позиция
      if (position.endsWith('right')) {
        left = triggerRect.right - menuRect.width;
      } else {
        left = triggerRect.left;
      }

      // Применение alignment
      if (align === 'center') {
        left = triggerRect.left + (triggerRect.width - menuRect.width) / 2;
      } else if (align === 'end') {
        left = triggerRect.right - menuRect.width;
      }

      // Проверка выхода за пределы экрана по горизонтали
      if (left < 8) {
        left = 8;
      } else if (left + menuRect.width > viewportWidth - 8) {
        left = viewportWidth - menuRect.width - 8;
      }

      setMenuPosition({ top, left });
    }
  }, [isOpen, position, align]);

  // Закрытие при клике вне меню
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    haptic.light();
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.disabled) return;

    haptic.medium();
    item.onClick();

    if (closeOnClick) {
      setIsOpen(false);
    }
  };

  const variantClasses = {
    default: 'text-telegram-text-color hover:bg-telegram-secondary-bg-color',
    danger: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
    success: 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20',
  };

  const menu = isOpen && (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 animate-scale-in"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {item.divider && index > 0 && (
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
          )}
          <button
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              variantClasses[item.variant || 'default']
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Icon */}
            {item.icon && (
              <span className="text-lg flex-shrink-0">
                {typeof item.icon === 'string' ? item.icon : item.icon}
              </span>
            )}

            {/* Label */}
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        className={`inline-flex ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        {trigger}
      </div>
      {isOpen && createPortal(menu, document.body)}
    </>
  );
};

/**
 * IconButton для использования с DropdownMenu
 */
export const DropdownIconButton: React.FC<{
  icon?: string | React.ReactNode;
  className?: string;
}> = ({ icon = '⋮', className = '' }) => {
  return (
    <button
      className={`p-2 rounded-lg hover:bg-telegram-secondary-bg-color transition-colors ${className}`}
    >
      <span className="text-xl text-telegram-hint-color">
        {typeof icon === 'string' ? icon : icon}
      </span>
    </button>
  );
};

/**
 * Пример использования:
 * 
 * <DropdownMenu
 *   trigger={<DropdownIconButton />}
 *   items={[
 *     {
 *       id: 'edit',
 *       label: 'Редактировать',
 *       icon: '✏️',
 *       onClick: () => handleEdit(),
 *     },
 *     {
 *       id: 'duplicate',
 *       label: 'Дублировать',
 *       icon: '📋',
 *       onClick: () => handleDuplicate(),
 *     },
 *     {
 *       id: 'divider',
 *       label: '',
 *       icon: '',
 *       onClick: () => {},
 *       divider: true,
 *     },
 *     {
 *       id: 'delete',
 *       label: 'Удалить',
 *       icon: '🗑️',
 *       onClick: () => handleDelete(),
 *       variant: 'danger',
 *     },
 *   ]}
 *   position="bottom-right"
 * />
 * 
 * // С custom trigger:
 * <DropdownMenu
 *   trigger={<Button>Действия</Button>}
 *   items={menuItems}
 * />
 * 
 * // С иконками SVG:
 * <DropdownMenu
 *   trigger={
 *     <button>
 *       <svg>...</svg>
 *     </button>
 *   }
 *   items={[
 *     {
 *       id: 'settings',
 *       label: 'Настройки',
 *       icon: <SettingsIcon />,
 *       onClick: () => navigate('/settings'),
 *     },
 *   ]}
 * />
 */
