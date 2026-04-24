import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  message: string;
  title?: string;
  duration?: number; // в миллисекундах, 0 = не исчезает
  position?: 'top' | 'bottom' | 'center';
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number; // 0-100 для прогресс-бара
  icon?: string | ReactNode;
  dismissible?: boolean;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  const { addToast, removeToast, updateToast, clearAll } = context;

  const success = (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return addToast({ type: 'success', message, ...options });
  };

  const error = (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return addToast({ type: 'error', message, ...options });
  };

  const warning = (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return addToast({ type: 'warning', message, ...options });
  };

  const info = (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return addToast({ type: 'info', message, ...options });
  };

  const loading = (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return addToast({ type: 'loading', message, ...options });
  };

  const promise = async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ): Promise<T> => {
    const toastId = loading(messages.loading);

    try {
      const data = await promise;
      const successMessage = typeof messages.success === 'function'
        ? messages.success(data)
        : messages.success;

      updateToast(toastId, {
        type: 'success',
        message: successMessage,
        duration: 4000,
        dismissible: true,
      });

      return data;
    } catch (error) {
      const errorMessage = typeof messages.error === 'function'
        ? messages.error(error as Error)
        : messages.error;

      updateToast(toastId, {
        type: 'error',
        message: errorMessage,
        duration: 5000,
        dismissible: true,
      });

      throw error;
    }
  };

  return {
    success,
    error,
    warning,
    info,
    loading,
    promise,
    addToast,
    removeToast,
    updateToast,
    clearAll,
  };
};
