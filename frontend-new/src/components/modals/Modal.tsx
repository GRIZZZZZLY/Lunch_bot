import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}

export function Modal({ open, title, onClose, children, footer, maxWidth = 440 }: Props) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 100,
        }}
      />
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(92vw, ${maxWidth}px)`,
          maxHeight: '86vh',
          overflow: 'auto',
          background: 'var(--surf-1, #fff)',
          borderRadius: 20,
          padding: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          zIndex: 101,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          {title && <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>}
          <button
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'var(--surf-2, #F2F2F5)',
              borderRadius: 999,
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </>
  );
}
