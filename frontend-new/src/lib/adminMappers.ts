import type {
  AdminDashboardData,
  MenuItemOption,
  MenuItemIconTone,
  PollItem,
  PollItemTone,
  WeekBar,
} from '@/components/admin/types';
import type { MenuItem, Poll } from '@/types/models';
import { pluralize } from '@/shared/lib/pluralize';

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
    /* Склонение было сломано на всём, кроме единицы и двойки: «5 активных
       опроса». Считает pluralize, как везде в продукте. */
    checklistHeading: activePolls.length
      ? pluralize(activePolls.length, 'активный опрос', 'активных опроса', 'активных опросов')
      : 'Нет срочных задач',
    checklist: activePolls.slice(0, 3).map((p) => ({
      id: `poll-${p.id}`,
      label: `Опрос #${p.id} — следить за ходом`,
      urgent: (Date.now() - new Date(p.createdAt).getTime()) / 60_000 > p.duration - 5,
    })),
    /* «Рассылка» и «Модерация» отсюда убраны: плитки нажимались, а
       handleQuickAction их не обрабатывал — тап не делал ничего. Подпись
       «скоро» этого не отменяла. Заглушки того же рода уже удалены из
       профиля («Уведомления», «Язык»). */
    quickActions: [
      { id: 'create-poll', emoji: '✚', title: 'Создать опрос', subtitle: 'из меню', tone: 'peach' },
      {
        id: 'manage-menu',
        emoji: '🍽',
        title: 'Управление меню',
        subtitle: pluralize(menuCount, 'блюдо', 'блюда', 'блюд'),
        tone: 'sage',
      },
    ],
    /* Переносы задавались тегом <br> прямо в данных, а на месте показа
       вычищались регуляркой. Вёрстке здесь не место — перенос делает CSS. */
    stats: [
      { num: String(totalPolls), label: 'опросов всего' },
      { num: String(avgVotes), label: 'средн. голосов' },
      { num: String(menuCount), label: 'блюд в меню' },
    ],
    chart: {
      title: 'Опросы по дням недели',
      /* «вся история» было неправдой: история приходит страницей. */
      subtitle: pluralize(totalPolls, 'опрос', 'опроса', 'опросов'),
      bars: buildWeekdayChart(history),
      /* На двух-трёх опросах это не ритм недели, а один случайный день,
         поданный как аналитика. */
      meaningful: totalPolls >= 4,
    },
    users: [],
    usersTotal: 0,
    polls: {
      active: mapActivePolls(activePolls),
      scheduled: [],
    },
  };
}
