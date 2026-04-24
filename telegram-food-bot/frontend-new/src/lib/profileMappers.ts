import type { User, Poll } from '@/types/models';
import type {
  HistoryDay,
  HistoryEntry,
  PollRowDecoTone,
  ProfileUser,
  RecentPollItem,
} from '@/components/profile/types';

const TONES: PollRowDecoTone[] = ['default', 'lav', 'sage', 'butter', 'rose'];

function toneFor(index: number): PollRowDecoTone {
  return TONES[index % TONES.length];
}

function firstEmoji(poll: Poll): string {
  const winner = poll.menuItems?.[0];
  return winner?.menuItem?.emoji ?? '🍽';
}

function winnerName(poll: Poll): string {
  return poll.menuItems?.[0]?.menuItem?.name ?? 'Без названия';
}

function wasUserInvolved(_poll: Poll): 'ok' | 'no' {
  // Без данных о голосовании текущего пользователя считаем «ok» по умолчанию.
  // Вернёмся к этому, когда будет endpoint /polls/:id/my-vote.
  return 'ok';
}

export function buildProfileUser(user: User | null): ProfileUser {
  if (!user) {
    return {
      initial: '?',
      name: 'Гость',
      username: '',
      joined: '',
      pills: [{ text: 'Не авторизован', tone: 'muted' }],
    };
  }
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return {
    initial: (user.firstName?.[0] ?? '?').toUpperCase(),
    name: fullName || user.username || 'Пользователь',
    username: user.username ? `@${user.username}` : '',
    joined: user.createdAt ? `В команде с ${formatJoinDate(user.createdAt)}` : '',
    pills: [
      ...(user.isAdmin ? [{ text: '👑 Админ', tone: 'peach' as const }] : []),
    ],
  };
}

function formatJoinDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

export function buildRecentPolls(polls: Poll[], limit = 3): RecentPollItem[] {
  return polls.slice(0, limit).map((p, idx) => ({
    id: String(p.id),
    emoji: firstEmoji(p),
    date: formatShortDate(p.closedAt ?? p.createdAt),
    name: winnerName(p),
    tone: toneFor(idx),
    status: wasUserInvolved(p),
  }));
}

export function buildHistoryDays(polls: Poll[]): HistoryDay[] {
  const byDay = new Map<string, Poll[]>();
  for (const p of polls) {
    const key = formatDayKey(p.closedAt ?? p.createdAt);
    const list = byDay.get(key) ?? [];
    list.push(p);
    byDay.set(key, list);
  }
  const days: HistoryDay[] = [];
  let idx = 0;
  for (const [label, dayPolls] of byDay) {
    const entries: HistoryEntry[] = dayPolls.map((p) => ({
      id: String(p.id),
      emoji: firstEmoji(p),
      name: winnerName(p),
      optionsCount: p.menuItems?.length ?? 0,
      votes: p._count?.votes ?? p.votes?.length ?? 0,
      tone: toneFor(idx++),
      status: wasUserInvolved(p),
    }));
    days.push({ label, entries });
  }
  return days;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatDayKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const formatted = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  if (same(d, today)) return `Сегодня, ${formatted}`;
  if (same(d, yesterday)) return `Вчера, ${formatted}`;
  return formatted;
}
