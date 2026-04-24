import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-semibold rounded-[12px] border border-transparent cursor-pointer ' +
  'transition-[transform,background,box-shadow] duration-150 select-none leading-none ' +
  'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

const sizes: Record<Size, string> = {
  sm: 'text-xs px-3 py-[7px] rounded-[10px]',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-[15px] px-5 py-3.5 rounded-[14px]',
};

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-peach-400 to-peach-500 text-white shadow-[0_6px_18px_rgba(216,106,44,0.35)] ' +
    'hover:shadow-[0_8px_22px_rgba(216,106,44,0.45)]',
  secondary:
    'bg-surface text-ink border-line hover:border-line-2',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]',
  destructive:
    'bg-coral-500 text-white shadow-[0_6px_18px_rgba(229,90,79,0.35)] hover:bg-coral-600',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      ) : null}
      {children}
    </button>
  );
});
