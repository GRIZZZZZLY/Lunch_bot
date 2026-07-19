/* Статистика (Phase 6, система C): только реальные клиентские данные из
   истории голосований — участие, серия, топ команды, любимые блюда,
   активность по неделям. Плоские секции, не дашборд из плиток. */
import { useMemo } from 'react';
import { usePollHistory } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState, Skeleton, Status } from '@/shared/ui';
import { pluralize } from '@/shared/lib/pluralize';
import { buildVM } from './lib/buildVM';
import styles from './StatsPage.module.css';

export function StatsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: polls = [], isLoading: historyLoading } = usePollHistory({ limit: 60 });
  const vm = useMemo(() => buildVM(polls, user?.id ?? null), [polls, user?.id]);
  const maxLeader = vm.leaders[0]?.lunches ?? 0;
  const maxWeek = Math.max(1, ...vm.weeks.map((w) => w.count));
  const me = vm.leaders.find((l) => l.isMe);

  if (authLoading || historyLoading) {
    return (
      <div className={`rl ${styles.screen}`}>
        <h1 className={styles.title}>Статистика</h1>
        <div className={styles.group} style={{ padding: 16 }}>
          <Skeleton variant="text" width="45%" />
          <div style={{ height: 10 }} />
          <Skeleton variant="block" height={80} />
        </div>
      </div>
    );
  }

  if (vm.pollsTotal === 0) {
    return (
      <div className={`rl ${styles.screen}`}>
        <h1 className={styles.title}>Статистика</h1>
        <div className={styles.stateWrap}>
          <EmptyState
            icon="stats"
            title="Пока нет данных"
            description="Статистика появится после первых голосований команды."
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`rl ${styles.screen}`}>
      <h1 className={styles.title}>Статистика</h1>

      <section className={styles.group} aria-label="Ваше участие">
        <div className={styles.groupHead}>Ваше участие</div>
        <div className={styles.partLine}>
          <span className={`tnum ${styles.partBig}`}>
            {vm.pollsWithMe} из {vm.pollsTotal}
          </span>
          <span className={styles.partCap}>голосований · {vm.participation}%</span>
        </div>
        <div className={styles.partBarWrap}>
          <div className={styles.bar}>
            <span className={styles.barFill} style={{ width: `${vm.participation}%` }} />
          </div>
        </div>
        {me && me.streak >= 2 && (
          <div className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowName}>Серия</div>
              <span className={styles.rowSub}>подряд без пропусков</span>
            </div>
            <Status tone="warning" icon="flame">
              {pluralize(me.streak, 'обед', 'обеда', 'обедов')}
            </Status>
          </div>
        )}
      </section>

      {vm.leaders.length > 0 && (
        <section className={styles.group} aria-label="Команда">
          <div className={styles.groupHead}>
            Команда · {pluralize(vm.teamCount, 'участник', 'участника', 'участников')}
          </div>
          {vm.leaders.map((l, i) => (
            <div key={l.id} className={styles.row}>
              <span className={`tnum ${styles.rank}`}>{i + 1}</span>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>
                  {l.name}
                  {l.isMe && <Status tone="accent">вы</Status>}
                </div>
                <div className={styles.bar}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${maxLeader > 0 ? (l.lunches / maxLeader) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className={`tnum ${styles.rowVal}`}>{l.lunches}</span>
            </div>
          ))}
        </section>
      )}

      {vm.myDishes.length > 0 && (
        <section className={styles.group} aria-label="Ваши любимые блюда">
          <div className={styles.groupHead}>Ваши любимые блюда</div>
          {vm.myDishes.map((d) => (
            <div key={d.name} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowName}>{d.name}</div>
              </div>
              <span className={`tnum ${styles.rowVal}`}>
                {pluralize(d.count, 'раз', 'раза', 'раз')}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className={styles.group} aria-label="Активность за месяц">
        <div className={styles.groupHead}>{vm.monthName} · голосования по неделям</div>
        <div className={styles.weeks}>
          {vm.weeks.map((w) => (
            <div key={w.label} className={styles.week}>
              <span className={`tnum ${styles.weekCount}`}>{w.count > 0 ? w.count : ''}</span>
              <div
                className={`${styles.weekBar}${w.count === maxWeek && w.count > 0 ? ` ${styles.top}` : ''}`}
                style={{ height: `${8 + (w.count / maxWeek) * 48}px` }}
              />
              <span className={styles.weekLabel}>{w.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
