/* Что идёт в командах человека — для плашки команд в шапке вкладок.
   Правила показа — docs/design-guidelines/screens.md, «Плашка команд». */
import { pollEndsAt } from '@/features/home/lib/selectors';
import type { StoreRunListItem } from '@/services/store-run.service';
import type { Poll } from '@/types/models';

export type ActiveRunStatus = 'COLLECTING' | 'SHOPPING';

export interface TeamActivity {
  /** Окончание идущего голосования (ISO). */
  pollEndsAt?: string;
  run?: { id: number; status: ActiveRunStatus };
}

/** Ключ — id группы строкой, как `currentGroupId`. */
export type ActivityByTeam = Record<string, TeamActivity>;

const isActiveRun = (status: string): status is ActiveRunStatus =>
  status === 'COLLECTING' || status === 'SHOPPING';

/* Id группы приходит строкой у голосования и числом у закупки — ключ
   приводится к строке, иначе закупка команды 10 не попала бы в «10». */
export function buildTeamActivity(polls: Poll[], runs: StoreRunListItem[]): ActivityByTeam {
  const out: ActivityByTeam = {};
  for (const p of polls) {
    if (p.status !== 'ACTIVE') continue;
    const key = String(p.groupId);
    out[key] = { ...out[key], pollEndsAt: pollEndsAt(p) };
  }
  for (const r of runs) {
    if (!isActiveRun(r.status)) continue;
    const key = String(r.groupId);
    if (out[key]?.run) continue;
    out[key] = { ...out[key], run: { id: r.id, status: r.status } };
  }
  return out;
}

const isBusy = (a: TeamActivity | undefined) => !!a && (!!a.pollEndsAt || !!a.run);

export type TeamSlotModel =
  | { kind: 'none' }
  | { kind: 'poll'; endsAt: string }
  | { kind: 'run'; runId: number; status: ActiveRunStatus }
  | { kind: 'switcher'; busyCount: number };

export function teamSlotModel({
  teamIds,
  currentGroupId,
  activity,
  onHome,
}: {
  /** Активные команды человека, id строкой. */
  teamIds: string[];
  currentGroupId: string | null;
  activity: ActivityByTeam;
  onHome: boolean;
}): TeamSlotModel {
  if (teamIds.length >= 2) {
    /* На Главной текущая команда и так на экране — точка говорит о других. */
    const busyCount = teamIds.filter(
      (id) => !(onHome && id === currentGroupId) && isBusy(activity[id]),
    ).length;
    return { kind: 'switcher', busyCount };
  }
  if (onHome || !currentGroupId) return { kind: 'none' };
  const a = activity[currentGroupId];
  if (a?.pollEndsAt) return { kind: 'poll', endsAt: a.pollEndsAt };
  if (a?.run) return { kind: 'run', runId: a.run.id, status: a.run.status };
  return { kind: 'none' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** «12:41», больше часа — «1:05:12»: тот же формат, что у таймера талона. */
export function formatRemaining(cd: { hours: number; minutes: number; seconds: number }): string {
  return cd.hours > 0
    ? `${cd.hours}:${pad(cd.minutes)}:${pad(cd.seconds)}`
    : `${pad(cd.minutes)}:${pad(cd.seconds)}`;
}

/* Фазы теми же словами, что в секции «Сейчас» (NowSection: «Сбор», «В магазине»). */
const RUN_PHASE: Record<ActiveRunStatus, string> = {
  COLLECTING: 'сбор',
  SHOPPING: 'в магазине',
};

export function runStatusText(status: ActiveRunStatus, capital = true): string {
  return `${capital ? 'Закупка' : 'закупка'} · ${RUN_PHASE[status]}`;
}
