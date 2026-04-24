import { useToastStore, type Toast, type ToastType } from '@/store/useToastStore';

interface ToastOptions {
  title?: string;
  duration?: number;
}

export function useToast() {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);
  const clear = useToastStore((s) => s.clear);

  const make = (type: ToastType) => (message: string, opts?: ToastOptions) =>
    push({ type, message, ...opts });

  return {
    success: make('success'),
    error: make('error'),
    warning: make('warning'),
    info: make('info'),
    dismiss,
    clear,
  };
}

export type { Toast, ToastType };
