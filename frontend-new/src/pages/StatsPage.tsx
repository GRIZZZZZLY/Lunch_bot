import type { ReactNode } from 'react';
import { useStats } from '@/hooks/useStats';
import { useAuth } from '@/hooks/useAuth';
import { Icon, type IconName } from '@/components/rl/Icon';
import { Avatar, CountUp } from '@/components/rl/primitives';
import { SectionTitle } from '@/components/rl/parts';

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function legendColor(i: number): string {
  if (i === 0) return 'var(--accent)';
  return `color-mix(in srgb, var(--accent) ${Math.max(22, 72 - i * 14)}%, var(--bg-base))`;
}

function Stack({ children }: { children: ReactNode[] }) {
  return (
    <div className="rl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 20px 16px' }}>
        {children.filter(Boolean).map((node, i) => (
          <div key={i} className="anim-rise" style={{ animationDelay: `${Math.min(i * 55, 330)}ms` }}>
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}

const TILE_ICONS: IconName[] = ['sparkle', 'crown', 'clock', 'flame'];
const TILE_TONES = ['accent', 'success', 'warning', 'info'] as const;

export function StatsPage() {
  const { data } = useStats();
  const { user } = useAuth();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Гость';

  if (data.isLoading) {
    return (
      <Stack>
        {[
          <div key="a" className="card" style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 48, width: '60%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 64 }} />
          </div>,
          <div key="b" className="card" style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 120 }} />
          </div>,
        ]}
      </Stack>
    );
  }

  if (data.isEmpty || !data.overview) {
    return (
      <Stack>
        {[
          <div key="e" className="card" style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--bg-base)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
              <Icon name="stats" size={28} />
            </div>
            <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600 }}>
              Пока нет статистики
            </div>
            <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', maxWidth: 240, lineHeight: 1.5 }}>
              Поучаствуйте в голосованиях — здесь появится ваш профиль обеда.
            </p>
          </div>,
        ]}
      </Stack>
    );
  }

  const ov = data.overview;
  const pollsCount = num(ov.tiles[0]?.num);
  const wins = num(ov.tiles[1]?.num);
  const winRate = num(ov.dna.stats[2]?.value);
  const favName = ov.dna.stats[0]?.value ?? '—';
  const favPct = num(ov.dna.stats[0]?.pct);
  const total = ov.donut.total;
  const legend = ov.donut.legend.map((l, i) => ({ name: l.name, pct: num(l.pct), color: legendColor(i) }));
  const insight = data.insights?.insights?.[0];

  return (
    <Stack>
      {[
        /* hero + stat chips */
        <div key="hero" className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Avatar name={name} size={48} ring />
            <div style={{ minWidth: 0 }}>
              <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
              <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>Ваш профиль обеда</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <StatChip value={<CountUp to={pollsCount} />} label="Голосований" accent />
            <StatChip value={<CountUp to={wins} />} label="Побед выбора" />
            <StatChip value={<CountUp to={winRate} suffix="%" />} label="За победителя" />
          </div>
        </div>,

        /* favorite dish */
        <div key="fav" className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="heart" size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Любимое блюдо</div>
            <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {favName}
            </div>
          </div>
          <div className="tnum font-head" style={{ fontSize: 'var(--t-22)', fontWeight: 700, color: 'var(--accent)' }}>{favPct}%</div>
        </div>,

        /* summary tiles */
        <div key="tiles">
          <SectionTitle icon="sparkle">Сводка</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ov.tiles.map((t, i) => (
              <div key={i} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: `var(--${TILE_TONES[i % TILE_TONES.length]}-tint)`,
                    color: `var(--${TILE_TONES[i % TILE_TONES.length]})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={TILE_ICONS[i % TILE_ICONS.length]} size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="tnum font-head" style={{ fontSize: 'var(--t-18)', fontWeight: 700 }}>{t.num}</div>
                  <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', lineHeight: 1.2 }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>,

        /* lunch DNA distribution */
        legend.length > 0 ? (
          <div key="dna" className="card" style={{ padding: 20 }}>
            <SectionTitle icon="stats" right={<span className="tnum" style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>{total} голосов</span>}>
              ДНК обедов
            </SectionTitle>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 14, background: 'var(--border-subtle)' }}>
              {legend.map((l) => (
                <div key={l.name} style={{ width: `${l.pct}%`, background: l.color }} title={l.name} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {legend.map((l) => (
                <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} />
                  {l.name} <span className="tnum" style={{ color: 'var(--text-tertiary)' }}>{l.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : null,

        /* insight */
        insight ? (
          <div key="insight" className="card" style={{ padding: 20, display: 'flex', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--t-15)', lineHeight: 1.45 }}>{insight.title}</div>
              {data.insights?.dishOfMonth && (
                <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', marginTop: 4 }} className="tnum">
                  {data.insights.dishOfMonth.meta}
                </div>
              )}
            </div>
          </div>
        ) : null,
      ]}
    </Stack>
  );
}

function StatChip({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, padding: 14, borderRadius: 'var(--r-block)', background: accent ? 'var(--accent-tint)' : 'var(--bg-base)' }}>
      <div className="font-head tnum tight" style={{ fontSize: 'var(--t-22)', fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
