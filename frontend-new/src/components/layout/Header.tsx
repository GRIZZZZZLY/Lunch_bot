import type { ReactNode } from 'react';
import { Icon } from '@/components/rl/Icon';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';

interface HeaderProps {
  title?: string;
  right?: ReactNode;
}

export function Header({ title = 'Rocket Lunch', right }: HeaderProps) {
  return (
    <div className="rl" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
      <header
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          padding: '0 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              flexShrink: 0,
              background: 'var(--accent)',
              color: 'var(--accent-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--accent-glow)',
            }}
          >
            <Icon name="sparkle" size={18} stroke={2} />
          </div>
          <div
            className="font-head tight"
            style={{
              fontWeight: 700,
              fontSize: 'var(--t-16)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
        </div>
        {right ?? <SchemeThemeToggle />}
      </header>
    </div>
  );
}
