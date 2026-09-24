/**
 * Текущая команда и её смена — плашка «Офис ▾» в шапке вкладок, когда команд
 * две и больше. Точка на плашке — сколько команд сейчас заняты (правило —
 * lib/teamActivity.ts, teamSlotModel), шторка «Команды» — статус каждой.
 *
 * С одной командой не показывается: выбирать не из чего.
 */
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BottomSheet } from '@/components/rl/BottomSheet';
import { Icon } from '@/components/rl/Icon';
import { useMyGroups } from '@/hooks/useUser';
import type { ActivityByTeam } from '@/lib/teamActivity';
import { useAppStore } from '@/store/useAppStore';
import { ActivityLine } from './ActivityLine';
import styles from './TeamSwitcher.module.css';

interface TeamSwitcherProps {
  /** Статусы команд; null — ещё не пришли или запрос упал: строк статуса нет. */
  activity: ActivityByTeam | null;
  busyCount: number;
}

export function TeamSwitcher({ activity, busyCount }: TeamSwitcherProps) {
  const navigate = useNavigate();
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: groups = [] } = useMyGroups();
  const activeGroups = useMemo(() => groups.filter((g) => g.isActive), [groups]);
  const [open, setOpen] = useState(false);
  const uid = useId();

  const current = activeGroups.find((g) => String(g.id) === currentGroupId);
  if (activeGroups.length < 2) return null;
  /* Текущей может оказаться команда не из активных: ссылка на старый опрос
     делает текущей его команду, даже архивную (useAdoptGroup). Плашка остаётся —
     другого способа сменить команду в продукте нет. */

  const busyId = `${uid}-busy`;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={current ? `Команда: ${current.title}. Сменить` : 'Команда не выбрана. Выбрать'}
        aria-describedby={busyCount > 0 ? busyId : undefined}
        onClick={() => setOpen(true)}
      >
        <span className={styles.title}>{current ? current.title : 'Выбрать команду'}</span>
        <Icon name="chevronDown" size={14} />
        {busyCount > 0 && (
          <>
            <span className={styles.dot} aria-hidden>
              {busyCount}
            </span>
            <span id={busyId} className="sr-only">
              Что-то идёт в командах: {busyCount}
            </span>
          </>
        )}
      </button>

      {open && (
        <BottomSheet title="Команды" onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="Команда" className={styles.list}>
            {activeGroups.map((g) => {
              const id = String(g.id);
              const selected = id === currentGroupId;
              const statusId = `${uid}-${id}`;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={g.title}
                  aria-describedby={activity ? statusId : undefined}
                  className={styles.option}
                  onClick={() => {
                    setCurrentGroupId(id);
                    setOpen(false);
                    navigate('/');
                  }}
                >
                  <span className={styles.optionMain}>
                    <span className={styles.optionTitle}>{g.title}</span>
                    {activity && (
                      <span id={statusId} className={`tnum ${styles.optionStatus}`}>
                        <ActivityLine activity={activity[id] ?? {}} />
                      </span>
                    )}
                  </span>
                  {selected && <Icon name="check" size={16} />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
