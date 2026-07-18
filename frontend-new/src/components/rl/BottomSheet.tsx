/* ROCKET LUNCH — bottom sheet (redesign v2). Scrim + slide-up floating surface.
   Доступность: focus trap, восстановление фокуса, scroll lock, Escape,
   Telegram BackButton (через lib/backButton), aria-labelledby, safe-area. */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './primitives';
import { pushOverlay } from '@/lib/backButton';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BottomSheet({
  title,
  onClose,
  children,
  footer,
  role = 'dialog',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
}) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const registration = pushOverlay(() => onCloseRef.current());

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    sheetRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Реагирует только верхний слой — Escape закрывает по одному.
        if (registration.isTop()) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === sheetRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      registration.release();
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="rl">
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 60 }}
        aria-hidden="true"
      />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61, maxWidth: 430, margin: '0 auto' }}
      >
        <div
          ref={sheetRef}
          tabIndex={-1}
          className="surf-floating anim-rise"
          style={{
            borderRadius: '22px 22px 0 0',
            padding: 20,
            paddingBottom: 'calc(20px + var(--safe-area-bottom, 0px))',
            maxHeight: '86vh',
            overflowY: 'auto',
            outline: 'none',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--divider)', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h3 id={titleId} className="font-head tight" style={{ margin: 0, fontSize: 'var(--text-18)', fontWeight: 700, lineHeight: 1.2 }}>
              {title}
            </h3>
            <IconButton variant="ghost" size="sm" name="x" aria-label="Закрыть" onClick={onClose} />
          </div>
          {children}
          {footer && <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
