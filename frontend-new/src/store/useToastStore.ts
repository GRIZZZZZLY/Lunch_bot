import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (toast) => {
    // Двойной тап схлопывается в один запрос, но обработчики успеха отрабатывают
    // дважды. Одинаковое сообщение, пока предыдущее ещё на экране, не дублируем.
    const visible = get().toasts.find(
      (t) => t.type === toast.type && t.message === toast.message && t.title === toast.title,
    );
    if (visible) return visible.id;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3500);
    set((s) => ({ toasts: [...s.toasts, { id, duration, ...toast }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
