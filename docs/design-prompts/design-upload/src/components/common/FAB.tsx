import React, { useState, useEffect, useRef } from 'react';
import { useHaptic } from '../../hooks/useHaptic';

interface FABAction {
  icon: string | React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

interface FABProps {
  icon?: string | React.ReactNode;
  onClick?: () => void;
  actions?: FABAction[];
  hideOnScroll?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Floating Action Button - круглая кнопка для главного действия
 */
export const FAB: React.FC<FABProps> = ({
  icon = '+',
  onClick,
  actions,
  hideOnScroll = true,
  position = 'bottom-right',
  color = 'bg-telegram-button-color',
  size = 'md',
  label,
  disabled = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const haptic = useHaptic();

  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const positions = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  };

  // Скрытие при скролле вниз
  useEffect(() => {
    if (!hideOnScroll) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        // Скроллим вниз
        setIsVisible(false);
        setIsExpanded(false);
      } else if (currentScrollY < lastScrollY.current) {
        // Скроллим вверх
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll]);

  // Закрытие при клике вне
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = () => {
      setIsExpanded(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExpanded]);

  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic.medium();

    if (actions && actions.length > 0) {
      setIsExpanded(!isExpanded);
    } else if (onClick) {
      onClick();
    }
  };

  const handleActionClick = (action: FABAction) => {
    haptic.light();
    action.onClick();
    setIsExpanded(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop для expanded state */}
      {isExpanded && actions && actions.length > 0 && (
        <div className="fixed inset-0 bg-black/20 z-40 animate-fade-in" />
      )}

      {/* FAB Container */}
      <div
        className={`fixed ${positions[position]} z-50 flex flex-col items-end gap-3 ${className}`}
      >
        {/* Expanded Actions */}
        {isExpanded && actions && actions.length > 0 && (
          <div className="flex flex-col gap-3 animate-scale-in">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(action)}
                disabled={disabled}
                className="group flex items-center gap-3 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Label */}
                <span className="bg-white text-telegram-text-color px-3 py-2 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {action.label}
                </span>

                {/* Action Button */}
                <div
                  className={`${action.color || 'bg-telegram-secondary-bg-color'} ${sizes[size]} rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="text-xl">
                    {typeof action.icon === 'string' ? action.icon : action.icon}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={handleMainClick}
          disabled={disabled}
          className={`${color} ${sizes[size]} rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isExpanded ? 'rotate-45' : ''
          }`}
        >
          <span className="text-2xl">
            {typeof icon === 'string' ? icon : icon}
          </span>
        </button>

        {/* Label */}
        {label && !isExpanded && (
          <div className="absolute right-20 bg-white text-telegram-text-color px-3 py-2 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            {label}
          </div>
        )}
      </div>
    </>
  );
};

/**
 * Extended FAB - с меню действий
 */
export const ExtendedFAB: React.FC<{
  icon: string | React.ReactNode;
  label: string;
  actions: FABAction[];
  position?: FABProps['position'];
}> = ({ icon, label, actions, position = 'bottom-right' }) => {
  return (
    <FAB
      icon={icon}
      actions={actions}
      position={position}
      label={label}
    />
  );
};

/**
 * Simple FAB - одна кнопка, одно действие
 */
export const SimpleFAB: React.FC<{
  icon: string | React.ReactNode;
  onClick: () => void;
  label?: string;
  position?: FABProps['position'];
  hideOnScroll?: boolean;
}> = ({ icon, onClick, label, position = 'bottom-right', hideOnScroll = true }) => {
  return (
    <FAB
      icon={icon}
      onClick={onClick}
      label={label}
      position={position}
      hideOnScroll={hideOnScroll}
    />
  );
};

/**
 * Пример использования:
 * 
 * // Простой FAB:
 * <SimpleFAB
 *   icon="+"
 *   label="Добавить блюдо"
 *   onClick={() => setShowAddForm(true)}
 * />
 * 
 * // FAB с меню действий:
 * <ExtendedFAB
 *   icon="+"
 *   label="Создать"
 *   actions={[
 *     {
 *       icon: '🍕',
 *       label: 'Добавить блюдо',
 *       onClick: () => navigate('/menu/create'),
 *       color: 'bg-orange-500',
 *     },
 *     {
 *       icon: '🗳️',
 *       label: 'Создать голосование',
 *       onClick: () => navigate('/poll/create'),
 *       color: 'bg-blue-500',
 *     },
 *     {
 *       icon: '👥',
 *       label: 'Пригласить участника',
 *       onClick: () => handleInvite(),
 *       color: 'bg-green-500',
 *     },
 *   ]}
 * />
 * 
 * // С кастомной иконкой:
 * <SimpleFAB
 *   icon={<svg>...</svg>}
 *   onClick={handleCreate}
 * />
 */
