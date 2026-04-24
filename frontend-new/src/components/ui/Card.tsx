import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'pastel-peach' | 'pastel-lav' | 'pastel-sage';
}

const variants = {
  default:
    'bg-[image:var(--card-grad)] border border-line shadow-card',
  glass:
    'bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] backdrop-blur-nav border border-line shadow-card',
  'pastel-peach': 'bg-grad-peach text-[#3D2012] shadow-elev border-0',
  'pastel-lav': 'bg-grad-lav text-[#2D1B5C] shadow-elev border-0',
  'pastel-sage': 'bg-grad-sage text-[#0E3D26] shadow-elev border-0',
} as const;

export function Card({ variant = 'default', className, children, ...rest }: CardProps) {
  return (
    <div className={cn('rounded-[16px] p-3.5', variants[variant], className)} {...rest}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function CardHeader({ icon, title, subtitle, right }: CardHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      {icon ? (
        <div className="size-8 rounded-[10px] bg-grad-lav grid place-items-center text-base">
          {icon}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm tracking-[-0.005em] truncate">{title}</div>
        {subtitle ? <div className="text-xs text-ink-2 mt-0.5 truncate">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}
