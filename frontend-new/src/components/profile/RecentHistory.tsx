import type { RecentPollItem } from './types';

interface Props {
  items: RecentPollItem[];
  onSeeAll?: () => void;
}

export function RecentHistory({ items, onSeeAll }: Props) {
  return (
    <>
      <div className="sec">
        <div className="tt">Ваша история голосований</div>
        <button type="button" className="lnk" onClick={onSeeAll}>
          Вся история →
        </button>
      </div>
      <div className="card" style={{ padding: 4 }}>
        {items.map((it) => (
          <div key={it.id} className="poll-row">
            <div className={`pic${it.tone && it.tone !== 'default' ? ` ${it.tone}` : ''}`}>
              {it.emoji}
            </div>
            <div className="md">
              <div className="d">{it.date}</div>
              <div className="nm">{it.name}</div>
            </div>
            <span className={`rb ${it.status}`}>
              {it.status === 'ok' ? 'Вы выбрали ✓' : 'Вы пропустили'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
