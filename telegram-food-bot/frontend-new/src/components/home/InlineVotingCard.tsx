import { Clock, Utensils } from 'lucide-react';

type GradKey = 'peach' | 'lav' | 'sage' | 'sky' | 'rose';

export interface VoteOption {
  id: string | number;
  emoji: string;
  name: string;
  price: number;
  minutes: number;
  votes: number;
  palette: GradKey;
}

interface Common {
  pollNumber: number | string;
  subtitle: string;
  participantsText: string;
  countdown: string;
  urgent?: boolean;
}

/* ---- Empty state ---- */
interface EmptyProps {
  kind: 'empty';
  onCreate?: () => void;
}

/* ---- Active voting (not voted) ---- */
interface ActiveProps extends Common {
  kind: 'active';
  options: VoteOption[];
  selectedId: VoteOption['id'] | null;
  onSelect: (id: VoteOption['id']) => void;
  onVote: () => void;
}

/* ---- Voted (live results) ---- */
interface VotedProps extends Common {
  kind: 'voted';
  options: VoteOption[];
  myChoiceId: VoteOption['id'];
  totalVotes: number;
  onChange?: () => void;
  onWithdraw?: () => void;
}

export type InlineVotingCardProps = EmptyProps | ActiveProps | VotedProps;

export function InlineVotingCard(props: InlineVotingCardProps) {
  if (props.kind === 'empty') {
    return (
      <div className="vote-card">
        <div className="empty-vc anim-pop">
          <div className="blob">
            <Utensils size={40} strokeWidth={2} color="#3D2012" />
          </div>
          <div className="t">Пока нет активного голосования</div>
          <div className="s">Запустите опрос, чтобы выбрать обед всей командой.</div>
          <button
            className="btn primary"
            style={{ marginTop: 6 }}
            onClick={props.onCreate}
          >
            Создать опрос
          </button>
        </div>
      </div>
    );
  }

  const { pollNumber, subtitle, participantsText, countdown, urgent } = props;

  return (
    <div className="vote-card peach">
      <div className="vc-head">
        <div className="vc-title">
          <div className="ic">🗳</div>
          <div>
            <div className="t">Голосование: Обед</div>
            <div className="s">
              #{pollNumber} · {subtitle}
            </div>
          </div>
        </div>
        <span className={`countdown${urgent ? ' urgent' : ''}`}>
          <Clock size={11} strokeWidth={2} />
          {countdown}
        </span>
      </div>

      <div className="vc-meta">
        <span>{participantsText}</span>
        <span className="live">
          <span className="pip" />
          live
        </span>
      </div>

      {props.kind === 'active' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {props.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`opt${props.selectedId === o.id ? ' selected' : ''}`}
                onClick={() => props.onSelect(o.id)}
                style={{ textAlign: 'left', border: 'none', background: 'inherit', width: '100%' }}
              >
                <div className="emj" style={{ background: `var(--g-${o.palette})` }}>
                  {o.emoji}
                </div>
                <div className="info">
                  <div className="n">{o.name}</div>
                  <div className="m">
                    {o.price}₽ · {o.minutes} min · {o.votes} {o.votes === 1 ? 'vote' : 'votes'}
                  </div>
                </div>
                <div className="radio" />
              </button>
            ))}
          </div>
          <button
            className="btn primary wide"
            style={{ marginTop: 4 }}
            disabled={props.selectedId == null}
            onClick={props.onVote}
          >
            {props.selectedId != null
              ? `Проголосовать за ${props.options.find((o) => o.id === props.selectedId)?.name ?? ''}`
              : 'Выберите вариант'}
          </button>
        </>
      ) : (
        <>
          <ResultsList
            options={props.options}
            myChoiceId={props.myChoiceId}
            totalVotes={props.totalVotes}
          />
          <VotedFooter
            chosenName={props.options.find((o) => o.id === props.myChoiceId)?.name ?? ''}
            onChange={props.onChange}
            onWithdraw={props.onWithdraw}
          />
        </>
      )}
    </div>
  );
}

function ResultsList({
  options,
  myChoiceId,
  totalVotes,
}: {
  options: VoteOption[];
  myChoiceId: VoteOption['id'];
  totalVotes: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((o, i) => {
        const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
        const isMine = o.id === myChoiceId;
        return (
          <div key={o.id} className={`opt result${isMine ? ' mine' : ''}`}>
            <div className="emj" style={{ background: `var(--g-${o.palette})` }}>
              {o.emoji}
            </div>
            <div className="bar-wrap">
              <div className="bar-head">
                <div className="n">
                  {o.name}
                  {isMine && <span className="tag" style={{ marginLeft: 6 }}>✓ ваш выбор</span>}
                </div>
                <div className="pct">{pct}%</div>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${pct}%`, animationDelay: `${i * 60}ms` }}
                />
              </div>
              <div className="m" style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
                {o.votes} {voteWord(o.votes)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VotedFooter({
  chosenName,
  onChange,
  onWithdraw,
}: {
  chosenName: string;
  onChange?: () => void;
  onWithdraw?: () => void;
}) {
  return (
    <div className="voted-footer">
      <div className="check">✓</div>
      <div className="txt">
        Вы проголосовали за <b>{chosenName}</b>.
      </div>
      <div className="voted-actions">
        {onChange && (
          <button type="button" className="change" onClick={onChange}>
            Изменить
          </button>
        )}
        {onWithdraw && (
          <button type="button" className="change withdraw" onClick={onWithdraw}>
            Отозвать
          </button>
        )}
      </div>
    </div>
  );
}

function voteWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'голос';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'голоса';
  return 'голосов';
}
