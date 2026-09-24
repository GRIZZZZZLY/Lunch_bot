import { createPortal } from 'react-dom';
import { Icon, type IconName } from '@/components/rl/Icon';
import { useToastStore, type ToastType } from '@/store/useToastStore';
import '@/styles/toast.css';

const ICON: Record<ToastType, IconName> = {
  success: 'check',
  error: 'x',
  warning: 'alert',
  info: 'info',
};

/* Уведомление занимает рамку шапки вкладок (components/layout/Header.tsx):
   тот же отступ сверху, те же поля, высота и поверхность. На вкладках оно
   ложится ровно поверх шапки, на detail-экранах выезжает в то же место.
   Слой выше шторок и их затемнения. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  /* Область объявлений живёт всегда: live-region, появившийся вместе с первым
     сообщением, экранный диктор может не заметить.

     Портал у body, рядом со шторками, а не внутри #root: открытая шторка
     делает #root инертным (BottomSheet), и уведомление там было бы видно
     поверх неё, но крестик не нажимался бы, а диктор молчал. */
  return createPortal(
    <div className="rl toast-stack" role="region" aria-label="Уведомления" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast surf-elevated toast-${t.type}${t.leaving ? ' is-leaving' : ''}`}
          role={t.type === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-icon" aria-hidden>
            <Icon name={ICON[t.type]} size={14} />
          </span>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-msg">{t.message}</div>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Закрыть уведомление"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
