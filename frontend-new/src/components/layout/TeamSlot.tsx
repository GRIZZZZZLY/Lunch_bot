/* Правая часть шапки вкладок: одиночная плашка статуса или плашка команды.
   Правила — docs/design-guidelines/screens.md, «Плашка команд»; решение
   принимает teamSlotModel (lib/teamActivity.ts). */
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMyGroups } from '@/hooks/useUser';
import { useTeamActivity } from '@/hooks/useTeamActivity';
import { runStatusText, teamSlotModel } from '@/lib/teamActivity';
import { useAppStore } from '@/store/useAppStore';
import { PollStatusText } from './ActivityLine';
import { TeamSwitcher } from './TeamSwitcher';
import styles from './TeamSlot.module.css';

export function TeamSlot() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === '/';
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const { data: groups = [] } = useMyGroups();
  const teamIds = useMemo(
    () => groups.filter((g) => g.isActive).map((g) => String(g.id)),
    [groups],
  );
  /* Одной команде на Главной плашка не нужна — не тратим и запросы. */
  const activity = useTeamActivity(teamIds.length >= 2 || !onHome);
  const model = teamSlotModel({ teamIds, currentGroupId, activity: activity ?? {}, onHome });

  switch (model.kind) {
    case 'switcher':
      return <TeamSwitcher activity={activity} busyCount={model.busyCount} />;
    case 'poll':
      return (
        <button type="button" className={`${styles.chip} ${styles.vote}`} onClick={() => navigate('/')}>
          <span className={styles.text}>
            <PollStatusText endsAt={model.endsAt} />
          </span>
        </button>
      );
    case 'run':
      return (
        <button
          type="button"
          className={`${styles.chip} ${styles.shop}`}
          onClick={() => navigate(`/store-run/${model.runId}`)}
        >
          <span className={styles.text}>{runStatusText(model.status)}</span>
        </button>
      );
    default:
      return null;
  }
}
