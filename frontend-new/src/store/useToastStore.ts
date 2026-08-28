import { create } from 'zustand';
import { hapticNotify } from '@/lib/haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Длительность ухода. Обязана совпадать с `toast-out` в styles/toast.css. */
export const TOAST_EXIT_MS = 180;

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  /** Тост проигрывает уход и будет снят через TOAST_EXIT_MS. */
  leaving?: boolean;
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
    const same = (t: Toast) =>
      t.type === toast.type && t.message === toast.message && t.title === toast.title;

    /* Двойной тап схлопывается в один запрос, но обработчики успеха отрабатывают
       дважды. Одинаковое сообщение, пока предыдущее ещё на экране, не дублируем.

       Уходящий тост экраном не считается: он уже снят пользователем или
       таймером, и повторить действие — значит показать сообщение заново. Иначе
       закрытое сообщение нельзя было бы вызвать те 180 мс, что оно доигрывает
       уход, — и человек видел бы, что нажатие ничего не сделало. */
    const visible = get().toasts.find((t) => same(t) && !t.leaving);
    if (visible) return visible.id;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3500);
    /* Исход операции сообщается и тактильно. Воронка здесь одна на весь
       продукт, поэтому вибрация не разъедется с сообщением: где нет тоста,
       там нечего и подтверждать. `info` молчит — это не исход, а реплика. */
    if (toast.type !== 'info') hapticNotify(toast.type);
    /* Уходящий двойник снимается сразу: два одинаковых сообщения в стопке —
       одно бледнеющее, другое въезжающее — читаются как сбой, а не как повтор.
       Его таймер удаления отработает вхолостую, фильтруя по исчезнувшему id. */
    set((s) => ({ toasts: [...s.toasts.filter((t) => !(same(t) && t.leaving)), { id, duration, ...toast }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },
  /* Снятие в два шага: сначала флаг ухода, через TOAST_EXIT_MS — удаление.
     Раньше тост вычёркивался из массива по таймеру и пропадал между кадрами:
     вход у него был, конца не было вовсе. Повторный вызов на уже уходящем
     тосте игнорируется, иначе второй таймер снял бы соседа по индексу. */
  dismiss: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (!toast || toast.leaving) return;
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_EXIT_MS);
  },
  clear: () => set({ toasts: [] }),
}));
