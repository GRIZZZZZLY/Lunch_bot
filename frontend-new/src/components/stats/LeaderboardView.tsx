import type { StatsLeaderboardData } from './types';

function Delta({ delta }: { delta?: { dir: 'up' | 'dn' | 'eq'; value: string } }) {
  if (!delta) return null;
  const glyph = delta.dir === 'up' ? '↑' : delta.dir === 'dn' ? '↓' : '—';
  return (
    <span className={`dl ${delta.dir}`}>
      {glyph}
      {delta.value}
    </span>
  );
}

export function LeaderboardView({ data }: { data: StatsLeaderboardData }) {
  const [second, first, third] = data.podium;
  return (
    <div className="content">
      <div className="podium">
        <div className="pod second">
          <div className="medal">2</div>
          <div className="av" style={{ background: second.avatarBg, color: second.avatarInk }}>
            {second.initial}
          </div>
          <div className="nm">{second.name}</div>
          <div className="sc">
            {second.score} <span className="pt">очков</span>
          </div>
        </div>
        <div className="pod first">
          <div className="medal">1</div>
          <div className="av" style={{ background: first.avatarBg, color: first.avatarInk }}>
            {first.initial}
          </div>
          <div className="nm">{first.name}</div>
          <div className="sc">
            {first.score} <span className="pt">очков</span>
          </div>
        </div>
        <div className="pod third">
          <div className="medal">3</div>
          <div className="av" style={{ background: third.avatarBg, color: third.avatarInk }}>
            {third.initial}
          </div>
          <div className="nm">{third.name}</div>
          <div className="sc">
            {third.score} <span className="pt">очков</span>
          </div>
        </div>
      </div>

      <div className="rank-list">
        {data.ranks.map((r) => (
          <div key={r.rank} className="rank">
            <div className="rk">{r.rank}</div>
            <div className="av" style={{ background: r.avatarBg }}>
              {r.initial}
            </div>
            <div className="nm">{r.name}</div>
            <div className="sc">{r.score}</div>
            <Delta delta={r.delta} />
          </div>
        ))}
      </div>

      <div className="sticky-me">
        <div className="rk">{data.self.rank}</div>
        <div className="av">{data.self.initial}</div>
        <div className="nm">{data.self.name}</div>
        <div className="sc">{data.self.score}</div>
        <Delta delta={data.self.delta} />
      </div>
    </div>
  );
}
