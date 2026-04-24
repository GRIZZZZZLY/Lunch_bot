import { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { VoteOption } from './InlineVotingCard';

export interface WinnerCardProps {
  winnerName: string;
  votes: number;
  totalVotes: number;
  supplier: string;
  deliveryMinutes: number;
  eta: string;
  options?: VoteOption[];
  duty?: {
    initial: string;
    name: string;
    role: string;
    onClick?: () => void;
  };
}

export function WinnerCard({
  winnerName,
  votes,
  totalVotes,
  supplier,
  deliveryMinutes,
  eta,
  options,
  duty,
}: WinnerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = Array.isArray(options) && options.length > 0;

  return (
    <div className="winner-card">
      <div className="crown">👑</div>
      <div className="t">Победил: {winnerName}</div>
      <div className="s">
        {votes} из {totalVotes} голосов · {supplier}
      </div>
      <div className="res">
        <span>Доставка</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {deliveryMinutes} мин · ≈ {eta}
        </span>
      </div>

      {canExpand && (
        <>
          <button
            type="button"
            className="winner-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Скрыть результаты' : 'Показать все результаты'}</span>
            <ChevronDown
              size={14}
              style={{
                transition: 'transform 200ms',
                transform: expanded ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>

          {expanded && (
            <div className="winner-results">
              {[...options!]
                .sort((a, b) => b.votes - a.votes)
                .map((o, i) => {
                  const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                  const isWinner = o.name === winnerName;
                  return (
                    <div key={o.id} className={`opt result${isWinner ? ' mine' : ''}`}>
                      <div className="emj" style={{ background: `var(--g-${o.palette})` }}>
                        {o.emoji}
                      </div>
                      <div className="bar-wrap">
                        <div className="bar-head">
                          <div className="n">
                            {o.name}
                            {isWinner && (
                              <span className="tag" style={{ marginLeft: 6 }}>
                                👑 победитель
                              </span>
                            )}
                          </div>
                          <div className="pct">{pct}%</div>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${pct}%`, animationDelay: `${i * 60}ms` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {duty && (
        <button
          type="button"
          className="duty-banner"
          onClick={duty.onClick}
          style={{ width: '100%', border: 0, cursor: 'pointer' }}
        >
          <div className="av">{duty.initial}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div className="t" style={{ fontSize: 13, marginTop: 0 }}>
              Сегодня дежурит: {duty.name}
            </div>
            <div className="s" style={{ marginTop: 0 }}>
              {duty.role}
            </div>
          </div>
          <ArrowRight size={14} color="#2E1F56" />
        </button>
      )}
    </div>
  );
}
