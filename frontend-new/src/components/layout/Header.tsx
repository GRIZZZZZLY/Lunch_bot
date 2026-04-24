import { Bell, Settings, Rocket } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface HeaderProps {
  title?: string;
  right?: ReactNode;
  className?: string;
}

export function Header({ title = 'Rocket Lunch', right, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-14 px-4 flex items-center gap-3',
        'bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] backdrop-blur-nav',
        'border-b border-line',
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="size-8 rounded-[10px] bg-gradient-to-br from-peach-400 to-peach-500 grid place-items-center text-white shadow-[0_4px_12px_rgba(216,106,44,0.35)]">
          <Rocket className="size-4" />
        </div>
        <div className="font-semibold text-[15px] tracking-[-0.01em] text-ink truncate">
          {title}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {right ?? (
          <>
            <button
              aria-label="Уведомления"
              className="relative size-9 rounded-[10px] grid place-items-center text-ink-2 hover:text-ink hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] transition"
            >
              <Bell className="size-[18px]" />
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-coral-500" />
            </button>
            <button
              aria-label="Настройки"
              className="size-9 rounded-[10px] grid place-items-center text-ink-2 hover:text-ink hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] transition"
            >
              <Settings className="size-[18px]" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
