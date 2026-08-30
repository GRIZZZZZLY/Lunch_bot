/* ROCKET LUNCH — PRIMITIVES (redesign v2 UI-kit, TS)
   Ported from "Redisign v2/src/primitives.jsx".
   Styles live in styles/redesign-v2.css (scoped under .rl). */
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { useRovingFocus } from '@/shared/lib/useRovingFocus';
import { hapticImpact, hapticSelection } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';

/* Отдача навешивается здесь, а не в местах вызова: контролов сотни, а жестов
   три, и разъехавшийся словарь заметен только на устройстве. Удар — у кнопок,
   смена выбора — у тумблеров и чипов.

   Обёртка зовёт вибрацию ДО обработчика: обработчик может размонтировать
   элемент (лист закрывается по успеху мутации), и порядок «сначала действие»
   терял бы отдачу ровно у самых важных нажатий. */
function withHaptic<E>(
  feedback: () => void,
  handler: ((event: E) => void) | undefined,
): (event: E) => void {
  return (event: E) => {
    feedback();
    handler?.(event);
  };
}

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={'spin ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'success'
  /* Тональные: заливка тинтом домена вместо сплошного цвета. Для пар
     противоположных действий внутри карточки — см. redesign-v2.css. */
  | 'success-soft'
  | 'warning'
  | 'danger'
  | 'danger-soft'
  | 'info';
export type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'icon'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  /** Растянуть на всю ширину контейнера. */
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'default',
  icon,
  iconRight,
  loading,
  block = false,
  disabled,
  children,
  className = '',
  // Без явного type кнопка внутри <form> считается submit и отправляет форму.
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn--${variant}`];
  if (size === 'sm') cls.push('btn--sm');
  if (size === 'lg') cls.push('btn--lg');
  if (block) cls.push('btn--block');
  if (loading) cls.push('is-loading');
  if (className) cls.push(className);
  return (
    <button
      type={type}
      className={cls.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={withHaptic(hapticImpact, onClick)}
      {...rest}
    >
      {loading && <Spinner className="btn__spin" />}
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  name: IconName;
  loading?: boolean;
  'aria-label': string;
}

export function IconButton({
  variant = 'ghost',
  size = 'default',
  name,
  loading,
  disabled,
  className = '',
  type = 'button',
  onClick,
  ...rest
}: IconButtonProps) {
  const cls = ['btn', 'btn--icon', `btn--${variant}`];
  if (size === 'sm') cls.push('btn--sm');
  if (size === 'lg') cls.push('btn--lg');
  if (loading) cls.push('is-loading');
  if (className) cls.push(className);
  return (
    <button
      type={type}
      className={cls.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={withHaptic(hapticImpact, onClick)}
      {...rest}
    >
      {loading ? <Spinner className="btn__spin" /> : <Icon name={name} size={size === 'sm' ? 18 : 20} />}
    </button>
  );
}

export interface FieldProps {
  error?: boolean;
  className?: string;
  as?: 'input' | 'textarea';
}

export function Field({
  error,
  className = '',
  as = 'input',
  ...rest
}: FieldProps &
  (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement>)) {
  const cls = ['field', error ? 'is-error' : '', className].filter(Boolean).join(' ');
  if (as === 'textarea')
    return <textarea className={cls} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />;
  return <input className={cls} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Поиск блюд',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="search-bar glass" style={{ borderRadius: 999 }}>
      <Icon name="search" size={18} style={{ color: 'var(--text-tertiary)' }} />
      <input value={value} onChange={onChange} placeholder={placeholder} {...rest} />
    </div>
  );
}

export interface SwitchProps {
  on?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Switch({ on, onChange, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      disabled={disabled}
      className={'switch' + (on ? ' on' : '')}
      onClick={() => {
        if (disabled) return;
        hapticSelection();
        onChange?.(!on);
      }}
      {...rest}
    />
  );
}

export interface CheckboxProps {
  on?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Checkbox({ on, onChange, disabled, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!on}
      disabled={disabled}
      className={'checkbox' + (on ? ' on' : '')}
      onClick={() => {
        if (disabled) return;
        hapticSelection();
        onChange?.(!on);
      }}
      {...rest}
    >
      {on && <Icon name="check" size={15} stroke={2.4} />}
    </button>
  );
}

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: {
  tone?: BadgeTone;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {icon && <Icon name={icon} size={12} stroke={2} />}
      {children}
    </span>
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  on?: boolean;
  icon?: IconName;
}

export function Chip({ on, icon, children, onClick, ...rest }: ChipProps) {
  return (
    // aria-pressed: выбранное состояние чипа несёт только цвет и рамка, на слух
    // выбранный день недели ничем не отличался от невыбранного.
    <button
      type="button"
      aria-pressed={!!on}
      className={'chip press' + (on ? ' on' : '')}
      onClick={withHaptic(hapticSelection, onClick)}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  // role="tablist" обещает стрелочную навигацию — без неё каждая вкладка была
  // отдельной остановкой табуляции, а стрелки не работали вовсе.
  const { getItemProps } = useRovingFocus(
    options.length,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div className="seg" role="tablist">
      {options.map((o, idx) => {
        const { ref, ...roving } = getItemProps(idx);
        return (
          <button
            key={o.value}
            ref={ref}
            type="button"
            role="tab"
            aria-selected={value === o.value}
            className={value === o.value ? 'on' : ''}
            onClick={() => onChange(o.value)}
            {...roving}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  name = '?',
  src,
  size = 36,
  ring,
}: {
  name?: string;
  src?: string;
  size?: number;
  ring?: boolean;
}) {
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // Аватарные градиенты из макета «Графит и мёд» — тёплая гамма, тёмный текст
  const AVATAR_GRADS: Array<[string, string, string]> = [
    ['#F2A65A', '#D97E2A', '#2A1602'],
    ['#E88A6A', '#C75B3C', '#2A0F06'],
    ['#D9BC6A', '#A67B2E', '#241802'],
    ['#9CCB84', '#5F9A4E', '#10250B'],
  ];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [gFrom, gTo, gInk] = AVATAR_GRADS[hash % AVATAR_GRADS.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        fontSize: size * 0.38,
        color: gInk,
        letterSpacing: '-0.02em',
        background: src
          ? `center/cover url(${src})`
          : `linear-gradient(135deg, ${gFrom}, ${gTo})`,
        boxShadow: ring ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)' : 'none',
      }}
    >
      {!src && initials}
    </div>
  );
}

/* Count-up ticker (tabular). Plays on mount / when `play` flips true. */
export function CountUp({
  to,
  duration = 1100,
  prefix = '',
  suffix = '',
  decimals = 0,
  play = true,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  play?: boolean;
}) {
  const [reduceMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [val, setVal] = useState(play && !reduceMotion ? 0 : to);
  const raf = useRef(0);
  useEffect(() => {
    if (!play || reduceMotion) return;

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, play, duration, reduceMotion]);
  const displayedValue = play && !reduceMotion ? val : to;
  const text = displayedValue.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span className="tnum">
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/* Vector confetti burst (transform/opacity only). */
export function Confetti({ fire, count = 26 }: { fire?: boolean; count?: number }) {
  if (!fire) return null;
  const palette = ['var(--accent)', 'var(--success)', 'var(--info)', 'var(--warning)'];
  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = Math.PI * (0.15 + deterministicUnit(i, 1) * 0.7) * -1;
    const dist = 60 + deterministicUnit(i, 2) * 90;
    const cx =
      Math.cos(angle) * dist * (deterministicUnit(i, 3) > 0.5 ? 1 : -1);
    const cy = Math.sin(angle) * dist - 20;
    return {
      i,
      cx,
      cy,
      cr: deterministicUnit(i, 4) * 720 - 360,
      c: palette[i % palette.length],
      delay: deterministicUnit(i, 5) * 80,
      duration: 700 + deterministicUnit(i, 6) * 400,
      w: 5 + deterministicUnit(i, 7) * 5,
      h: 7 + deterministicUnit(i, 8) * 7,
      round: deterministicUnit(i, 9) > 0.6,
    };
  });
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 5 }}>
      <div style={{ position: 'absolute', left: '50%', top: '42%' }}>
        {pieces.map((p) => (
          <span
            key={p.i}
            style={
              {
                position: 'absolute',
                width: p.w,
                height: p.h,
                background: p.c,
                borderRadius: p.round ? '50%' : 2,
                '--cx': p.cx + 'px',
                '--cy': p.cy + 'px',
                '--cr': p.cr + 'deg',
                animation: `rl-confetti ${p.duration}ms var(--ease-out) ${p.delay}ms both`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

/* Loading dots */
export function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            animation: `rl-dot 1.2s var(--ease-out) ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </span>
  );
}
