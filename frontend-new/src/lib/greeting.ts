export type HeroPalette = 'morning' | 'afternoon' | 'evening';

export interface GreetingContext {
  now?: Date;
  userName?: string;
  hasActivePoll?: boolean;
  hasVoted?: boolean;
  isPollEnding?: boolean;
  hasCompletedPoll?: boolean;
}

export interface Greeting {
  palette: HeroPalette;
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function paletteForHour(hour: number): HeroPalette {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function formatEyebrow(palette: HeroPalette, now: Date): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${palette} · ${hh}:${mm}`;
}

function timeGreeting(palette: HeroPalette, name: string): { title: string; emoji: string } {
  switch (palette) {
    case 'morning':
      return { title: `Доброе утро, ${name}`, emoji: '☀️' };
    case 'afternoon':
      return { title: `Привет, ${name}`, emoji: '🌤' };
    case 'evening':
      return { title: `Добрый вечер, ${name}`, emoji: '🌙' };
  }
}

export function getGreeting(ctx: GreetingContext = {}): Greeting {
  const now = ctx.now ?? new Date();
  const palette = paletteForHour(now.getHours());
  const name = ctx.userName?.trim() || 'Гость';
  const { title, emoji } = timeGreeting(palette, name);

  let subtitle = 'Что едим сегодня?';
  if (ctx.hasActivePoll && ctx.hasVoted && ctx.isPollEnding) {
    subtitle = 'Последние секунды голосования';
  } else if (ctx.hasActivePoll && ctx.hasVoted) {
    subtitle = 'Ваш голос принят. Результаты обновляются.';
  } else if (ctx.hasActivePoll && ctx.isPollEnding) {
    subtitle = 'Осталось меньше 5 минут — успейте проголосовать';
  } else if (ctx.hasActivePoll) {
    subtitle = 'Голосование активно. Сделайте выбор.';
  } else if (ctx.hasCompletedPoll) {
    subtitle = 'Обед сегодня закрыт. Команда выбрала вариант.';
  } else if (palette === 'morning') {
    subtitle = 'Что едим сегодня?';
  } else if (palette === 'evening') {
    subtitle = 'На сегодня всё. Увидимся завтра.';
  }

  return {
    palette,
    eyebrow: formatEyebrow(palette, now),
    title: `${title} ${emoji}`,
    subtitle,
  };
}
