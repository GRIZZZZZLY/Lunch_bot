/* ROCKET LUNCH — HOME WIDGETS (redesign v2, prop-driven, TS)
   Presentational; HomePage feeds real hook/API data.
   Ported from "Redisign v2/src/widgets1.jsx" + "widgets2.jsx". */
import { Icon } from './Icon';
import { Avatar, Badge, Button, Confetti, CountUp, IconButton, Spinner } from './primitives';
import { AvatarStack, CircularTimer, SectionTitle, Trophy } from './parts';

/* ---------------- HomeHeroCard ---------------- */
export function HomeHeroCard({
  greet,
  name,
  headline = (
    <>
      Время решать, что
      <br />
      заказываем сегодня
    </>
  ),
  activeCount = 0,
  teamCount,
  loading,
}: {
  greet?: string;
  name?: string;
  headline?: React.ReactNode;
  activeCount?: number;
  teamCount?: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton" style={{ height: 12, width: '30%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 26, width: '75%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '55%' }} />
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -30,
          top: -30,
          width: 130,
          height: 130,
          borderRadius: '50%',
          background: 'var(--accent-tint)',
          opacity: 0.6,
          filter: 'blur(2px)',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4 }}>
          {greet}
          {name ? `, ${name}` : ''}
        </div>
        <h2 className="font-head tight" style={{ margin: 0, fontSize: 'var(--t-22)', fontWeight: 700, lineHeight: 1.15 }}>
          {headline}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {activeCount > 0 && (
            <Badge tone="accent" icon="flame">
              {activeCount} активное
            </Badge>
          )}
          {teamCount != null && (
            <Badge tone="neutral" icon="users">
              {teamCount} в команде
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ActivePollWidget ---------------- */
export interface PollOptionVM {
  id: number;
  name: string;
  votes: number;
  voters?: string[];
}

export interface ActivePollWidgetProps {
  title: string;
  options: PollOptionVM[];
  totalVotes: number;
  teamCount?: number;
  remaining: number; // seconds
  total: number; // seconds
  selectedId: number | null;
  myChoiceId: number | null;
  hasVoted: boolean;
  onSelect: (id: number) => void;
  onVote: () => void;
  onWithdraw?: () => void;
  voting?: boolean;
  isAdmin?: boolean;
  adminOpen?: boolean;
  onToggleAdmin?: () => void;
  onCloseEarly?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export function ActivePollWidget(props: ActivePollWidgetProps) {
  const {
    title,
    options,
    totalVotes,
    teamCount,
    remaining,
    total,
    selectedId,
    myChoiceId,
    hasVoted,
    onSelect,
    onVote,
    onWithdraw,
    voting,
    isAdmin,
    adminOpen,
    onToggleAdmin,
    onCloseEarly,
    onCancel,
    loading,
  } = props;

  if (loading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 22, width: '80%', marginBottom: 20 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 6, width: '100%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const chosenId = hasVoted ? myChoiceId : selectedId;
  const chosenName = options.find((o) => o.id === myChoiceId)?.name;

  return (
    <div className="card" style={{ padding: 20, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <Badge tone="accent" icon="flame">
            Идёт голосование
          </Badge>
          <h3 className="font-head tight" style={{ margin: '10px 0 2px', fontSize: 'var(--t-18)', fontWeight: 700 }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>
            <span className="tnum">{totalVotes}</span> голосов{teamCount != null ? <> · {teamCount} в команде</> : null}
          </p>
        </div>
        <CircularTimer remaining={remaining} total={total} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((d) => {
          const v = d.votes;
          const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
          const isMine = chosenId === d.id;
          return (
            <div
              key={d.id}
              className={'dish-row' + (isMine ? ' is-voted' : '')}
              onClick={() => !hasVoted && onSelect(d.id)}
              role="button"
              tabIndex={0}
            >
              <button className={'qvote' + (isMine ? ' on' : '')} aria-label={'Голосовать за ' + d.name}>
                {isMine ? <Icon name="check" size={16} stroke={2.4} /> : <Icon name="plus" size={16} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--t-15)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {d.name}
                  </span>
                  <span
                    className="tnum font-head"
                    style={{
                      fontSize: 'var(--t-15)',
                      fontWeight: 600,
                      color: isMine ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {v}
                  </span>
                </div>
                <div className="votebar">
                  <i style={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }} />
                </div>
              </div>
              {d.voters && d.voters.length > 0 && <AvatarStack people={d.voters} max={3} size={22} />}
            </div>
          );
        })}
      </div>

      {hasVoted ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            padding: '10px 14px',
            background: 'var(--success-tint)',
            borderRadius: 'var(--r-block)',
            color: 'var(--success)',
            fontSize: 'var(--t-13)',
            fontWeight: 600,
          }}
        >
          <Icon name="check" size={16} stroke={2.2} /> Ваш голос учтён{chosenName ? ` · «${chosenName}»` : ''}
          {onWithdraw && (
            <Button variant="link" size="sm" style={{ marginLeft: 'auto' }} onClick={onWithdraw}>
              Изменить
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button
            variant="primary"
            icon="check"
            disabled={selectedId == null}
            loading={voting}
            onClick={onVote}
            style={{ flex: 1 }}
          >
            {selectedId != null ? 'Подтвердить голос' : 'Выберите блюдо'}
          </Button>
          {isAdmin && (
            <IconButton variant="secondary" name="gear" aria-label="Администрирование" onClick={onToggleAdmin} />
          )}
        </div>
      )}

      {isAdmin && adminOpen && !hasVoted && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 10,
              color: 'var(--text-tertiary)',
              fontSize: 'var(--t-11)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <Icon name="gear" size={14} /> Администрирование
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" icon="check" style={{ flex: 1 }} onClick={onCloseEarly}>
              Закрыть досрочно
            </Button>
            <Button variant="danger" size="sm" icon="x" style={{ flex: 1 }} onClick={onCancel}>
              Отменить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- CompletedPollWidget ---------------- */
export interface CompletedRankItem {
  name: string;
  votes: number;
}

export interface CompletedPollWidgetProps {
  winnerName: string;
  winnerVotes: number;
  totalVotes: number;
  ranking?: CompletedRankItem[];
  voters?: string[];
  collapsed: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onCancel?: () => void;
  onDetails?: () => void;
}

export function CompletedPollWidget({
  winnerName,
  winnerVotes,
  totalVotes,
  ranking = [],
  voters = [],
  collapsed,
  onToggle,
  isAdmin,
  onCancel,
  onDetails,
}: CompletedPollWidgetProps) {
  const pctWinner = totalVotes > 0 ? Math.round((winnerVotes / totalVotes) * 100) : 0;

  if (collapsed) {
    return (
      <button
        className="card press"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          borderRadius: 999,
        }}
      >
        <Trophy size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Победитель</div>
          <div
            className="font-head"
            style={{
              fontSize: 'var(--t-15)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {winnerName}
          </div>
        </div>
        <Icon name="chevronDown" size={20} style={{ color: 'var(--text-tertiary)' }} />
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Badge tone="success" icon="check">
          Голосование завершено
        </Badge>
        <IconButton variant="ghost" size="sm" name="chevronUp" aria-label="Свернуть" onClick={onToggle} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Trophy size={52} />
        <div>
          <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 2 }}>
            Победитель
          </div>
          <div className="font-head tight" style={{ fontSize: 'var(--t-22)', fontWeight: 700, lineHeight: 1.1 }}>
            {winnerName}
          </div>
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)', marginTop: 4 }} className="tnum">
            {winnerVotes} из {totalVotes} голосов · {pctWinner}%
          </div>
        </div>
      </div>
      {ranking.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ranking.slice(0, 3).map((d, i) => {
            const pct = totalVotes > 0 ? Math.round((d.votes / totalVotes) * 100) : 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{ width: 18, fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', fontWeight: 700 }}
                  className="tnum font-head"
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 'var(--t-13)' }}>{d.name}</span>
                <div className="votebar" style={{ width: 70 }}>
                  <i
                    style={{
                      transform: `scaleX(${pct / 100})`,
                      background: i === 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}
                  />
                </div>
                <span
                  className="tnum"
                  style={{ width: 22, textAlign: 'right', fontSize: 'var(--t-13)', color: 'var(--text-secondary)', fontWeight: 600 }}
                >
                  {d.votes}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {voters.length > 0 && <AvatarStack people={voters} max={4} size={26} />}
          <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>проголосовали</span>
        </div>
        {isAdmin && onCancel ? (
          <Button variant="ghost" size="sm" icon="refresh" style={{ color: 'var(--danger)' }} onClick={onCancel}>
            Отменить
          </Button>
        ) : onDetails ? (
          <Button variant="link" size="sm" onClick={onDetails}>
            Подробнее
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- BudgetWidget (real-wired subset) ---------------- */
function Money({ value, sign, big }: { value: number; sign?: string; big?: boolean }) {
  return (
    <span
      className="tnum font-head"
      style={{ fontWeight: 700, letterSpacing: '-0.03em', fontSize: big ? 'var(--t-28)' : 'inherit' }}
    >
      {sign}
      <CountUp to={Math.abs(value)} play={false} suffix=" ₽" />
    </span>
  );
}

export type BudgetScenario = 'hidden' | 'overview' | 'urgent' | 'awaiting' | 'success' | 'collector';

export interface BudgetCreditor {
  name: string;
  amount: number;
  status: string;
}

export interface BudgetWidgetProps {
  scenario: BudgetScenario;
  youOwe: number;
  owedToYou: number;
  urgentCreditorName?: string;
  urgentAmount?: number;
  creditors?: BudgetCreditor[];
  collected?: number;
  collectTotal?: number;
  onPaySbp?: () => void;
  onRemind?: (name: string) => void;
  onExpand?: () => void;
}

export function BudgetWidget({
  scenario,
  youOwe,
  owedToYou,
  urgentCreditorName,
  urgentAmount = 0,
  creditors = [],
  collected = 0,
  collectTotal,
  onPaySbp,
  onRemind,
  onExpand,
}: BudgetWidgetProps) {
  if (scenario === 'hidden') {
    return (
      <button
        className="card press"
        onClick={onExpand}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="wallet" size={19} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>
            Бюджет команды
          </div>
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>Нет активных расчётов</div>
        </div>
        <Icon name="chevronDown" size={20} style={{ color: 'var(--text-tertiary)' }} />
      </button>
    );
  }

  const header = (right?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon name="wallet" size={20} style={{ color: 'var(--text-secondary)' }} />
      <h3 className="font-head" style={{ margin: 0, fontSize: 'var(--t-16)', fontWeight: 600, flex: 1 }}>
        Бюджет команды
      </h3>
      {right}
    </div>
  );

  if (scenario === 'urgent' || scenario === 'awaiting') {
    const isPaid = scenario === 'awaiting';
    return (
      <div className="card" style={{ padding: 20, borderColor: isPaid ? 'var(--border-subtle)' : 'var(--border-strong)' }}>
        {header(
          isPaid ? (
            <Badge tone="warning" icon="clock">
              Ожидание
            </Badge>
          ) : (
            <Badge tone="danger" icon="alert">
              Новое
            </Badge>
          ),
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <Avatar name={urgentCreditorName ?? '?'} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>
              Вы должны{urgentCreditorName ? ` ${urgentCreditorName}` : ''} за обед
            </div>
            <div style={{ color: isPaid ? 'var(--text-secondary)' : 'var(--danger)' }}>
              <Money value={urgentAmount} big />
            </div>
          </div>
        </div>
        {isPaid ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              borderRadius: 'var(--r-block)',
              background: 'var(--warning-tint)',
              color: 'var(--warning)',
              fontSize: 'var(--t-13)',
              fontWeight: 600,
            }}
          >
            <Spinner size={16} /> Ждём подтверждения{urgentCreditorName ? ` от ${urgentCreditorName}` : ''}
          </div>
        ) : (
          <Button variant="primary" icon="bank" style={{ width: '100%' }} onClick={onPaySbp}>
            Оплатить через СБП
          </Button>
        )}
      </div>
    );
  }

  if (scenario === 'success') {
    return (
      <div className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
        <Confetti fire />
        {header()}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 0 6px' }}>
          <div className="anim-pop" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-tint)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="check" size={32} stroke={2.2} />
          </div>
          <div className="font-head tight" style={{ fontSize: 'var(--t-18)', fontWeight: 700 }}>
            Оплата подтверждена
          </div>
        </div>
      </div>
    );
  }

  if (scenario === 'collector') {
    const total = collectTotal ?? owedToYou;
    return (
      <div className="card" style={{ padding: 20 }}>
        {header(
          <Badge tone="accent" icon="users">
            Вы собираете
          </Badge>,
        )}
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>Собрано</span>
          <span>
            <span className="tnum font-head" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              {collected}
            </span>
            <span className="tnum" style={{ color: 'var(--text-tertiary)' }}>
              {' '}
              / {total} ₽
            </span>
          </span>
        </div>
        <div className="votebar" style={{ height: 8, marginBottom: 16 }}>
          <i style={{ transform: `scaleX(${total > 0 ? Math.min(1, collected / total) : 0})` }} />
        </div>
        {creditors.length > 0 && (
          <div className="row-divider" style={{ borderRadius: 'var(--r-block)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {creditors.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                <Avatar name={d.name} size={30} />
                <span style={{ flex: 1, fontSize: 'var(--t-15)', fontWeight: 500 }}>{d.name}</span>
                <span className="tnum" style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)', marginRight: 4 }}>
                  {d.amount} ₽
                </span>
                {d.status === 'CONFIRMED' && (
                  <Badge tone="success" icon="check">
                    Оплатил
                  </Badge>
                )}
                {d.status === 'PAID' && (
                  <Badge tone="warning" icon="clock">
                    Ждём
                  </Badge>
                )}
                {d.status === 'PENDING' && (
                  <Button variant="ghost" size="sm" icon="bell" onClick={() => onRemind?.(d.name)}>
                    Напомнить
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // overview
  const balance = owedToYou - youOwe;
  return (
    <div className="card" style={{ padding: 20 }}>
      {header(<Badge tone="neutral">Этот месяц</Badge>)}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: 14, borderRadius: 'var(--r-block)', background: 'var(--success-tint)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--t-11)',
              color: 'var(--success)',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <Icon name="arrowRight" size={13} style={{ transform: 'rotate(-90deg)' }} /> Вам должны
          </div>
          <div style={{ color: 'var(--success)' }}>
            <Money value={owedToYou} />
          </div>
        </div>
        <div style={{ flex: 1, padding: 14, borderRadius: 'var(--r-block)', background: 'var(--danger-tint)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--t-11)',
              color: 'var(--danger)',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <Icon name="arrowRight" size={13} style={{ transform: 'rotate(90deg)' }} /> Вы должны
          </div>
          <div style={{ color: 'var(--danger)' }}>
            <Money value={youOwe} />
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          borderRadius: 'var(--r-block)',
          background: 'var(--bg-base)',
        }}
      >
        <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>Итоговый баланс</span>
        <span style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          <Money value={balance} sign={balance >= 0 ? '+' : '−'} />
        </span>
      </div>
    </div>
  );
}

/* ---------------- HomeActionsSection ---------------- */
export function HomeActionsSection({
  onCreatePoll,
  onCreateOrder,
  onSuggest,
}: {
  onCreatePoll?: () => void;
  onCreateOrder?: () => void;
  onSuggest?: () => void;
}) {
  const actions = [
    { key: 'poll', icon: 'flame' as const, label: 'Голосование', sub: 'Запустить опрос', onClick: onCreatePoll },
    { key: 'order', icon: 'cart' as const, label: 'Закупка', sub: 'Собрать заказ', onClick: onCreateOrder },
    { key: 'dish', icon: 'plus' as const, label: 'Блюдо', sub: 'Предложить', onClick: onSuggest },
  ];
  return (
    <div>
      <SectionTitle icon="sparkle">Быстрые действия</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {actions.map((a) => (
          <button key={a.key} className="tile" style={{ alignItems: 'flex-start', gap: 10 }} onClick={a.onClick}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'var(--accent-tint)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={a.icon} size={19} />
            </div>
            <div>
              <div className="font-head" style={{ fontSize: 'var(--t-13)', fontWeight: 600 }}>
                {a.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
