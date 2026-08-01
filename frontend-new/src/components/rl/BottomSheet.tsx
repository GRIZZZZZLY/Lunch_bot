/* ROCKET LUNCH — bottom sheet (redesign v2). Scrim + slide-up floating surface.
   Доступность: focus trap, восстановление фокуса, scroll lock, Escape,
   Telegram BackButton (через lib/backButton), aria-labelledby, safe-area.
   Motion: симметричный вход/выход (подъём/уход вниз, 200ms), fade скрима,
   drag-to-dismiss 1:1 c velocity-порогом (~0.11 px/ms) и snap-back-пружиной.
   Программные закрытия (успех мутации — родитель убирает open) остаются
   мгновенными намеренно: успех должен ощущаться быстрым. */
import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './primitives';
import { pushOverlay } from '@/lib/backButton';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EXIT_MS = 200;
const SNAP_MS = 220;

/** Порог dismissal по жесту: средняя скорость > ~0.11 px/ms ИЛИ смещение > 35% высоты. */
export function shouldDismissSheet(offsetPx: number, elapsedMs: number, sheetHeight: number): boolean {
  if (offsetPx <= 0) return false;
  const velocity = elapsedMs > 0 ? offsetPx / elapsedMs : 0;
  return velocity > 0.11 || offsetPx > sheetHeight * 0.35;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Ловушка по Tab не останавливает виртуальный курсор скринридера: фон надо
   гасить `inert`. Лист живёт в портале у body, поэтому inert вешается на #root
   целиком. Счётчик — на случай ConfirmDialog поверх обычного листа. */
let openSheetCount = 0;

function deactivateBackground(): () => void {
  openSheetCount += 1;
  if (openSheetCount === 1) document.getElementById('root')?.setAttribute('inert', '');
  return () => {
    openSheetCount = Math.max(0, openSheetCount - 1);
    if (openSheetCount === 0) document.getElementById('root')?.removeAttribute('inert');
  };
}

export function BottomSheet({
  title,
  onClose,
  children,
  footer,
  role = 'dialog',
  closable = true,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  /** false — закрытие заблокировано (мутация в полёте): Escape/backdrop/
      BackButton/drag игнорируются ещё ДО exit-анимации. */
  closable?: boolean;
}) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closableRef = useRef(closable);

  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const releaseRef = useRef<(() => void) | null>(null);
  const drag = useRef<{ pointerId: number; startY: number; startedAt: number; offset: number } | null>(null);

  /** Анимированное закрытие: уход вниз + fade скрима, затем настоящий onClose. */
  const beginClose = () => {
    if (closingRef.current || !closableRef.current) return;
    closingRef.current = true;
    // слой освобождается сразу: повторный BackButton во время exit-анимации
    // уходит в навигацию, а не проглатывается
    releaseRef.current?.();
    const ms = prefersReducedMotion() ? 0 : EXIT_MS;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), ms);
  };
  const beginCloseRef = useRef(beginClose);
  // latest-ref: обновление вне рендера (правило react-hooks/refs)
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    closableRef.current = closable;
    beginCloseRef.current = beginClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const registration = pushOverlay(() => beginCloseRef.current());
    releaseRef.current = registration.release;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const reactivateBackground = deactivateBackground();

    sheetRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (registration.isTop()) {
          e.stopPropagation();
          beginCloseRef.current();
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
      // inert снимается до возврата фокуса: внутри inert-поддерева focus() не сработает
      reactivateBackground();
      previouslyFocused?.focus?.();
    };
  }, []);

  /* ---- drag-to-dismiss: 1:1 ведение пальцем, transition отключён на время жеста ---- */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (closingRef.current || !closableRef.current || e.pointerType === 'mouse') return;
    // жест начинается только когда контент прокручен к верху
    if (sheetRef.current && sheetRef.current.scrollTop > 0) return;
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startedAt: performance.now(), offset: 0 };
    sheetRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || !sheetRef.current) return;
    d.offset = Math.max(0, e.clientY - d.startY);
    sheetRef.current.style.transition = 'none';
    sheetRef.current.style.transform = `translateY(${d.offset}px)`;
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || !sheetRef.current) return;
    drag.current = null;
    const el = sheetRef.current;
    const elapsed = performance.now() - d.startedAt;
    if (shouldDismissSheet(d.offset, elapsed, el.offsetHeight)) {
      // продолжаем движение вниз из текущей позиции — прерываемо и без скачка
      el.style.transition = `transform ${EXIT_MS}ms var(--ease-out)`;
      el.style.transform = 'translateY(100%)';
      beginCloseRef.current();
    } else {
      // snap-back пружиной
      el.style.transition = `transform ${SNAP_MS}ms var(--ease-spring)`;
      el.style.transform = 'translateY(0)';
    }
  };

  return createPortal(
    <div className="rl">
      <div
        onClick={beginClose}
        className={'sheet-scrim' + (closing ? ' is-closing' : '')}
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
          className={'surf-floating sheet-panel' + (closing ? ' is-closing' : ' anim-rise')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{
            borderRadius: '22px 22px 0 0',
            padding: 20,
            paddingBottom: 'calc(20px + var(--safe-area-bottom, 0px))',
            maxHeight: '86vh',
            overflowY: 'auto',
            // без contain прокрутка «пробивает» лист и уводит фон под ним
            overscrollBehavior: 'contain',
            outline: 'none',
            touchAction: 'pan-y',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--divider)', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h3 id={titleId} className="font-head tight" style={{ margin: 0, fontSize: 'var(--text-18)', fontWeight: 700, lineHeight: 1.2 }}>
              {title}
            </h3>
            {/* при closable=false beginClose выходит по guard — не показываем
                элемент управления, который выглядит рабочим и ничего не делает */}
            {closable && (
              <IconButton variant="ghost" size="sm" name="x" aria-label="Закрыть" onClick={beginClose} />
            )}
          </div>
          {children}
          {footer && <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
