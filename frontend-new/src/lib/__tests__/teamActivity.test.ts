import { describe, expect, it } from 'vitest';
import type { Poll } from '@/types/models';
import type { StoreRunListItem, StoreRunStatus } from '@/services/store-run.service';
import {
  buildTeamActivity,
  formatRemaining,
  runStatusText,
  teamSlotModel,
  type ActivityByTeam,
} from '../teamActivity';

const poll = (groupId: string, status: Poll['status'] = 'ACTIVE') =>
  ({
    id: 1,
    groupId,
    status,
    duration: 15,
    createdAt: '2026-09-24T12:00:00.000Z',
    startedAt: '2026-09-24T12:00:00.000Z',
  }) as Poll;

const run = (groupId: number, status: StoreRunStatus, id = 601) =>
  ({ id, groupId, status }) as StoreRunListItem;

describe('buildTeamActivity', () => {
  it('сводит голосования и закупки по команде: id группы у закупки — число, у голосования — строка', () => {
    const a = buildTeamActivity([poll('10')], [run(10, 'COLLECTING'), run(20, 'SHOPPING', 602)]);
    expect(a['10']).toEqual({
      pollEndsAt: '2026-09-24T12:15:00.000Z',
      run: { id: 601, status: 'COLLECTING' },
    });
    expect(a['20']).toEqual({ run: { id: 602, status: 'SHOPPING' } });
  });

  it('завершённые голосования и рассчитанные или отменённые закупки не считаются', () => {
    const a = buildTeamActivity(
      [poll('10', 'COMPLETED')],
      [run(10, 'SETTLED'), run(10, 'CANCELLED', 603)],
    );
    expect(a).toEqual({});
  });
});

describe('teamSlotModel', () => {
  const both: ActivityByTeam = {
    '10': { pollEndsAt: '2026-09-24T12:15:00.000Z', run: { id: 601, status: 'COLLECTING' } },
  };
  const one = (activity: ActivityByTeam, onHome: boolean) =>
    teamSlotModel({ teamIds: ['10'], currentGroupId: '10', activity, onHome });

  it('одна команда на Главной — плашки нет', () => {
    expect(one(both, true)).toEqual({ kind: 'none' });
  });

  it('одна команда вне Главной: голосование важнее закупки', () => {
    expect(one(both, false)).toEqual({ kind: 'poll', endsAt: '2026-09-24T12:15:00.000Z' });
  });

  it('одна команда вне Главной: закупка, если голосования нет', () => {
    expect(one({ '10': { run: { id: 601, status: 'SHOPPING' } } }, false)).toEqual({
      kind: 'run',
      runId: 601,
      status: 'SHOPPING',
    });
  });

  it('одна команда, ничего не идёт — плашки нет', () => {
    expect(one({}, false)).toEqual({ kind: 'none' });
  });

  const busy: ActivityByTeam = {
    '10': { pollEndsAt: '2026-09-24T12:15:00.000Z' },
    '20': { run: { id: 602, status: 'SHOPPING' } },
    '99': { pollEndsAt: '2026-09-24T12:15:00.000Z' },
  };
  const many = (onHome: boolean) =>
    teamSlotModel({ teamIds: ['10', '20'], currentGroupId: '10', activity: busy, onHome });

  it('две команды на Главной считают только другие', () => {
    expect(many(true)).toEqual({ kind: 'switcher', busyCount: 1 });
  });

  it('две команды вне Главной считают и текущую; команда не из списка не считается', () => {
    expect(many(false)).toEqual({ kind: 'switcher', busyCount: 2 });
  });
});

describe('тексты статуса', () => {
  it('остаток времени как у таймера талона', () => {
    expect(formatRemaining({ hours: 0, minutes: 12, seconds: 41 })).toBe('12:41');
    expect(formatRemaining({ hours: 0, minutes: 3, seconds: 5 })).toBe('03:05');
    expect(formatRemaining({ hours: 1, minutes: 5, seconds: 12 })).toBe('1:05:12');
  });

  it('фаза закупки', () => {
    expect(runStatusText('COLLECTING')).toBe('Закупка · сбор');
    expect(runStatusText('SHOPPING', false)).toBe('закупка · в магазине');
  });
});
