import type {
  AdminDashboardData,
  MenuItemOption,
  MenuItemIconTone,
  PollItem,
  PollItemTone,
  WeekBar,
} from '@/components/admin/types';
import type { MenuItem, Poll } from '@/types/models';

const ICON_TONES: MenuItemIconTone[] = ['default', 'lav', 'sage', 'butter', 'rose', 'sky'];
const POLL_TONES: PollItemTone[] = ['peach', 'lav', 'sage', 'butter', 'rose'];

export function mapMenuToOptions(items: MenuItem[]): MenuItemOption[] {
  return items.map((m, i) => ({
    id: String(m.id),
    emoji: m.emoji ?? '🍽',
    name: m.name,
    restaurant: m.category ?? '',
    price: m.price,
    iconTone: ICON_TONES[i % ICON_TONES.length],
  }));
}

export function mapActivePolls(polls: Poll[]): PollItem[] {
  return polls.map((p, i) => {
    const end = new Date(p.createdAt).getTime() + p.duration * 60_000;
    const minutesLeft = Math.max(0, Math.round((end - Date.now()) / 60_000));
    const firstEmoji = p.menuItems?.[0]?.menuItem?.emoji ?? '🗳';
    return {
      id: String(p.id),
      emoji: firstEmoji,
      title: `Опрос #${p.id}`,
      status: 'active',
      meta: minutesLeft > 0 ? `закр. через ${minutesLeft} мин` : 'закрывается',
      tone: POLL_TONES[i % POLL_TONES.length],
    };
  });
}

export function buildWeekdayChart(polls: Poll[]): WeekBar[] {
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const counts = new Array(7).fill(0) as number[];
  for (const p of polls) {
    const jsDay = new Date(p.createdAt).getDay();
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    counts[idx] += 1;
  }
  const max = Math.max(1, ...counts);
  return labels.map((day, i) => ({
    day,
    value: Math.round((counts[i] / max) * 100),
    peak: counts[i] === max && counts[i] > 0,
    muted: i >= 5 && counts[i] === 0,
  }));
}

export function buildDashboard(args: {
  activePolls: Poll[];
  history: Poll[];
  menuCount: number;
}): AdminDashboardData {
  const { activePolls, history, menuCount } = args;
  const totalPolls = history.length;
  const avgVotes = totalPolls
    ? Math.round(
        (history.reduce((s, p) => s + (p._count?.votes ?? p.votes?.length ?? 0), 0) /
          totalPolls) *
          10,
      ) / 10
    : 0;

  return {
    checklistHeading: activePolls.length
      ? `${activePolls.length} активн${activePolls.length === 1 ? 'ый опрос' : 'ых опроса'}`
      : 'Нет срочных задач',
    checklistSubtitle: 'обновлено только что',
    checklist: activePolls.slice(0, 3).map((p) => ({
      id: `poll-${p.id}`,
      label: `Опрос #${p.id} — следить за ходом`,
      urgent: (Date.now() - new Date(p.createdAt).getTime()) / 60_000 > p.duration - 5,
    })),
    quickActions: [
      { id: 'create-poll', emoji: '✚', title: 'Создать опрос', subtitle: 'из меню', tone: 'peach' },
      { id: 'manage-menu', emoji: '🍽', title: 'Управление меню', subtitle: `${menuCount} блюд`, tone: 'sage' },
      { id: 'broadcast', emoji: '📢', title: 'Рассылка', subtitle: 'скоро', tone: 'lav' },
      { id: 'moderation', emoji: '🛡', title: 'Модерация', subtitle: 'скоро', tone: 'rose' },
    ],
    stats: [
      { num: String(totalPolls), label: 'опросов<br>всего' },
      { num: String(avgVotes), label: 'средн.<br>голосов' },
      { num: String(menuCount), label: 'блюд<br>в меню' },
    ],
    chart: {
      title: 'Опросы по дням недели',
      subtitle: 'вся история',
      bars: buildWeekdayChart(history),
    },
    users: [],
    usersTotal: 0,
    polls: {
      active: mapActivePolls(activePolls),
      scheduled: [],
    },
  };
}
