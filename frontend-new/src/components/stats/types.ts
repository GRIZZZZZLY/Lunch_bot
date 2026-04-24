export type StatsTab = 'overview' | 'insights' | 'leaderboard';
export type StatsPeriod = 'week' | 'month' | 'all';

export interface DnaStat {
  emoji: string;
  value: string;
  label: string;
  pct: string;
  ringPct: number;
}

export interface LegendItem {
  color: string;
  name: string;
  pct: string;
}

export interface StatTileData {
  icon: string;
  num: string;
  label: string;
  tone?: 'default' | 'sage' | 'butter' | 'lav';
}

export interface FinRow {
  label: string;
  value: string;
  tone?: 'up' | 'dn' | 'balance';
}

export interface InsightCard {
  id: string;
  emoji: string;
  title: string;
  cta: string;
  tone: 'g-peach' | 'g-lav' | 'g-sage' | 'g-sky' | 'g-butter';
}

export interface DishOfMonth {
  emoji: string;
  name: string;
  meta: string;
}

export interface PodiumPlayer {
  initial: string;
  name: string;
  score: number;
  avatarBg: string;
  avatarInk: string;
}

export interface RankPlayer {
  rank: number;
  initial: string;
  name: string;
  score: number;
  avatarBg: string;
  delta?: { dir: 'up' | 'dn' | 'eq'; value: string };
}

export interface SelfPlayer {
  rank: number;
  initial: string;
  name: string;
  score: number;
  delta?: { dir: 'up' | 'dn' | 'eq'; value: string };
}

export interface StatsOverviewData {
  dna: {
    title: string;
    subtitle: string;
    stats: [DnaStat, DnaStat, DnaStat];
  };
  donut: {
    total: number;
    totalLabel: string;
    subtitle: string;
    legend: LegendItem[];
  };
  tiles: StatTileData[];
  fin: {
    title: string;
    rows: FinRow[];
  };
}

export interface StatsInsightsData {
  insights: InsightCard[];
  dishOfMonth?: DishOfMonth;
}

export interface StatsLeaderboardData {
  podium: [PodiumPlayer, PodiumPlayer, PodiumPlayer];
  ranks: RankPlayer[];
  self: SelfPlayer;
}

export interface StatsData {
  overview?: StatsOverviewData;
  insights?: StatsInsightsData;
  leaderboard?: StatsLeaderboardData;
  isLoading?: boolean;
  isEmpty?: boolean;
}
