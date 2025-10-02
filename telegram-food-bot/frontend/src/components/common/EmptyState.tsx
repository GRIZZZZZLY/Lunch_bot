import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: 'menu' | 'poll' | 'stats' | 'search' | 'error';
}

const illustrations = {
  menu: (
    <svg className="w-32 h-32 mx-auto mb-4 text-telegram-hint-color opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  poll: (
    <svg className="w-32 h-32 mx-auto mb-4 text-telegram-hint-color opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  stats: (
    <svg className="w-32 h-32 mx-auto mb-4 text-telegram-hint-color opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  search: (
    <svg className="w-32 h-32 mx-auto mb-4 text-telegram-hint-color opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  error: (
    <svg className="w-32 h-32 mx-auto mb-4 text-red-400 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/**
 * Компонент Empty State для пустых списков
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  illustration,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      {/* Иллюстрация или иконка */}
      {illustration && illustrations[illustration]}
      {!illustration && icon && (
        <div className="text-6xl mb-4 animate-bounce-slow">{icon}</div>
      )}

      {/* Заголовок */}
      <h3 className="text-xl font-semibold text-telegram-text-color mb-2">
        {title}
      </h3>

      {/* Описание */}
      {description && (
        <p className="text-telegram-hint-color mb-6 max-w-sm">
          {description}
        </p>
      )}

      {/* Действие */}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="lg">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

/**
 * Предустановленные Empty States
 */
export const EmptyMenuState: React.FC<{ onAction?: () => void }> = ({ onAction }) => (
  <EmptyState
    illustration="menu"
    title="Меню пусто"
    description="Добавьте первое блюдо в меню, чтобы начать работу"
    actionLabel="Добавить блюдо"
    onAction={onAction}
  />
);

export const EmptyPollsState: React.FC<{ onAction?: () => void }> = ({ onAction }) => (
  <EmptyState
    illustration="poll"
    title="Нет голосований"
    description="Создайте первое голосование для вашей группы"
    actionLabel="Создать голосование"
    onAction={onAction}
  />
);

export const EmptyStatsState: React.FC = () => (
  <EmptyState
    illustration="stats"
    title="Статистика недоступна"
    description="Проведите несколько голосований, чтобы увидеть статистику"
  />
);

export const EmptySearchState: React.FC = () => (
  <EmptyState
    illustration="search"
    title="Ничего не найдено"
    description="Попробуйте изменить параметры поиска"
  />
);

export const ErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <EmptyState
    illustration="error"
    title="Произошла ошибка"
    description="Не удалось загрузить данные. Попробуйте ещё раз."
    actionLabel="Повторить"
    onAction={onRetry}
  />
);
