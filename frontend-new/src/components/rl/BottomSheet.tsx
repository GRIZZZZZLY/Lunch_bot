/* ROCKET LUNCH — bottom sheet (redesign v2). Scrim + slide-up floating surface. */
import type { ReactNode } from 'react';
import { IconButton } from './primitives';

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
  return (
    <div className="rl">
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,18,0.45)', zIndex: 60 }}
        aria-hidden="true"
      />
      <div
        role={role}
        aria-modal="true"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61, maxWidth: 430, margin: '0 auto' }}
      >
        <div
          className="surf-floating anim-rise"
          style={{
            borderRadius: '22px 22px 0 0',
            padding: 20,
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            maxHeight: '86vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--border-subtle)', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h3 className="font-head tight" style={{ margin: 0, fontSize: 'var(--t-18)', fontWeight: 700, lineHeight: 1.2 }}>
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
