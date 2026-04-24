import type { ProfileStatsTriple } from './types';

export function ProfileStats3({ stats }: { stats: ProfileStatsTriple }) {
  return (
    <div className="card">
      <div className="stats3">
        <div className="col">
          <div className="n">{stats.polls}</div>
          <div className="l">опросов</div>
        </div>
        <div className="col">
          <div className="n">{stats.wins}</div>
          <div className="l">побед</div>
        </div>
        <div className="col">
          <div className="n">{stats.activity}</div>
          <div className="l">активность</div>
        </div>
      </div>
    </div>
  );
}
