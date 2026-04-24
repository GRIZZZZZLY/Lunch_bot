import type {
  StatsOverviewData,
  StatsInsightsData,
  LegendItem,
  StatTileData,
  DnaStat,
} from '@/components/stats/types';
import type { Poll } from '@/types/models';

const DONUT_COLORS = [
  'var(--peach-400)',
  'var(--lav-400)',
  'var(--mint-400)',
  'var(--butter-400)',
  'var(--coral-400)',
];

const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

interface MyVoteContext {
  userId: number | null;
}

function pollWinner(poll: Poll): { name: string; emoji: string; category?: string } | null {
  const withCount = poll.menuItems?.map((link) => ({
    name: link.menuItem.name,
    emoji: link.menuItem.emoji ?? '🍽',
    category: link.menuItem.category,
    votes: link._count?.votes ?? 0,
  })) ?? [];
  if (withCount.length === 0) return null;
  return withCount.reduce((best, cur) => (cur.votes > best.votes ? cur : best), withCount[0]);
}

function myChoice(poll: Poll, userId: number | null): number | null {
  if (!userId || !poll.votes) return null;
  const mine = poll.votes.find((v) => v.userId === userId);
  return mine?.menuItemId ?? null;
}

function didMyChoiceWin(poll: Poll, userId: number | null): boolean {
  const mine = myChoice(poll, userId);
  if (!mine) return false;
  const w = pollWinner(poll);
  if (!w) return false;
  const winnerId = poll.menuItems?.reduce((best, cur) => {
    const bCount = best._count?.votes ?? 0;
    const cCount = cur._count?.votes ?? 0;
    return cCount > bCount ? cur : best;
  }, poll.menuItems[0])?.menuItemId;
  return winnerId === mine;
}

export function buildOverview(
  polls: Poll[],
  ctx: MyVoteContext,
): StatsOverviewData | null {
  if (polls.length === 0) return null;

  const dishCounts = new Map<string, { emoji: string; votes: number; name: string }>();
  const categoryCounts = new Map<string, number>();
  const weekdayCounts = new Array(7).fill(0) as number[];
  let totalVotes = 0;
  let wins = 0;
  let skipped = 0;

  for (const poll of polls) {
    const weekday = new Date(poll.createdAt).getDay();
    weekdayCounts[weekday] += 1;

    const mine = myChoice(poll, ctx.userId);
    if (!mine) skipped += 1;
    if (didMyChoiceWin(poll, ctx.userId)) wins += 1;

    for (const link of poll.menuItems ?? []) {
      const n = link._count?.votes ?? 0;
      totalVotes += n;
      const cur = dishCounts.get(link.menuItem.name) ?? {
        name: link.menuItem.name,
        emoji: link.menuItem.emoji ?? '🍽',
        votes: 0,
      };
      cur.votes += n;
      dishCounts.set(link.menuItem.name, cur);
      if (link.menuItem.category) {
        categoryCounts.set(link.menuItem.category, (categoryCounts.get(link.menuItem.category) ?? 0) + n);
      }
    }
  }

  const sortedDishes = [...dishCounts.values()].sort((a, b) => b.votes - a.votes);
  const top = sortedDishes[0] ?? { name: '—', emoji: '🍽', votes: 0 };
  const winRate = polls.length > 0 ? Math.round((wins / polls.length) * 100) : 0;
  const favRate = totalVotes > 0 ? Math.round((top.votes / totalVotes) * 100) : 0;

  const legendSource = categoryCounts.size > 0 ? [...categoryCounts.entries()] : sortedDishes.map((d) => [d.name, d.votes] as [string, number]);
  const legend: LegendItem[] = legendSource
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, votes], i) => ({
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      name,
      pct: totalVotes > 0 ? `${Math.round((votes / totalVotes) * 100)}%` : '—',
    }));

  const busiestIdx = weekdayCounts.reduce((bestIdx, v, idx, arr) => (v > arr[bestIdx] ? idx : bestIdx), 0);

  const dna = {
    title: 'Ваше ДНК обеда',
    subtitle: `За ${polls.length} опрос${plural(polls.length, ['', 'а', 'ов'])} вырисовывается ваш стиль.`,
    stats: [
      { emoji: top.emoji, value: top.name, label: 'любимое блюдо', pct: `${favRate}%`, ringPct: favRate },
      { emoji: '🗳', value: String(polls.length), label: 'опросов', pct: 'всего', ringPct: Math.min(100, polls.length * 5) },
      { emoji: '🎯', value: `${winRate}%`, label: 'голосует за победителя', pct: `+${wins}`, ringPct: winRate },
    ] as [DnaStat, DnaStat, DnaStat],
  };

  const tiles: StatTileData[] = [
    { icon: '🗳', num: String(polls.length), label: 'Участвовали в опросах' },
    { icon: '🏆', num: String(wins), label: 'Ваш выбор победил', tone: 'sage' },
    { icon: '😴', num: String(skipped), label: 'Пропустили', tone: 'butter' },
    { icon: '🔥', num: WEEKDAY_LABELS[busiestIdx], label: 'Самый активный день', tone: 'lav' },
  ];

  return {
    dna,
    donut: {
      total: totalVotes,
      totalLabel: 'голосов',
      subtitle: 'top 5',
      legend,
    },
    tiles,
    fin: {
      title: 'Финансы · скоро',
      rows: [
        { label: 'Получено', value: '—', tone: 'up' },
        { label: 'Потрачено', value: '—', tone: 'dn' },
        { label: 'Баланс', value: '—', tone: 'balance' },
      ],
    },
  };
}

export function buildInsights(polls: Poll[]): StatsInsightsData | null {
  if (polls.length === 0) return null;
  const dishCounts = new Map<string, { emoji: string; votes: number; wins: number }>();
  for (const poll of polls) {
    const winner = pollWinner(poll);
    for (const link of poll.menuItems ?? []) {
      const cur = dishCounts.get(link.menuItem.name) ?? {
        emoji: link.menuItem.emoji ?? '🍽',
        votes: 0,
        wins: 0,
      };
      cur.votes += link._count?.votes ?? 0;
      if (winner && winner.name === link.menuItem.name) cur.wins += 1;
      dishCounts.set(link.menuItem.name, cur);
    }
  }
  const sorted = [...dishCounts.entries()].sort((a, b) => b[1].votes - a[1].votes);
  const top = sorted[0];
  if (!top) return null;
  return {
    insights: [
      {
        id: 'top-dish',
        emoji: top[1].emoji,
        title: `«${top[0]}» — ваше самое частое блюдо: ${top[1].votes} голосов.`,
        cta: 'Посмотреть историю →',
        tone: 'g-peach',
      },
    ],
    dishOfMonth: {
      emoji: top[1].emoji,
      name: top[0],
      meta: `${top[1].votes} голосов · ${top[1].wins} побед`,
    },
  };
}

function plural(n: number, forms: [string, string, string]): string {
  const m = n % 100;
  const rem = n % 10;
  if (m >= 11 && m <= 14) return forms[2];
  if (rem === 1) return forms[0];
  if (rem >= 2 && rem <= 4) return forms[1];
  return forms[2];
}
