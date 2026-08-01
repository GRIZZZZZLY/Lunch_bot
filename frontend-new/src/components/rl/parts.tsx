/* ROCKET LUNCH — shared widget parts (redesign v2, TS)
   Ported from "Redisign v2/src/widgets1.jsx". */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Avatar, IconButton } from './primitives';

export function BackHeader({
  title,
  onBack,
  action,
}: {
  title: ReactNode;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 12px' }}>
      <IconButton
        variant="ghost"
        name="chevronRight"
        aria-label="Назад"
        onClick={onBack}
        style={{ transform: 'rotate(180deg)' }}
      />
      <h1 className="font-head tight" style={{ margin: 0, flex: 1, fontSize: 'var(--text-18)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </h1>
      {action}
    </div>
  );
}

export function CircularTimer({
  remaining = 0,
  total = 600,
  size = 58,
}: {
  remaining?: number;
  total?: number;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, remaining / total));
  const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const low = remaining <= 60;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--divider)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={low ? 'var(--danger)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke var(--motion-base)' }}
        />
      </svg>
      <div
        className="tnum font-head"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size > 50 ? 14 : 12,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: low ? 'var(--danger)' : 'var(--text-primary)',
        }}
      >
        {mm}:{ss}
      </div>
    </div>
  );
}

export function AvatarStack({
  people = [],
  max = 4,
  size = 24,
}: {
  people?: string[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <div key={i} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--surface)' }}>
          <Avatar name={p} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="tnum"
          style={{
            marginLeft: -8,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--canvas)',
            boxShadow: '0 0 0 2px var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-secondary)',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

export function Trophy({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        flexShrink: 0,
        background: 'var(--accent-tint)',
        color: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="crown" size={size * 0.5} stroke={1.9} />
    </div>
  );
}

export function SectionTitle({
  icon,
  children,
  right,
}: {
  icon?: IconName;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {icon && <Icon name={icon} size={18} style={{ color: 'var(--text-secondary)' }} />}
      <h3
        className="font-head"
        style={{ margin: 0, fontSize: 'var(--text-16)', fontWeight: 600, letterSpacing: '-0.02em', flex: 1 }}
      >
        {children}
      </h3>
      {right}
    </div>
  );
}
