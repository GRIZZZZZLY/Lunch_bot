/* Статистика (Phase 6, система C): только реальные клиентские данные из
   истории голосований — участие, серия, топ команды, любимые блюда,
   активность по неделям. Плоские секции, не дашборд из плиток. */
import { useMemo } from 'react';
import { PROFILE_HISTORY_LIMIT, usePollHistory } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState, InlineNotice, Skeleton, Status } from '@/shared/ui';
import { pluralize, pluralForm } from '@/shared/lib/pluralize';
import { useDelayedLoading } from '@/shared/lib/useDelayedLoading';
import { buildVM } from './lib/buildVM';
import styles from './StatsPage.module.css';

export function StatsPage() {
  const { user, isLoading: authLoading } = useAuth();
  /* Тот же лимит, что у профиля, серии и админки: четыре разных значения
     означали четыре отдельных запроса за одной и той же историей. */
  const historyQuery = usePollHistory({ limit: PROFILE_HISTORY_LIMIT });
  const polls = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const historyLoading = historyQuery.isLoading;
  const vm = useMemo(() => buildVM(polls, user?.id ?? null), [polls, user?.id]);
  /* История приходит страницей: «N из 60» брало знаменатель из размера
     страницы и выдавало его за число голосований команды. */
  const atCap = polls.length >= PROFILE_HISTORY_LIMIT;
  const maxLeader = vm.leaders[0]?.lunches ?? 0;
  const maxWeek = Math.max(1, ...vm.weeks.map((w) => w.count));
  const me = vm.leaders.find((l) => l.isMe);
  const loading = authLoading || historyLoading;
  const showSkeleton = useDelayedLoading(loading);

  if (loading) {
    return (
      <div className={`rl ${styles.screen}`}>
        <h1 className={styles.title}>Статистика</h1>
        {/* Заголовок на месте сразу, а место под данные в окне молчания не
            занимаем: ответ может успеть раньше, чем скелет понадобится. */}
        {showSkeleton && (
          <div className={styles.group} style={{ padding: 16 }}>
            <Skeleton variant="text" width="45%" />
            <div style={{ height: 10 }} />
            <Skeleton variant="block" height={80} />
          </div>
        )}
      </div>
    );
  }

  /* Отказ чтения раньше попадал сюда же и подавался как «Пока нет данных…
     после первых голосований команды» — то есть как факт о команде, а не как
     несостоявшийся запрос. */
  if (historyQuery.isError) {
    return (
      <div className={`rl ${styles.screen}`}>
        <h1 className={styles.title}>Статистика</h1>
        <InlineNotice tone="critical">
          Не удалось прочитать историю голосований, поэтому статистику показать не из чего.{' '}
          <button type="button" className={styles.retry} onClick={() => historyQuery.refetch()}>
            Повторить
          </button>
        </InlineNotice>
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
          {/* Склонение по знаменателю: было жёстко «голосований», и при одном
              опросе выходило «1 из 1 голосований». */}
          <span className={styles.partCap}>
            {pluralForm(vm.pollsTotal, 'голосования', 'голосований', 'голосований')} ·{' '}
            {vm.participation}%
          </span>
        </div>
        {atCap && (
          <p className={styles.note}>
            считаем по последним {vm.pollsTotal} голосованиям — более ранние сюда не попали
          </p>
        )}
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
          {/* Пока у всех поровну, места не показываем: четыре полосы во всю
              ширину с номерами 1–4 читаются как рейтинг, которого нет. */}
          {vm.allTied && <p className={styles.note}>пока у всех поровну</p>}
          {vm.leaders.map((l) => (
            <div key={l.id} className={styles.row}>
              {/* Пустая колонка, а не символ: точка на месте номера читалась
                  как мусор. Ширина .rank фиксированная, выравнивание держится. */}
              <span className={`tnum ${styles.rank}`}>{vm.allTied ? '' : l.rank}</span>
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
