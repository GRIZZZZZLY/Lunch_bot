import { describe, expect, it } from 'vitest';
import { buildVM } from '../buildVM';
import type { Poll } from '@/types/models';

const NOW = new Date('2026-07-15T12:00:00');

function poll(id: number, createdAt: string, voterIds: number[], dishByUser: Record<number, string> = {}): Poll {
  return {
    id,
    status: 'COMPLETED',
    createdAt,
    votes: voterIds.map((uid, i) => ({
      id: id * 100 + i,
      userId: uid,
      menuItemId: 1,
      user: { id: uid, firstName: `U${uid}` },
      menuItem: dishByUser[uid] ? { id: 1, name: dishByUser[uid] } : undefined,
    })),
  } as unknown as Poll;
}

describe('buildVM — клиентская статистика', () => {
  it('пустая история → нули', () => {
    const vm = buildVM([], 1, NOW);
    expect(vm.pollsTotal).toBe(0);
    expect(vm.participation).toBe(0);
    expect(vm.leaders).toEqual([]);
    expect(vm.teamCount).toBe(0);
  });

  it('участие: pollsWithMe / pollsTotal и процент', () => {
    const polls = [
      poll(1, '2026-07-01T10:00:00', [1, 2]),
      poll(2, '2026-07-02T10:00:00', [2]),
      poll(3, '2026-07-03T10:00:00', [1]),
      poll(4, '2026-07-04T10:00:00', [2]),
    ];
    const vm = buildVM(polls, 1, NOW);
    expect(vm.pollsWithMe).toBe(2);
    expect(vm.pollsTotal).toBe(4);
    expect(vm.participation).toBe(50);
  });

  it('лидеры: сортировка по обедам, isMe, топ-5', () => {
    const polls = [
      poll(1, '2026-07-01T10:00:00', [1, 2, 3, 4, 5, 6]),
      poll(2, '2026-07-02T10:00:00', [2, 3]),
      poll(3, '2026-07-03T10:00:00', [2]),
    ];
    const vm = buildVM(polls, 3, NOW);
    expect(vm.teamCount).toBe(6);
    expect(vm.leaders).toHaveLength(5);
    expect(vm.leaders[0]).toMatchObject({ id: 2, lunches: 3 });
    expect(vm.leaders[1]).toMatchObject({ id: 3, lunches: 2, isMe: true });
  });

  it('streak: подряд с последнего опроса, обрывается на пропуске', () => {
    const polls = [
      poll(1, '2026-07-01T10:00:00', [1]),
      poll(2, '2026-07-02T10:00:00', [1, 2]),
      poll(3, '2026-07-03T10:00:00', [1, 2]),
    ];
    const vm = buildVM(polls, 1, NOW);
    const u1 = vm.leaders.find((l) => l.id === 1);
    const u2 = vm.leaders.find((l) => l.id === 2);
    expect(u1?.streak).toBe(3);
    expect(u2?.streak).toBe(2);
  });

  it('любимые блюда: только мои голоса, топ-3 по частоте', () => {
    const polls = [
      poll(1, '2026-07-01T10:00:00', [1, 2], { 1: 'Плов', 2: 'Суши' }),
      poll(2, '2026-07-02T10:00:00', [1], { 1: 'Плов' }),
      poll(3, '2026-07-03T10:00:00', [1], { 1: 'Борщ' }),
    ];
    const vm = buildVM(polls, 1, NOW);
    expect(vm.myDishes).toEqual([
      { name: 'Плов', count: 2 },
      { name: 'Борщ', count: 1 },
    ]);
  });

  it('недельные бакеты: только текущий месяц, граница 22–конец', () => {
    const polls = [
      poll(1, '2026-07-03T10:00:00', [1]),
      poll(2, '2026-07-10T10:00:00', [1]),
      poll(3, '2026-07-25T10:00:00', [1]),
      poll(4, '2026-06-25T10:00:00', [1]), // другой месяц — не считается
    ];
    const vm = buildVM(polls, 1, NOW);
    expect(vm.weeks.map((w) => w.count)).toEqual([1, 1, 0, 1]);
    expect(vm.weeks[3].label).toBe('22–31');
    expect(vm.monthName).toBe('Июль');
  });
});
