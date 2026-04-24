import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'active' | 'done' | 'urgent' | 'pending' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  pip?: boolean;
}

const tones: Record<Tone, string> = {
  active: 'text-[#0A3F26] bg-[color-mix(in_oklab,var(--mint-400)_45%,white_10%)] dark:bg-[color-mix(in_oklab,var(--mint-400)_40%,transparent)]',
  done: 'text-[#2D1B5C] bg-[color-mix(in_oklab,var(--lav-400)_40%,transparent)]',
  urgent: 'text-[#5B1410] bg-[color-mix(in_oklab,var(--coral-400)_45%,white_10%)] dark:bg-[color-mix(in_oklab,var(--coral-400)_40%,transparent)]',
  pending: 'text-[#4A3508] bg-[color-mix(in_oklab,var(--butter-400)_45%,white_10%)] dark:bg-[color-mix(in_oklab,var(--butter-400)_40%,transparent)]',
  neutral: 'text-ink-2 bg-[color-mix(in_oklab,var(--ink)_8%,transparent)]',
};

export function Badge({ tone = 'neutral', pip, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-[0.01em] whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {pip ? <span className="size-[5px] rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
