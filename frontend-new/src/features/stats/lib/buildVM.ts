/* Клиентская статистика из истории голосований (перенос из legacy StatsPage,
   логика не менялась). Никаких выдуманных метрик — только реальные данные. */
import type { Poll } from '@/types/models';

export interface LeaderVM {
  id: number;
  name: string;
  lunches: number;
  streak: number;
  isMe: boolean;
  /** Место с учётом равенства: у одинаковых значений оно одно на всех. */
  rank: number;
}

export interface StatsVM {
  teamCount: number;
  leaders: LeaderVM[];
  /** У всех лидеров одинаковое число обедов — ранжировать нечего. */
  allTied: boolean;
  myDishes: { name: string; count: number }[];
  participation: number;
  pollsWithMe: number;
  pollsTotal: number;
  weeks: { label: string; count: number }[];
  monthName: string;
}

export function buildVM(polls: Poll[], myId: number | null, now: Date = new Date()): StatsVM {
  /* Место известно только после сортировки, поэтому копим без него. */
  const members = new Map<number, Omit<LeaderVM, 'rank'>>();
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

  /* Место с учётом равенства. Раньше номер был просто порядковым: при четырёх
     участниках с одним обедом каждый экран показывал 1, 2, 3, 4 — рейтинг там,
     где все равны, и «первое место» доставалось тому, кто раньше попал в Map. */
  const sorted = [...members.values()].sort((a, b) => b.lunches - a.lunches);
  let rank = 0;
  let prevLunches: number | null = null;
  const ranked = sorted.map((leader, index) => {
    if (leader.lunches !== prevLunches) {
      rank = index + 1;
      prevLunches = leader.lunches;
    }
    return { ...leader, rank };
  });

  return {
    teamCount: members.size,
    leaders: ranked.slice(0, 5),
    /* Все ли поровну: четыре одинаковых полосы во всю ширину читаются как
       «каждый на максимуме», хотя это лишь нормировка на общий максимум. */
    allTied: sorted.length > 1 && sorted[0].lunches === sorted[sorted.length - 1].lunches,
    myDishes: [...myDishCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    participation: polls.length > 0 ? Math.round((pollsWithMe / polls.length) * 100) : 0,
    pollsWithMe,
    pollsTotal: polls.length,
    weeks: buckets,
    monthName: rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1),
  };
}
