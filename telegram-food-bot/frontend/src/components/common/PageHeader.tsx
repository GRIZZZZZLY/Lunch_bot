import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { useTelegram } from '@/hooks/useTelegram';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

/**
 * Компонент заголовка страницы с кнопкой возврата
 */
export function PageHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  children,
  className,
  actions,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { hapticFeedback } = useTelegram();

  const handleBack = () => {
    hapticFeedback?.selectionChanged();
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn('mb-4', className)}>
      {/* Back Button and Actions Row */}
      {(showBack || actions) && (
        <div className="flex items-center justify-between mb-3">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1 -ml-2 text-telegram-button-color hover:bg-telegram-button-color/10"
            >
              <ArrowLeft className="size-4" />
              <span>Назад</span>
            </Button>
          )}
          
          {!showBack && <div />}
          
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Title and Subtitle */}
      {(title || subtitle || children) && (
        <div className="space-y-1">
          {title && (
            <h1 className="text-2xl font-bold text-telegram-text-color">
              {title}
            </h1>
          )}
          
          {subtitle && (
            <p className="text-sm text-telegram-hint-color">
              {subtitle}
            </p>
          )}
          
          {children}
        </div>
      )}
    </div>
  );
}
