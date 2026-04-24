import type { StatsPeriod, StatsTab } from './types';

interface Props {
  period: StatsPeriod;
  onPeriodChange: (p: StatsPeriod) => void;
  tab: StatsTab;
  onTabChange: (t: StatsTab) => void;
}

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'all', label: 'Всё время' },
];

const TABS: { key: StatsTab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'insights', label: 'Инсайты' },
  { key: 'leaderboard', label: 'Лидерборд' },
];

export function StatsTopBar({ period, onPeriodChange, tab, onTabChange }: Props) {
  return (
    <>
      <div className="top-hdr">
        <div className="ttl">Статистика</div>
        <div className="act">⋮</div>
      </div>
      <div className="period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={period === p.key ? 'on' : ''}
            onClick={() => onPeriodChange(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="main-tabs">
        {TABS.map((t) => (
          <div
            key={t.key}
            className={`tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => onTabChange(t.key)}
            role="tab"
            aria-selected={tab === t.key}
          >
            {t.label}
          </div>
        ))}
      </div>
    </>
  );
}
