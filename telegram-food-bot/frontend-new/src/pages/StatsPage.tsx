/* ROCKET LUNCH — STATS («Графит и мёд», порт макета, июль 2026)
   Лидерборд со streak, «профиль обеда», обеды по неделям.
   Всё считается из истории опросов (usePollHistory), как и раньше. */
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePollHistory } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/rl/Icon';
import { Avatar, Button } from '@/components/rl/primitives';
import type { Poll } from '@/types/models';

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

interface LeaderVM {
  id: number;
  name: string;
  lunches: number;
  streak: number;
  isMe: boolean;
}

interface StatsVM {
  teamCount: number;
  leaders: LeaderVM[];
  myDishes: { name: string; count: number }[];
  participation: number;
  weeks: { label: string; count: number }[];
  monthName: string;
}

function buildVM(polls: Poll[], myId: number | null): StatsVM {
  const members = new Map<number, LeaderVM>();
  let pollsWithMe = 0;
  const myDishCounts = new Map<string, number>();

  for (const poll of polls) {
    const seen = new Set<number>();
    for (const v of poll.votes ?? []) {
      if (!v.userId || seen.has(v.userId)) continue;
      seen.add(v.userId);
      const m = members.get(v.userId) ?? {
        id: v.userId,
        name: v.user?.firstName || v.user?.username || 'Участник',
        lunches: 0,
        streak: 0,
        isMe: v.userId === myId,
      };
      m.lunches += 1;
      members.set(v.userId, m);
    }
    if (myId && seen.has(myId)) {
      pollsWithMe += 1;
      for (const v of poll.votes ?? []) {
        if (v.userId !== myId) continue;
        const name =
          v.menuItem?.name ?? poll.menuItems?.find((l) => l.menuItemId === v.menuItemId)?.menuItem.name;
        if (name) myDishCounts.set(name, (myDishCounts.get(name) ?? 0) + 1);
      }
    }
  }

  // streak — сколько последних опросов подряд участник обедал
  const ordered = [...polls].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const m of members.values()) {
    let s = 0;
    for (const p of ordered) {
      if ((p.votes ?? []).some((v) => v.userId === m.id)) s += 1;
      else break;
    }
    m.streak = s;
  }

  const now = new Date();
  const monthIdx = now.getMonth();
  const year = now.getFullYear();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const buckets: { label: string; count: number }[] = [
    { label: '1–7', count: 0 },
    { label: '8–14', count: 0 },
    { label: '15–21', count: 0 },
    { label: `22–${daysInMonth}`, count: 0 },
  ];
  for (const poll of polls) {
    const d = new Date(poll.createdAt);
    if (d.getMonth() !== monthIdx || d.getFullYear() !== year) continue;
    buckets[Math.min(3, Math.floor((d.getDate() - 1) / 7))].count += 1;
  }

  const rawMonth = now.toLocaleDateString('ru-RU', { month: 'long' });
  return {
    teamCount: members.size,
    leaders: [...members.values()].sort((a, b) => b.lunches - a.lunches).slice(0, 5),
    myDishes: [...myDishCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    participation: polls.length > 0 ? Math.round((pollsWithMe / polls.length) * 100) : 0,
    weeks: buckets,
    monthName: rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1),
  };
}

function Stack({ children }: { children: ReactNode[] }) {
  return (
    <div className="rl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 16px 16px' }}>
        {children.filter(Boolean).map((node, i) => (
          <div key={i} className="anim-rise" style={{ animationDelay: `${Math.min(i * 55, 330)}ms` }}>
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Киккер карточки: 11px, uppercase, разрядка — как в макете */
function Kicker({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
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
    </div>
  );
}

function PageTitle({ sub }: { sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 4px 0' }}>
      <h1 className="font-head" style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
        Статистика
      </h1>
      <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        {sub}
      </span>
    </div>
  );
}

export function StatsPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: polls = [], isLoading: historyLoading } = usePollHistory({ limit: 60 });
  const vm = useMemo(() => buildVM(polls, user?.id ?? null), [polls, user?.id]);

  if (authLoading || historyLoading) {
    return (
      <Stack>
        {[
          <PageTitle key="t" sub="Загружаем…" />,
          <div key="a" className="card" style={{ padding: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 10 }}>
                <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 12, width: '45%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 10, width: '25%' }} />
                </div>
              </div>
            ))}
          </div>,
          <div key="b" className="card" style={{ padding: 16 }}>
            <div className="skeleton" style={{ height: 96 }} />
          </div>,
        ]}
      </Stack>
    );
  }

  // ----- эмпти по макету: пунктирные столбики-призраки -----
  if (polls.length === 0) {
    return (
      <Stack>
        {[
          <PageTitle key="t" sub="Здесь будут лидерборд и траты" />,
          <div
            key="e"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              textAlign: 'center',
              padding: '56px 0 30px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 96, marginBottom: 8 }}>
              {[38, 66, 50].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: h,
                    borderRadius: '10px 10px 6px 6px',
                    border: `1.5px dashed ${i === 1 ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: 6,
                    color: i === 1 ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                >
                  {i === 1 && <Icon name="stats" size={14} />}
                </div>
              ))}
            </div>
            <span className="font-head" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Пока нет статистики
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 260 }}>
              Проведите первое голосование — лидерборд и графики построятся сами
            </span>
            <Button variant="primary" size="lg" style={{ marginTop: 8 }} onClick={() => navigate('/')}>
              Запустить голосование
            </Button>
          </div>,
        ]}
      </Stack>
    );
  }

  const maxWeek = Math.max(1, ...vm.weeks.map((w) => w.count));
  const hasWeeks = vm.weeks.some((w) => w.count > 0);

  return (
    <Stack>
      {[
        <PageTitle
          key="t"
          sub={`${vm.monthName} · команда из ${vm.teamCount} человек`}
        />,

        /* ----- лидерборд ----- */
        vm.leaders.length > 0 ? (
          <div key="lb" className="card" style={{ borderRadius: 24, padding: '15px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '0 6px' }}>
              <Kicker icon={<Icon name="crown" size={15} style={{ color: 'var(--accent)' }} />}>
                Лидерборд команды
              </Kicker>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {vm.leaders.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '5px 8px',
                    borderRadius: 13,
                    background: m.isMe ? 'var(--accent-tint)' : 'transparent',
                    boxShadow: m.isMe ? 'inset 0 0 0 1px var(--accent-ring)' : 'none',
                  }}
                >
                  <span
                    className="tnum"
                    style={{
                      width: 16,
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: i === 0 ? 'var(--warning)' : i === 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={m.name} size={32} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.name}
                      {m.isMe ? ' · вы' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {plural(m.lunches, 'обед', 'обеда', 'обедов')}
                    </span>
                  </div>
                  {m.streak > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)' }}>
                      <Icon name="flame" size={14} />
                      <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {m.streak}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null,

        /* ----- ваш профиль обеда ----- */
        <div key="me" className="card" style={{ borderRadius: 24, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <Kicker>Ваш профиль обеда</Kicker>
          {vm.myDishes.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {vm.myDishes.map((d, i) => (
                <span
                  key={d.name}
                  className="tnum"
                  style={{
                    height: 30,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderRadius: 999,
                    background: i === 0 ? 'var(--accent-tint)' : 'var(--border-subtle)',
                    boxShadow: i === 0 ? 'inset 0 0 0 1px var(--accent-ring)' : 'none',
                    color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: i === 0 ? 600 : 500,
                  }}
                >
                  {d.name} ×{d.count}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Вы ещё не голосовали — выберите блюдо в ближайшем опросе
            </span>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 9,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Участие в голосованиях</span>
            <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
              {vm.participation}%
            </span>
          </div>
        </div>,

        /* ----- обеды по неделям ----- */
        hasWeeks ? (
          <div key="wk" className="card" style={{ borderRadius: 24, padding: '15px 16px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Kicker>Обеды по неделям · {vm.monthName}</Kicker>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 96, padding: '0 2px' }}>
              {vm.weeks.map((w) => {
                const isMax = w.count === maxWeek && w.count > 0;
                const h = w.count > 0 ? 10 + Math.round((w.count / maxWeek) * 48) : 4;
                return (
                  <div
                    key={w.label}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 5,
                      height: '100%',
                    }}
                  >
                    <span
                      className="tnum"
                      style={{
                        fontSize: 10,
                        color: isMax ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: isMax ? 700 : 400,
                      }}
                    >
                      {w.count}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: h,
                        borderRadius: '8px 8px 5px 5px',
                        background:
                          w.count === 0
                            ? 'var(--border-subtle)'
                            : isMax
                              ? 'linear-gradient(180deg, #F6BE5F, #D68914)'
                              : 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 50%, transparent), color-mix(in srgb, var(--accent) 22%, transparent))',
                        boxShadow: isMax ? '0 6px 16px -6px color-mix(in srgb, var(--accent) 50%, transparent)' : 'none',
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{w.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null,
      ]}
    </Stack>
  );
}
