/* ROCKET LUNCH — HOME WIDGETS («Графит и мёд», порт макета
   "Rocket Lunch Telegram Mini App/Rocket Lunch Redesign.dc.html", июль 2026)
   Presentational; HomePage feeds real hook/API data. */
import { Icon } from './Icon';
import { Avatar, Badge, Button, Confetti, CountUp, IconButton, Spinner } from './primitives';

function pluralVotes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} голос`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} голоса`;
  return `${n} голосов`;
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* Общая «медовая» подсветка в правом верхнем углу карточки (из макета) */
function CardGlow() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: -70,
        right: -50,
        width: 220,
        height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-tint), transparent 70%)',
        pointerEvents: 'none',
      }}
    />
  );
}

/* Заголовок-статус карточки: 11px, uppercase, разрядка — как в макете */
function CardKicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

/* ---------------- HomeGreeting ----------------
   Макет: приветствие — текст на канвасе, не карточка.
   Дата-киккер → Unbounded-заголовок → подзаголовок. */
export function HomeGreeting({
  greet,
  name,
  sub = 'Время решать, что заказываем сегодня',
  loading,
}: {
  greet?: string;
  name?: string;
  sub?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div style={{ padding: '4px 4px 0' }}>
        <div className="skeleton" style={{ height: 11, width: '30%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 24, width: '70%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: '55%' }} />
      </div>
    );
  }
  const dateLabel = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '4px 4px 0' }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
        }}
      >
        {dateLabel}
      </span>
      <h1
        className="font-head"
        style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.25, color: 'var(--text-primary)' }}
      >
        {greet}
        {name ? `, ${name}` : ''}
      </h1>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub}</span>
    </div>
  );
}

/* ---------------- EmptyPollCard ----------------
   Макет (a): орбита с пунктиром, чипы-призраки, CTA на всю ширину. */
export function EmptyPollCard({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  const ghostChip = (text: string, pos: React.CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        padding: '5px 10px',
        borderRadius: 999,
        border: '1px dashed var(--border-subtle)',
        fontSize: 11,
        color: 'var(--text-tertiary)',
        whiteSpace: 'nowrap',
        ...pos,
      }}
    >
      {text}
    </div>
  );
  return (
    <div
      className="card"
      style={{
        padding: '26px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CardGlow />
      <div
        style={{
          position: 'relative',
          width: 96,
          height: 96,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px dashed color-mix(in srgb, var(--accent) 35%, transparent)',
          }}
        />
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: '50%',
            background: 'var(--accent-tint)',
            boxShadow: 'inset 0 0 0 1px var(--accent-ring)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Icon name="target" size={30} stroke={1.6} />
        </div>
        {ghostChip('Том-ям?', { left: -80, top: 8, transform: 'rotate(-6deg)' })}
        {ghostChip('Шаурма?', { right: -82, bottom: 4, transform: 'rotate(5deg)' })}
      </div>
      <span
        className="font-head"
        style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', position: 'relative' }}
      >
        Сегодня ещё не решали
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 250, position: 'relative' }}>
        {canCreate
          ? 'Запустите голосование — команда выберет обед за пару минут'
          : 'Дождитесь, пока администратор запустит опрос'}
      </span>
      {canCreate && (
        <Button variant="primary" size="lg" onClick={onCreate} style={{ width: '100%', marginTop: 10 }}>
          Запустить голосование
        </Button>
      )}
    </div>
  );
}

/* ---------------- ActivePollWidget ----------------
   Макет (b): статус-дот + таймер-чип, строки с барами, счётчик «X из Y», CTA. */
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
    options,
    totalVotes,
    teamCount,
    remaining,
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
      <div className="card" style={{ padding: 18 }}>
        <div className="skeleton" style={{ height: 12, width: '45%', marginBottom: 16 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 7, width: '100%' }} />
          </div>
        ))}
        <div className="skeleton" style={{ height: 50, width: '100%', marginTop: 6 }} />
      </div>
    );
  }

  const chosenId = hasVoted ? myChoiceId : selectedId;
  const chosenName = options.find((o) => o.id === myChoiceId)?.name;
  const maxVotes = Math.max(1, ...options.map((o) => o.votes));
  const leaderId = options.reduce(
    (best, o) => (o.votes > (options.find((x) => x.id === best)?.votes ?? -1) ? o.id : best),
    options[0]?.id ?? -1,
  );

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <CardGlow />
      {/* статус + таймер */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 10px color-mix(in srgb, var(--success) 80%, transparent)',
            }}
          />
          <CardKicker>Голосование идёт</CardKicker>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 13,
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
            boxShadow: 'inset 0 0 0 1px var(--accent-ring)',
          }}
        >
          <Icon name="clock" size={13} stroke={2} />
          <span className="tnum" style={{ fontSize: 13.5, fontWeight: 700 }}>
            {fmtClock(remaining)}
          </span>
        </div>
      </div>

      {/* варианты с барами */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, position: 'relative' }}>
        {options.map((d) => {
          const isMine = chosenId === d.id;
          const share = d.votes / maxVotes;
          const pct = Math.round(share * 100);
          const isLeader = d.id === leaderId && d.votes > 0;
          return (
            <div
              key={d.id}
              onClick={() => !hasVoted && onSelect(d.id)}
              role={hasVoted ? undefined : 'button'}
              tabIndex={hasVoted ? undefined : 0}
              onKeyDown={(e) => {
                if (!hasVoted && (e.key === 'Enter' || e.key === ' ')) onSelect(d.id);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, cursor: hasVoted ? 'default' : 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 14,
                    fontWeight: isMine || isLeader ? 600 : 500,
                    color: isMine ? 'var(--accent)' : isLeader ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {isMine && <Icon name="check" size={14} stroke={2.4} />}
                  {d.name}
                </span>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {pluralVotes(d.votes)}
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: isLeader
                      ? 'linear-gradient(90deg, #D68914, #F6BE5F)'
                      : `color-mix(in srgb, var(--accent) ${Math.max(20, Math.round(share * 45))}%, transparent)`,
                    transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* счётчик участников */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Проголосовало {totalVotes}
          {teamCount != null ? ` из ${teamCount}` : ''}
        </span>
        {isAdmin && (
          <IconButton variant="ghost" size="sm" name="gear" aria-label="Администрирование" onClick={onToggleAdmin} />
        )}
      </div>

      {/* CTA / состояние «проголосовал» */}
      {hasVoted ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 14px',
            background: 'var(--success-tint)',
            borderRadius: 17,
            color: 'var(--success)',
            fontSize: 13,
            fontWeight: 600,
            position: 'relative',
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
        <Button
          variant="primary"
          size="lg"
          disabled={selectedId == null}
          loading={voting}
          onClick={onVote}
          style={{ width: '100%' }}
        >
          {selectedId != null ? 'Подтвердить голос' : 'Голосовать'}
        </Button>
      )}

      {isAdmin && adminOpen && (
        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)', position: 'relative' }}>
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

/* ---------------- CompletedPollWidget ----------------
   Макет (c): «Итоги голосования», победитель, ответственный, «Скинуться · СБП». */
export interface CompletedPollWidgetProps {
  winnerName: string;
  winnerVotes: number;
  totalVotes: number;
  responsibleName?: string;
  collapsed: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onCancel?: () => void;
  onDetails?: () => void;
  onSbp?: () => void;
}

/* Мини-конфетти: четыре застывшие точки в правом верхнем углу — как в макете */
function ConfettiDots() {
  const dot = (pos: React.CSSProperties, color: string, square = false) => (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: square ? 4 : 5,
        height: square ? 4 : 5,
        borderRadius: square ? 1.5 : '50%',
        background: color,
        ...pos,
      }}
    />
  );
  return (
    <>
      {dot({ top: 16, right: 74, opacity: 0.6 }, 'var(--accent)')}
      {dot({ top: 36, right: 38, opacity: 0.55, transform: 'rotate(24deg)' }, 'var(--success)', true)}
      {dot({ top: 12, right: 126, opacity: 0.5 }, 'var(--warning)')}
      {dot({ top: 56, right: 20, opacity: 0.4 }, 'var(--danger)')}
    </>
  );
}

export function CompletedPollWidget({
  winnerName,
  winnerVotes,
  totalVotes,
  responsibleName,
  collapsed,
  onToggle,
  isAdmin,
  onCancel,
  onDetails,
  onSbp,
}: CompletedPollWidgetProps) {
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
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            flexShrink: 0,
            background: 'var(--accent-tint)',
            boxShadow: 'inset 0 0 0 1px var(--accent-ring)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="target" size={18} stroke={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Итоги · победитель</div>
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
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
      <CardGlow />
      <ConfettiDots />
      {/* шапка */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <CardKicker>Итоги голосования</CardKicker>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 11px',
              borderRadius: 13,
              background: 'var(--success-tint)',
              color: 'var(--success)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--success) 22%, transparent)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Завершено</span>
          </div>
          <IconButton variant="ghost" size="sm" name="chevronUp" aria-label="Свернуть" onClick={onToggle} />
        </div>
      </div>

      {/* победитель */}
      <div
        onClick={onDetails}
        role={onDetails ? 'button' : undefined}
        tabIndex={onDetails ? 0 : undefined}
        onKeyDown={(e) => {
          if (onDetails && (e.key === 'Enter' || e.key === ' ')) onDetails();
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', cursor: onDetails ? 'pointer' : 'default' }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 25%, transparent), color-mix(in srgb, var(--accent) 12%, transparent))',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <Icon name="target" size={26} stroke={1.6} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span
            className="font-head"
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {winnerName}
          </span>
          <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {pluralVotes(winnerVotes)} из {totalVotes}
          </span>
        </div>
      </div>

      {/* ответственный */}
      {responsibleName && (
        <>
          <div style={{ height: 1, background: 'var(--border-subtle)', position: 'relative' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <Avatar name={responsibleName} size={40} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                }}
              >
                Ответственный за заказ
              </span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{responsibleName}</span>
            </div>
            {onSbp && (
              <button
                className="press"
                onClick={onSbp}
                style={{
                  height: 38,
                  padding: '0 14px',
                  borderRadius: 13,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--accent-tint)',
                  boxShadow: 'inset 0 0 0 1px var(--accent-ring)',
                  color: 'var(--accent)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Скинуться · СБП
              </button>
            )}
          </div>
        </>
      )}

      {isAdmin && onCancel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
          <Button variant="ghost" size="sm" icon="refresh" style={{ color: 'var(--danger)' }} onClick={onCancel}>
            Отменить итоги
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- BudgetWidget ---------------- */
function Money({ value, sign, big }: { value: number; sign?: string; big?: boolean }) {
  return (
    <span
      className="tnum font-head"
      style={{ fontWeight: 700, letterSpacing: '-0.01em', fontSize: big ? 'var(--t-28)' : 'inherit' }}
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
          <div className="font-head" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Бюджет команды
          </div>
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>Нет активных расчётов</div>
        </div>
        <Icon name="chevronDown" size={20} style={{ color: 'var(--text-tertiary)' }} />
      </button>
    );
  }

  /* Шапка из макета: Unbounded-заголовок + пилюля справа */
  const header = (right?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 className="font-head" style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>
        Бюджет команды
      </h3>
      {right}
    </div>
  );

  const monthPill = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 30,
        padding: '0 11px',
        borderRadius: 999,
        background: 'var(--border-subtle)',
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      Этот месяц
      <Icon name="chevronDown" size={12} stroke={2} />
    </div>
  );

  if (scenario === 'urgent' || scenario === 'awaiting') {
    const isPaid = scenario === 'awaiting';
    return (
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              borderRadius: 17,
              background: 'var(--warning-tint)',
              color: 'var(--warning)',
              fontSize: 'var(--t-13)',
              fontWeight: 600,
            }}
          >
            <Spinner size={16} /> Ждём подтверждения{urgentCreditorName ? ` от ${urgentCreditorName}` : ''}
          </div>
        ) : (
          <Button variant="primary" size="lg" icon="bank" style={{ width: '100%' }} onClick={onPaySbp}>
            Оплатить через СБП
          </Button>
        )}
      </div>
    );
  }

  if (scenario === 'success') {
    return (
      <div className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
        <Confetti fire />
        {header()}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 0 6px' }}>
          <div
            className="anim-pop"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--success-tint)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
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
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {header(
          <Badge tone="accent" icon="users">
            Вы собираете
          </Badge>,
        )}
        <div>
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
          <div className="votebar" style={{ height: 8 }}>
            <i style={{ transform: `scaleX(${total > 0 ? Math.min(1, collected / total) : 0})` }} />
          </div>
        </div>
        {creditors.length > 0 && (
          <div className="row-divider" style={{ borderRadius: 17, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
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

  // overview — макет: две цветные плитки + «Итог месяца»
  const balance = owedToYou - youOwe;
  const tile = (kind: 'in' | 'out', label: string, value: number) => {
    const color = kind === 'in' ? 'var(--success)' : 'var(--danger)';
    const tint = kind === 'in' ? 'var(--success-tint)' : 'var(--danger-tint)';
    return (
      <div
        style={{
          borderRadius: 17,
          padding: '13px 14px',
          background: tint,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, transparent)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
          <Icon
            name="arrowRight"
            size={13}
            stroke={2}
            style={{ transform: kind === 'in' ? 'rotate(135deg)' : 'rotate(-45deg)' }}
          />
          <span style={{ fontSize: 11.5, fontWeight: 500, color: `color-mix(in srgb, ${color} 75%, var(--text-secondary))` }}>
            {label}
          </span>
        </div>
        <span className="tnum" style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.01em' }}>
          {value.toLocaleString('ru-RU')} ₽
        </span>
      </div>
    );
  };
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
      {header(monthPill)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {tile('in', 'Вам должны', owedToYou)}
        {tile('out', 'Вы должны', youOwe)}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 11,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>Итог месяца</span>
        <span className="tnum" style={{ fontSize: 16, fontWeight: 700, color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {balance >= 0 ? '+' : '−'}
          {Math.abs(balance).toLocaleString('ru-RU')} ₽
        </span>
      </div>
    </div>
  );
}
