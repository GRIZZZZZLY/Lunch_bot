import type {
  AdminDashboardData,
  AdminUser,
  PollItem,
  QuickAction,
  WeekBar,
} from './types';
import '@/styles/admin.css';

interface Props {
  data: AdminDashboardData;
  onQuickAction?: (id: string) => void;
  onChecklistAction?: (id: string) => void;
  onMakeAdmin?: (id: string) => void;
  onBanUser?: (id: string) => void;
  onPollMenu?: (id: string) => void;
  onCreatePoll?: () => void;
}

function QuickActionCard({ qa, onClick }: { qa: QuickAction; onClick?: () => void }) {
  return (
    <div className={`qa ${qa.tone}`} onClick={onClick}>
      <div className="qi">{qa.emoji}</div>
      <div>
        <div className="qt">{qa.title}</div>
        <div className="qs">{qa.subtitle}</div>
      </div>
    </div>
  );
}

function ChartBar({ bar }: { bar: WeekBar }) {
  const cls = bar.peak ? 'v peak' : bar.muted ? 'v muted' : 'v';
  return (
    <div className="bar">
      <div className={cls} style={{ height: `${bar.value}%` }} />
      <div className="dl">{bar.day}</div>
    </div>
  );
}

function UserRow({
  u,
  onMakeAdmin,
  onBanUser,
}: {
  u: AdminUser;
  onMakeAdmin?: (id: string) => void;
  onBanUser?: (id: string) => void;
}) {
  return (
    <div className="u-row">
      <div
        className={`av${u.avatarTone && u.avatarTone !== 'default' ? ` ${u.avatarTone}` : ''}`}
      >
        {u.initial}
      </div>
      <div className="md">
        <div className="nm">{u.name}</div>
        <div className="rl">
          {u.username} · {u.role === 'banned' ? 'заблокирован' : `${u.pollsCount} опросов`}
        </div>
      </div>
      {u.role === 'admin' ? (
        <span className="rb admin">👑 Админ</span>
      ) : u.role === 'banned' ? (
        <span className="rb banned">Бан</span>
      ) : (
        <>
          <button type="button" className="act-mini" onClick={() => onMakeAdmin?.(u.id)}>
            Сделать админом
          </button>
        </>
      )}
      {u.role === undefined && onBanUser && (
        <button
          type="button"
          className="act-mini danger"
          onClick={() => onBanUser(u.id)}
          style={{ marginLeft: 6 }}
        >
          Заблокировать
        </button>
      )}
    </div>
  );
}

function PollRow({ p, onMenu }: { p: PollItem; onMenu?: (id: string) => void }) {
  return (
    <div className="p-row">
      <div className={`pi${p.tone ? ` ${p.tone}` : ''}`}>{p.emoji}</div>
      <div className="md">
        <div className="tt">{p.title}</div>
        <div className="st2">
          <span className={`pill-tiny ${p.status === 'active' ? 'act' : 'sch'}`}>
            {p.status === 'active' ? 'Активен' : 'Запланирован'}
          </span>
          <span className="t-mono">{p.meta}</span>
        </div>
      </div>
      <div className="menu-btn" onClick={() => onMenu?.(p.id)}>
        ⋯
      </div>
    </div>
  );
}

export function AdminDashboard({
  data,
  onQuickAction,
  onChecklistAction,
  onMakeAdmin,
  onBanUser,
  onPollMenu,
  onCreatePoll: _onCreatePoll,
}: Props) {
  return (
    <>
      <div className="top-hdr">
        <div className="ttl">
          Админ-панель <span className="badge">ТОЛЬКО ДЛЯ АДМИНОВ</span>
        </div>
        <div className="act">⚙</div>
      </div>
      <div className="content">
        <div className="admin-hero">
          <div className="h1">{data.checklistHeading}</div>
          <div className="h2">{data.checklistSubtitle}</div>
          <div className="clist">
            {data.checklist.map((it) => (
              <div
                key={it.id}
                className={`cl-row${it.urgent ? ' urgent' : ''}`}
                onClick={() => onChecklistAction?.(it.id)}
              >
                <div className="cb" />
                <div className="cl-t">{it.label}</div>
                <div className="ch">›</div>
              </div>
            ))}
          </div>
        </div>

        <div className="qa-grid">
          {data.quickActions.map((qa) => (
            <QuickActionCard key={qa.id} qa={qa} onClick={() => onQuickAction?.(qa.id)} />
          ))}
        </div>

        <div className="sec">
          <div className="tt">Инсайты</div>
          <button type="button" className="lnk">
            Отчёт →
          </button>
        </div>
        <div className="stiles">
          {data.stats.map((s, i) => (
            <div key={i} className="st">
              <div className="n">{s.num}</div>
              <div className="l" dangerouslySetInnerHTML={{ __html: s.label }} />
            </div>
          ))}
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              {data.chart.title}
            </div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
              }}
            >
              {data.chart.subtitle}
            </div>
          </div>
          <div className="chart">
            {data.chart.bars.map((b, i) => (
              <ChartBar key={i} bar={b} />
            ))}
          </div>
        </div>

        {data.alert && (
          <div className="alert">
            <div className="ai">⚠</div>
            <div className="at">
              <div className="t">{data.alert.title}</div>
              <div className="s">{data.alert.subtitle}</div>
            </div>
          </div>
        )}

        <div className="sec">
          <div className="tt">Участники · {data.usersTotal}</div>
          <button type="button" className="lnk">
            Все →
          </button>
        </div>
        <div className="card">
          <input className="input" placeholder="Найти участника…" />
          <div style={{ marginTop: 6 }}>
            {data.users.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                onMakeAdmin={onMakeAdmin}
                onBanUser={onBanUser}
              />
            ))}
          </div>
          <div className="pg">
            <div className="pt">‹</div>
            <div className="pt on">1</div>
            <div className="pt">2</div>
            <div className="pt">3</div>
            <div className="pt">›</div>
          </div>
        </div>

        <div className="sec">
          <div className="tt">Опросы</div>
          <button type="button" className="lnk">
            История →
          </button>
        </div>
        <div className="card">
          <div className="form-sec">
            <div className="l">Активные · {data.polls.active.length}</div>
            {data.polls.active.map((p) => (
              <PollRow key={p.id} p={p} onMenu={onPollMenu} />
            ))}
          </div>
          {data.polls.scheduled.length > 0 && (
            <div className="form-sec" style={{ marginTop: 10 }}>
              <div className="l">Запланированы · {data.polls.scheduled.length}</div>
              {data.polls.scheduled.map((p) => (
                <PollRow key={p.id} p={p} onMenu={onPollMenu} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
