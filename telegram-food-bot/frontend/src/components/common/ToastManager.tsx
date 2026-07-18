/* @refresh reset */
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHaptic } from '../../hooks/useHaptic';
import { ICON_SIZES } from '@/lib/design-tokens';
import { Toast, ToastContext } from './toast-context';

const positionClasses = {
  top: 'top-4 left-4 right-4',
  bottom: 'bottom-4 left-4 right-4',
  center: 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
};

const typeStyles = {
  success: {
    bg: 'bg-mint-500',
    icon: '✅',
  },
  error: {
    bg: 'bg-coral-500',
    icon: '❌',
  },
  warning: {
    bg: 'bg-butter-500 text-gray-950',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-lavender-500',
    icon: 'ℹ️',
  },
  loading: {
    bg: 'bg-card border border-border text-foreground',
    icon: (
      <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
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

/**
 * Провайдер Toast системы
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(toastReducer, initialState);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
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
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    dispatch({ type: 'UPDATE_TOAST', id, updates });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const contextValue = useMemo(
    () => ({ addToast, removeToast, updateToast, clearAll }),
    [addToast, removeToast, updateToast, clearAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
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

  const style = typeStyles[toast.type];
  const displayIcon = toast.icon || style.icon;

  return (
    <div
      className="pointer-events-auto animate-slide-down"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={`${style.bg} rounded-2xl shadow-2xl p-4 min-w-[280px] max-w-md ${toast.type === 'loading' ? '' : 'text-white'}`}>
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
              <button type="button"
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
            <button type="button"
              aria-label="Закрыть уведомление"
              onClick={handleDismiss}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <svg className={ICON_SIZES.md} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

