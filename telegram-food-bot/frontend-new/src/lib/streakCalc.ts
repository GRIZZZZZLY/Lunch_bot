import type { Poll } from '@/types/models';

export interface StreakInfo {
  current: number;
  longest: number;
  totalVotes: number;
  lastVoteDate: string | null;
  atRisk: boolean;
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86_400_000);
}

export function computeStreak(polls: Poll[], userId: number | null): StreakInfo {
  if (!userId || polls.length === 0) {
    return { current: 0, longest: 0, totalVotes: 0, lastVoteDate: null, atRisk: false };
  }

  const days = new Set<string>();
  for (const poll of polls) {
    const voted = poll.votes?.some((v) => v.userId === userId);
    if (voted) days.add(dayKey(poll.createdAt));
  }

  if (days.size === 0) {
    return { current: 0, longest: 0, totalVotes: 0, lastVoteDate: null, atRisk: false };
  }

  const sorted = [...days].sort();
  const lastVoteDate = sorted[sorted.length - 1];

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i - 1], sorted[i]) === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  let current = 0;
  const today = todayKey();
  const yday = yesterdayKey();
  if (lastVoteDate === today || lastVoteDate === yday) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (diffDays(sorted[i], sorted[i + 1]) === 1) current += 1;
      else break;
    }
  }

  const atRisk = current > 0 && lastVoteDate === yday;

  return {
    current,
    longest: Math.max(longest, current),
    totalVotes: days.size,
    lastVoteDate,
    atRisk,
  };
}
