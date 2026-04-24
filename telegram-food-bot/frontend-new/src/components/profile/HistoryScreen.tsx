import { useState } from 'react';
import type { HistoryData, HistoryFilter, HistoryFilterKey } from './types';
import '@/styles/profile.css';

const FILTERS: HistoryFilter[] = [
  { key: 'all', label: 'Все' },
  { key: 'won', label: 'Я победил' },
  { key: 'participated', label: 'Я участвовал' },
  { key: 'skipped', label: 'Пропустил' },
];

interface Props {
  data: HistoryData;
  onBack?: () => void;
  onOpenEntry?: (id: string) => void;
}

export function HistoryScreen({ data, onBack, onOpenEntry }: Props) {
  const [filter, setFilter] = useState<HistoryFilterKey>('all');

  return (
    <>
      <div className="top-hdr">
        <div className="back" onClick={onBack}>
          ‹
        </div>
        <div className="ttl">История голосований</div>
        <div className="act">⚙</div>
      </div>
      <div className="chips">
        {FILTERS.map((f) => (
          <span
            key={f.key}
            className={`chip${filter === f.key ? ' on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </span>
        ))}
      </div>
      <div className="content">
        {data.days.map((d, i) => (
          <div key={i}>
            <div className="day-head">{d.label}</div>
            {d.entries.map((e) => (
              <div key={e.id} className="hist-card" onClick={() => onOpenEntry?.(e.id)}>
                <div className={`disc${e.tone && e.tone !== 'default' ? ` ${e.tone}` : ''}`}>
                  {e.emoji}
                </div>
                <div className="md">
                  <div className="nm">{e.name}</div>
                  <div className="ct">Победитель из {e.optionsCount} вариантов</div>
                  <span className={`rib ${e.status}`}>
                    {e.status === 'ok' ? '✓ Вы выбрали' : '✗ Не совпало'}
                  </span>
                </div>
                <div className="rt">
                  <span className="chev">›</span>
                  <span className="cnt">{e.votes} голосов</span>
                </div>
              </div>
            ))}
          </div>
        ))}
        {data.isLoadingMore && (
          <div className="hist-card" style={{ opacity: 0.7 }}>
            <div className="sk circ" />
            <div className="md" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="sk bar" style={{ width: '80%', height: 12 }} />
              <div className="sk bar" style={{ width: '55%', height: 10 }} />
            </div>
            <div className="sk bar" style={{ width: 40, height: 10 }} />
          </div>
        )}
      </div>
    </>
  );
}
