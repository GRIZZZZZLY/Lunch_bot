import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useHaptic } from '../../hooks/useHaptic';

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
  icon?: string | React.ReactNode;
  dismissible?: boolean;
}

type ToastAction = 
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'UPDATE_TOAST'; id: string; updates: Partial<Toast> }
  | { type: 'CLEAR_ALL' };

interface ToastState {
  toasts: Toast[];
}

const initialState: ToastState = {
  toasts: [],
};

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.toast],
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.id),
      };
    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map(toast =>
          toast.id === action.id ? { ...toast, ...action.updates } : toast
        ),
      };
    case 'CLEAR_ALL':
      return {
        ...state,
        toasts: [],
      };
    default:
      return state;
  }
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Провайдер Toast системы
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullToast: Toast = {
      id,
      duration: 4000,
      position: 'top',
      dismissible: true,
      ...toast,
    };
    
    dispatch({ type: 'ADD_TOAST', toast: fullToast });
    return id;
  };

  const removeToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  };

  const updateToast = (id: string, updates: Partial<Toast>) => {
    dispatch({ type: 'UPDATE_TOAST', id, updates });
  };

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, updateToast, clearAll }}>
      {children}
      <ToastContainer toasts={state.toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

/**
 * Контейнер для отображения Toast'ов
 */
const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  const groupedToasts = toasts.reduce(
    (acc, toast) => {
      const position = toast.position || 'top';
      if (!acc[position]) {
        acc[position] = [];
      }
      acc[position].push(toast);
      return acc;
    },
    {} as Record<string, Toast[]>
  );

  const positionClasses = {
    top: 'top-4 left-4 right-4',
    bottom: 'bottom-4 left-4 right-4',
    center: 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
  };

  return createPortal(
    <>
      {Object.entries(groupedToasts).map(([position, toasts]) => (
        <div
          key={position}
          className={`fixed ${positionClasses[position as keyof typeof positionClasses]} z-[9999] pointer-events-none`}
        >
          <div className="flex flex-col gap-2">
            {toasts.map((toast, index) => (
              <ToastItem
                key={toast.id}
                toast={toast}
                onRemove={onRemove}
                index={index}
              />
            ))}
          </div>
        </div>
      ))}
    </>,
    document.body
  );
};

/**
 * Отдельный Toast элемент
 */
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
  index: number;
}> = ({ toast, onRemove, index }) => {
  const haptic = useHaptic();

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const handleDismiss = () => {
    haptic.light();
    onRemove(toast.id);
  };

  const handleAction = () => {
    if (toast.action) {
      haptic.medium();
      toast.action.onClick();
      onRemove(toast.id);
    }
  };

  const typeStyles = {
    success: {
      bg: 'bg-green-500',
      icon: '✅',
    },
    error: {
      bg: 'bg-red-500',
      icon: '❌',
    },
    warning: {
      bg: 'bg-orange-500',
      icon: '⚠️',
    },
    info: {
      bg: 'bg-blue-500',
      icon: 'ℹ️',
    },
    loading: {
      bg: 'bg-gray-500',
      icon: (
        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
    },
  };

  const style = typeStyles[toast.type];
  const displayIcon = toast.icon || style.icon;

  return (
    <div
      className="pointer-events-auto animate-slide-down"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={`${style.bg} text-white rounded-2xl shadow-2xl p-4 min-w-[280px] max-w-md`}>
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 text-xl">
            {typeof displayIcon === 'string' ? displayIcon : displayIcon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <div className="font-semibold mb-1 text-sm">
                {toast.title}
              </div>
            )}
            <div className="text-sm opacity-95">
              {toast.message}
            </div>

            {/* Action button */}
            {toast.action && (
              <button
                onClick={handleAction}
                className="mt-2 text-sm font-medium underline hover:no-underline"
              >
                {toast.action.label}
              </button>
            )}

            {/* Progress bar */}
            {toast.progress !== undefined && (
              <div className="mt-2 bg-white/20 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-300"
                  style={{ width: `${toast.progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Dismiss button */}
          {toast.dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      </div>
    </div>
  );
};

/**
 * Хук для использования Toast системы
 */
export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  const { addToast, removeToast, updateToast, clearAll } = context;

  // Хелперы для быстрого создания типовых toast'ов
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
    return addToast({ type: 'loading', message, duration: 0, dismissible: false, ...options });
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
    addToast,
    removeToast,
    updateToast,
    clearAll,
    success,
    error,
    warning,
    info,
    loading,
    promise,
  };
};

/**
 * Пример использования:
 * 
 * // В App.tsx оберните приложение:
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * 
 * // В компонентах:
 * const toast = useToast();
 * 
 * toast.success('Блюдо добавлено!');
 * 
 * toast.error('Ошибка загрузки', {
 *   action: {
 *     label: 'Повторить',
 *     onClick: () => loadData(),
 *   },
 * });
 * 
 * const loadingId = toast.loading('Загрузка...');
 * // После загрузки:
 * toast.updateToast(loadingId, { 
 *   type: 'success', 
 *   message: 'Готово!',
 *   duration: 3000 
 * });
 * 
 * // Promise wrapper:
 * await toast.promise(
 *   fetchData(),
 *   {
 *     loading: 'Загрузка данных...',
 *     success: 'Данные загружены!',
 *     error: 'Ошибка загрузки',
 *   }
 * );
 */
