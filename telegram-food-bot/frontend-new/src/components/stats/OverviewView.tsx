import type { StatsOverviewData } from './types';

export function OverviewView({ data }: { data: StatsOverviewData }) {
  const { dna, donut, tiles, fin } = data;
  return (
    <div className="content">
      {/* DNA hero */}
      <div className="dna">
        <div className="wm" aria-hidden>
          🧬
        </div>
        <div className="dna-head">
          <span className="badge">🧬 DNA</span>
        </div>
        <div className="dna-title">{dna.title}</div>
        <div className="dna-sub">{dna.subtitle}</div>
        <div className="dna-stats">
          {dna.stats.map((s, i) => (
            <div key={i} className="dna-stat">
              <div className="dna-ring" style={{ ['--p' as any]: s.ringPct }}>
                <span className="em">{s.emoji}</span>
              </div>
              <div className="val">{s.value}</div>
              <div className="lbl">{s.label}</div>
              <span className="pct">{s.pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Donut card */}
      <div className="card">
        <div className="ch">
          <div className="tt">Ваши предпочтения</div>
          <div className="sb">{donut.subtitle}</div>
        </div>
        <div className="donut-row">
          <div className="donut">
            <div className="center">
              <div>
                <div className="n">{donut.total}</div>
                <div className="l">{donut.totalLabel}</div>
              </div>
            </div>
          </div>
          <div className="legend">
            {donut.legend.map((lg, i) => (
              <div key={i} className="lg-row">
                <span className="lg-sw" style={{ background: lg.color }} />
                <span className="nm">{lg.name}</span>
                <span className="pc">{lg.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Line chart card */}
      <div className="card">
        <div className="ch">
          <div className="tt">Активность голосований</div>
          <div className="sb">30 дней</div>
        </div>
        <div className="chart-wrap">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rl-chart-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#FF9D66" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#FF9D66" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 72 L20 62 L40 68 L60 48 L80 58 L100 42 L120 50 L140 34 L160 44 L180 26 L200 40 L220 22 L240 36 L260 18 L280 30 L300 20 L300 100 L0 100 Z"
              fill="url(#rl-chart-area)"
            />
            <path
              d="M0 72 L20 62 L40 68 L60 48 L80 58 L100 42 L120 50 L140 34 L160 44 L180 26 L200 40 L220 22 L240 36 L260 18 L280 30 L300 20"
              fill="none"
              stroke="#FF9D66"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="chart-dot" />
          <div className="chart-tip">18 мар · 9 голосов</div>
        </div>
        <div className="chart-x">
          <span>1 мар</span>
          <span>8</span>
          <span>15</span>
          <span>22</span>
          <span>сегодня</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="stat-grid">
        {tiles.map((t, i) => (
          <div key={i} className={`stat-tile${t.tone && t.tone !== 'default' ? ` ${t.tone}` : ''}`}>
            <div className="ic">{t.icon}</div>
            <div className="num">{t.num}</div>
            <div className="lb">{t.label}</div>
          </div>
        ))}
      </div>

      {/* Fin insights */}
      <div className="fin">
        <div className="fin-head">
          <span className="em">💰</span>
          <span className="tt">{fin.title}</span>
        </div>
        <div className="fin-rows">
          {fin.rows.map((r, i) => (
            <div key={i} className={`fin-row${r.tone && r.tone !== 'balance' ? ` ${r.tone}` : ''}`}>
              <span className="lb">{r.label}</span>
              <span className="vl">
                {r.tone === 'up' && <span className="arr">↑</span>}
                {r.tone === 'dn' && <span className="arr">↓</span>}
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
