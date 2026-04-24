import type { StatsInsightsData } from './types';

export function InsightsView({ data }: { data: StatsInsightsData }) {
  return (
    <div className="content">
      {data.insights.map((ins) => (
        <div key={ins.id} className={`insight ${ins.tone}`}>
          <div className="em">{ins.emoji}</div>
          <div className="tx">
            <div className="tt">{ins.title}</div>
            <div className="cta">{ins.cta}</div>
          </div>
          <div className="chev">›</div>
        </div>
      ))}
      {data.dishOfMonth && (
        <div className="dom">
          <div className="media">
            <span className="pill">Блюдо месяца</span>
            <span className="plate">{data.dishOfMonth.emoji}</span>
          </div>
          <div className="body">
            <div className="nm">{data.dishOfMonth.name}</div>
            <div className="mt">{data.dishOfMonth.meta}</div>
            <div className="go">Открыть детали →</div>
          </div>
        </div>
      )}
    </div>
  );
}
